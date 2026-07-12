import copy
import logging
from collections.abc import AsyncIterator, Mapping
from uuid import UUID, uuid4

import asyncpg
import httpx

from api.config import settings
from api.services.extraction import run_extraction_task
from api.services.providers.base import build_chat_completions_url
from api.services.provider_keys import ProviderConfigError, ResolvedProvider, resolve_user_provider
from api.services.retrieval import get_retrieval_query, log_retrieval, retrieve_memories, retrieve_memories_graph, retrieve_memories_hybrid


logger = logging.getLogger(__name__)


class ProviderResponse:
    def __init__(self, content: bytes, status_code: int, media_type: str) -> None:
        self.content = content
        self.status_code = status_code
        self.media_type = media_type


class ProxyResult:
    def __init__(self, content: bytes, status_code: int, media_type: str, conversation_id: UUID, injected_count: int) -> None:
        self.content = content
        self.status_code = status_code
        self.media_type = media_type
        self.conversation_id = conversation_id
        self.injected_count = injected_count


class PreparedProxyRequest:
    def __init__(
        self,
        body: dict[str, object],
        resolved: ResolvedProvider,
        conversation_id: UUID,
        injected_count: int,
    ) -> None:
        self.body = body
        self.resolved = resolved
        self.conversation_id = conversation_id
        self.injected_count = injected_count


class ProviderStream:
    def __init__(self, client: httpx.AsyncClient, response: httpx.Response) -> None:
        self.client = client
        self.response = response
        self.status_code = response.status_code
        self.media_type = get_response_media_type(response)

    async def aiter_bytes(self) -> AsyncIterator[bytes]:
        async for chunk in self.response.aiter_bytes():
            yield chunk

    async def aread(self) -> bytes:
        return await self.response.aread()

    async def aclose(self) -> None:
        await self.response.aclose()
        await self.client.aclose()


async def _dispatch_retrieve(
    user_id: UUID,
    org_id: UUID,
    query: str,
    db: asyncpg.Connection,
    retrieval_mode: str,
    max_memories_injected: int | None,
    retrieval_threshold: float | None,
    namespace: str = "default",
) -> list[dict[str, object]]:
    if retrieval_mode == "hybrid":
        return await retrieve_memories_hybrid(user_id, org_id, query, db, max_memories_injected, retrieval_threshold, namespace=namespace)
    if retrieval_mode == "graph":
        return await retrieve_memories_graph(user_id, org_id, query, db, max_memories_injected, retrieval_threshold, namespace=namespace)
    return await retrieve_memories(user_id, org_id, query, db, max_memories_injected, retrieval_threshold, namespace=namespace)


async def prepare_proxy_request(
    user_id: UUID,
    org_id: UUID,
    external_id: str,
    requested_external_id: str | None,
    request_body: dict[str, object],
    provider: str,
    disable_injection: bool,
    db: asyncpg.Connection,
    max_memories_injected: int | None = None,
    retrieval_threshold: float | None = None,
    override_provider: str | None = None,
    override_provider_key: str | None = None,
    retrieval_mode: str = "vector",
    namespace: str = "default",
) -> PreparedProxyRequest:
    if requested_external_id is not None and external_id != requested_external_id:
        raise PermissionError("X-Engram-User-ID does not match the authenticated user")
    conversation_id = uuid4()
    body = copy.deepcopy(request_body)
    injected_count = 0
    query = get_retrieval_query(body)
    if not disable_injection:
        try:
            memories = await _dispatch_retrieve(user_id, org_id, query, db, retrieval_mode, max_memories_injected, retrieval_threshold, namespace=namespace)
            injected_count = len(memories)
            body = inject_memories(body, memories)
            await log_retrieval(user_id, org_id, str(conversation_id), query, memories, db)
        except Exception as error:
            injected_count = 0
            logger.warning("Retrieval failed, proceeding without memories: %s", error)
    user_row = await db.fetchrow(
        """SELECT id, external_id, extraction_provider,
                  extraction_model,
                  openai_api_key_encrypted, gemini_api_key_encrypted, anthropic_api_key_encrypted
           FROM users
           WHERE id = $1
             AND EXISTS (
                 SELECT 1 FROM org_memberships
                 WHERE user_id = users.id AND org_id = $2
             )""",
        user_id,
        org_id,
    )
    if user_row is None:
        raise PermissionError("Authenticated user no longer exists")
    try:
        resolved = resolve_user_provider(
            user_row,
            override_provider=override_provider or provider,
            override_key=override_provider_key,
        )
    except ProviderConfigError as error:
        raise RuntimeError(str(error)) from error
    return PreparedProxyRequest(body, resolved, conversation_id, injected_count)


