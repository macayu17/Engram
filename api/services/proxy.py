import copy
import logging
from collections.abc import Mapping
from uuid import UUID, uuid4

import asyncpg
import httpx

from api.config import settings
from api.services.extraction import run_extraction_task
from api.services.providers.base import build_chat_completions_url
from api.services.retrieval import get_retrieval_query, log_retrieval, retrieve_memories


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


async def build_proxy_result(
    user_id: UUID,
    external_id: str,
    requested_external_id: str,
    request_body: dict[str, object],
    provider: str,
    disable_injection: bool,
    incoming_headers: Mapping[str, str],
    db: asyncpg.Connection,
    max_memories_injected: int | None = None,
    retrieval_threshold: float | None = None,
) -> ProxyResult:
    if external_id != requested_external_id:
        raise PermissionError("X-Engram-User-ID does not match the authenticated user")
    conversation_id = uuid4()
    body = copy.deepcopy(request_body)
    injected_count = 0
    query = get_retrieval_query(body)
    if not disable_injection:
        try:
            memories = await retrieve_memories(user_id, query, db, max_memories_injected, retrieval_threshold)
            injected_count = len(memories)
            body = inject_memories(body, memories)
            await log_retrieval(user_id, str(conversation_id), query, memories, db)
        except Exception as error:
            injected_count = 0
            logger.warning("Retrieval failed, proceeding without memories: %s", error)
    provider_response = await forward_to_provider(body, provider, incoming_headers)
    return ProxyResult(
        provider_response.content,
        provider_response.status_code,
        provider_response.media_type,
        conversation_id,
        injected_count,
    )


async def build_proxy_passthrough_result(
    external_id: str,
    requested_external_id: str,
    request_body: dict[str, object],
    provider: str,
    incoming_headers: Mapping[str, str],
) -> ProxyResult:
    if external_id != requested_external_id:
        raise PermissionError("X-Engram-User-ID does not match the authenticated user")
    conversation_id = uuid4()
    provider_response = await forward_to_provider(copy.deepcopy(request_body), provider, incoming_headers)
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
    provider: str,
    incoming_headers: Mapping[str, str],
) -> ProviderResponse:
    provider_name = provider.lower()
    if provider_name == "anthropic":
        return await forward_to_anthropic(body, incoming_headers)
    url = get_openai_compatible_url(provider_name)
    headers = build_provider_headers(provider_name, incoming_headers)
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(url, headers=headers, json=body)
    except httpx.HTTPError as error:
        raise RuntimeError(f"Provider request failed: {error}") from error
    return ProviderResponse(response.content, response.status_code, get_response_media_type(response))


async def forward_to_anthropic(body: dict[str, object], incoming_headers: Mapping[str, str]) -> ProviderResponse:
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is required for Anthropic proxy requests")
    headers = sanitize_passthrough_headers(incoming_headers)
    headers["x-api-key"] = settings.anthropic_api_key
    headers["anthropic-version"] = "2023-06-01"
    headers["content-type"] = "application/json"
    payload = convert_openai_body_to_anthropic(body)
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(f"{settings.anthropic_base_url.rstrip('/')}/messages", headers=headers, json=payload)
    except httpx.HTTPError as error:
        raise RuntimeError(f"Provider request failed: {error}") from error
    return ProviderResponse(response.content, response.status_code, get_response_media_type(response))


def get_openai_compatible_url(provider: str) -> str:
    if provider == "openai":
        return build_chat_completions_url(settings.openai_base_url)
    if provider == "gemini":
        return build_chat_completions_url(settings.gemini_base_url)
    if provider == "ollama":
        return build_chat_completions_url(f"{settings.ollama_base_url.rstrip('/')}/v1")
    raise ValueError(f"Unsupported provider: {provider}")


def build_provider_headers(provider: str, incoming_headers: Mapping[str, str]) -> dict[str, str]:
    headers = sanitize_passthrough_headers(incoming_headers)
    headers["content-type"] = "application/json"
    if provider == "openai":
        if not settings.openai_api_key:
            raise RuntimeError("OPENAI_API_KEY is required for OpenAI proxy requests")
        headers["authorization"] = f"Bearer {settings.openai_api_key}"
    if provider == "gemini":
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is required for Gemini proxy requests")
        headers["authorization"] = f"Bearer {settings.gemini_api_key}"
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