async def build_proxy_passthrough_result(
    external_id: str,
    requested_external_id: str | None,
    request_body: dict[str, object],
    provider: str,
    incoming_headers: Mapping[str, str],
) -> ProxyResult:
    if requested_external_id is not None and external_id != requested_external_id:
        raise PermissionError("X-Engram-User-ID does not match the authenticated user")
    conversation_id = uuid4()
    from api.services.provider_keys import resolve_user_provider
    from api.config import settings as _settings
    fallback_row = {
        "id": None,
        "external_id": external_id,
        "extraction_provider": _settings.extraction_provider,
        "extraction_model": _settings.extraction_model,
        "openai_api_key_encrypted": None,
        "gemini_api_key_encrypted": None,
        "anthropic_api_key_encrypted": None,
    }
    resolved = resolve_user_provider(fallback_row, override_provider=provider)
    provider_response = await forward_to_provider(copy.deepcopy(request_body), resolved, incoming_headers)
    return ProxyResult(
        provider_response.content,
        provider_response.status_code,
        provider_response.media_type,
        conversation_id,
        0,
    )


def inject_memories(body: dict[str, object], memories: list[dict[str, object]]) -> dict[str, object]:
    if not memories:
        return body
    memory_block = "[MEMORY CONTEXT]\nThe following facts are known about this user from previous conversations:\n"
    memory_block += "\n".join(f"- {memory['content']}" for memory in memories)
    memory_block += "\n[END MEMORY CONTEXT]"
    raw_messages = body.get("messages")
    messages = raw_messages if isinstance(raw_messages, list) else []
    existing_system = find_system_message(messages)
    if existing_system is not None:
        current_content = existing_system.get("content")
        existing_system["content"] = f"{memory_block}\n\n{current_content}" if isinstance(current_content, str) else memory_block
    else:
        messages.insert(0, {"role": "system", "content": memory_block})
    body["messages"] = messages
    return body


def find_system_message(messages: list[object]) -> dict[str, object] | None:
    for message in messages:
        if isinstance(message, dict) and message.get("role") == "system":
            return message
    return None


async def forward_to_provider(
    body: dict[str, object],
    resolved: ResolvedProvider,
    incoming_headers: Mapping[str, str],
) -> ProviderResponse:
    if resolved.name == "anthropic":
        return await forward_to_anthropic(body, resolved, incoming_headers)
    url = build_chat_completions_url(resolved.base_url)
    headers = build_provider_headers(resolved, incoming_headers)
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, headers=headers, json=body)
    except httpx.HTTPError as error:
        raise RuntimeError(f"Provider request failed: {error}") from error
    return ProviderResponse(response.content, response.status_code, get_response_media_type(response))


async def forward_to_anthropic(body: dict[str, object], resolved: ResolvedProvider, incoming_headers: Mapping[str, str]) -> ProviderResponse:
    if not resolved.api_key:
        raise RuntimeError("Anthropic API key is required for Anthropic proxy requests")
    headers = sanitize_passthrough_headers(incoming_headers)
    headers["x-api-key"] = resolved.api_key
    headers["anthropic-version"] = "2023-06-01"
    headers["content-type"] = "application/json"
    payload = convert_openai_body_to_anthropic(body)
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(f"{settings.anthropic_base_url.rstrip('/')}/messages", headers=headers, json=payload)
    except httpx.HTTPError as error:
        raise RuntimeError(f"Provider request failed: {error}") from error
    return ProviderResponse(response.content, response.status_code, get_response_media_type(response))


async def open_provider_stream(
    body: dict[str, object],
    resolved: ResolvedProvider,
    incoming_headers: Mapping[str, str],
) -> ProviderStream:
    payload = copy.deepcopy(body)
    payload["stream"] = True
    if resolved.name == "anthropic":
        if not resolved.api_key:
            raise RuntimeError("Anthropic API key is required for Anthropic proxy requests")
        url = f"{settings.anthropic_base_url.rstrip('/')}/messages"
        headers = sanitize_passthrough_headers(incoming_headers)
        headers["x-api-key"] = resolved.api_key
        headers["anthropic-version"] = "2023-06-01"
        headers["content-type"] = "application/json"
        payload = convert_openai_body_to_anthropic(payload)
        payload["stream"] = True
    else:
        url = build_chat_completions_url(resolved.base_url)
        headers = build_provider_headers(resolved, incoming_headers)
    client = httpx.AsyncClient(timeout=120)
    try:
        request = client.build_request("POST", url, headers=headers, json=payload)
        response = await client.send(request, stream=True)
    except httpx.HTTPError as error:
        await client.aclose()
        raise RuntimeError(f"Provider request failed: {error}") from error
    return ProviderStream(client, response)


def get_openai_compatible_url(provider: str) -> str:
    if provider == "openai":
        return build_chat_completions_url(settings.openai_base_url)
    if provider == "gemini":
        return build_chat_completions_url(settings.gemini_base_url)
    if provider == "ollama":
        return build_chat_completions_url(f"{settings.ollama_base_url.rstrip('/')}/v1")
    raise ValueError(f"Unsupported provider: {provider}")


def build_provider_headers(resolved: ResolvedProvider, incoming_headers: Mapping[str, str]) -> dict[str, str]:
    headers = sanitize_passthrough_headers(incoming_headers)
    headers["content-type"] = "application/json"
    if resolved.name in {"openai", "gemini"}:
        if not resolved.api_key:
            raise RuntimeError(f"{resolved.name} API key is required for proxy requests")
        headers["authorization"] = f"Bearer {resolved.api_key}"
    return headers


def sanitize_passthrough_headers(incoming_headers: Mapping[str, str]) -> dict[str, str]:
    blocked = {
        "host",
        "content-length",
        "accept-encoding",
        "connection",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
        "authorization",
        "x-api-key",
        "x-engram-key",
        "x-engram-user-id",
        "x-engram-provider",
        "x-engram-disable-injection",
        "x-engram-disable-extraction",
        "x-engram-provider-key",
    }
    return {key.lower(): value for key, value in incoming_headers.items() if key.lower() not in blocked}


def convert_openai_body_to_anthropic(body: dict[str, object]) -> dict[str, object]:
    messages = body.get("messages")
    anthropic_messages: list[dict[str, str]] = []
    system_parts: list[str] = []
    if isinstance(messages, list):
        for message in messages:
            if not isinstance(message, dict):
                continue
            role = message.get("role")
            content = stringify_message_content(message.get("content"))
            if not content:
                continue
            if role == "system":
                system_parts.append(content)
            elif role in {"user", "assistant"}:
                anthropic_messages.append({"role": str(role), "content": content})
    payload: dict[str, object] = {
        "model": str(body.get("model", "claude-3-5-haiku-latest")),
        "messages": anthropic_messages,
        "max_tokens": int(body.get("max_tokens", 1024)) if isinstance(body.get("max_tokens", 1024), int) else 1024,
    }
    if system_parts:
        payload["system"] = "\n\n".join(system_parts)
    temperature = body.get("temperature")
    if isinstance(temperature, int | float):
        payload["temperature"] = temperature
    return payload


def stringify_message_content(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = [
            part["text"]
            for part in content
            if isinstance(part, dict) and isinstance(part.get("text"), str)
        ]
        return "\n".join(parts)
    return ""


def get_response_media_type(response: httpx.Response) -> str:
    content_type = response.headers.get("content-type", "application/json")
    return content_type.split(";")[0]
