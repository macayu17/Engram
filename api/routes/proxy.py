import asyncio
from collections.abc import AsyncIterator, Mapping
import json
import logging

import asyncpg
from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi.responses import StreamingResponse

from api.db.connection import get_pool
from api.services.entitlements import QuotaExceeded, enforce_workspace_limit, quota_headers
from api.services.extraction import build_capture_response_body, extract_assistant_response_text, run_extraction_task
from api.services.proxy import (
    ProxyResult,
    build_proxy_passthrough_result,
    forward_to_provider,
    open_provider_stream,
    prepare_proxy_request,
)
from api.services.users import get_cached_user_by_api_key, get_user_by_api_key


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/v1/chat")
async def proxy_chat(
    request: Request,
    x_engram_key: str = Header(...),
    x_engram_user_id: str = Header(...),
    x_engram_provider: str = Header(default="openai"),
    x_engram_disable_injection: bool = Header(default=False),
    x_engram_disable_extraction: bool = Header(default=False),
    x_engram_provider_key: str | None = Header(default=None, alias="X-Engram-Provider-Key"),
    x_engram_namespace: str = Header(default="default"),
) -> Response:
    body = await parse_request_body(request)
    if body.get("stream") is True:
        return await build_streaming_proxy_response(
            x_engram_key,
            x_engram_user_id,
            x_engram_provider,
            x_engram_disable_injection,
            x_engram_disable_extraction,
            x_engram_provider_key,
            body,
            request.headers,
            x_engram_namespace,
        )
    result = await build_proxy_response_with_available_auth(
        x_engram_key,
        x_engram_user_id,
        x_engram_provider,
        x_engram_disable_injection,
        x_engram_disable_extraction,
        x_engram_provider_key,
        body,
        request.headers,
        x_engram_namespace,
    )
    return create_response(result)


@router.post("/v1/chat/completions")
async def proxy_chat_completions(
    request: Request,
    authorization: str | None = Header(default=None),
    x_engram_key: str | None = Header(default=None),
    x_engram_provider: str = Header(default="openai"),
    x_engram_disable_injection: bool = Header(default=False),
    x_engram_disable_extraction: bool = Header(default=False),
    x_engram_provider_key: str | None = Header(default=None, alias="X-Engram-Provider-Key"),
    x_engram_namespace: str = Header(default="default"),
) -> Response:
    api_key = resolve_bearer_api_key(x_engram_key, authorization)
    if not api_key:
        raise HTTPException(status_code=401, detail="Provide an Engram API key via Authorization: Bearer or X-Engram-Key")
    body = await parse_request_body(request)
    if body.get("stream") is True:
        return await build_streaming_proxy_response(
            api_key,
            None,
            x_engram_provider,
            x_engram_disable_injection,
            x_engram_disable_extraction,
            x_engram_provider_key,
            body,
            request.headers,
            x_engram_namespace,
        )
    result = await build_proxy_response_with_available_auth(
        api_key,
        None,
        x_engram_provider,
        x_engram_disable_injection,
        x_engram_disable_extraction,
        x_engram_provider_key,
        body,
        request.headers,
        x_engram_namespace,
    )
    return create_response(result)


def resolve_bearer_api_key(x_engram_key: str | None, authorization: str | None) -> str:
    if x_engram_key:
        return x_engram_key
    if authorization and authorization.lower().startswith("bearer "):
        return authorization[7:].strip()
    return ""


async def build_proxy_response_with_available_auth(
    api_key: str,
    requested_external_id: str | None,
    provider: str,
    disable_injection: bool,
    disable_extraction: bool,
    override_provider_key: str | None,
    body: dict[str, object],
    headers: Mapping[str, str],
    namespace: str = "default",
) -> ProxyResult:
    try:
        pool = get_pool()
    except RuntimeError as error:
        logger.warning("Database pool unavailable, trying cached proxy auth: %s", error)
        return await build_cached_proxy_response(api_key, requested_external_id, provider, body, headers)
    acquire_context = pool.acquire()
    try:
        db = await acquire_context.__aenter__()
    except (asyncpg.PostgresError, OSError, ConnectionError, RuntimeError) as error:
        logger.warning("Database unavailable, trying cached proxy auth: %s", error)
        return await build_cached_proxy_response(api_key, requested_external_id, provider, body, headers)
    try:
        try:
            user = await get_user_by_api_key(api_key, db)
        except (asyncpg.PostgresError, OSError, ConnectionError) as error:
            logger.warning("Database auth unavailable, trying cached proxy auth: %s", error)
            return await build_cached_proxy_response(api_key, requested_external_id, provider, body, headers)
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid API key")
        async with db.transaction():
            await enforce_workspace_limit(user["org_id"], "retrievals", db)
            prepared = await prepare_proxy_request(
                user["id"],
                user["org_id"],
                user["external_id"],
                requested_external_id,
                body,
                provider,
                disable_injection,
                db,
                int(user["max_memories_injected"]),
                float(user["retrieval_threshold"]),
                override_provider=provider,
                override_provider_key=override_provider_key,
                retrieval_mode=str(user.get("retrieval_mode") or "vector"),
                namespace=namespace,
            )
    except QuotaExceeded as error:
        raise HTTPException(
            status_code=429,
            detail="retrievals limit reached",
            headers=quota_headers(error),
        ) from error
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    finally:
        try:
            await acquire_context.__aexit__(None, None, None)
        except (asyncpg.PostgresError, OSError, ConnectionError) as error:
            logger.warning("Database connection release failed: %s", error)
    try:
        provider_response = await forward_to_provider(prepared.body, prepared.resolved, headers)
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    result = ProxyResult(
        provider_response.content,
        provider_response.status_code,
        provider_response.media_type,
        prepared.conversation_id,
        prepared.injected_count,
    )
    if not disable_extraction and result.status_code < 400:
        try:
            asyncio.create_task(
                run_extraction_task(
                    user["id"],
                    user["org_id"],
                    result.conversation_id,
                    body,
                    result.content,
                    float(user["dedup_threshold"]),
                    override_provider=provider,
                    override_provider_key=override_provider_key,
                    namespace=namespace,
                )
            )
        except Exception as error:
            logger.warning("Failed to schedule extraction: %s", error)
    return result


async def build_streaming_proxy_response(
    api_key: str,
    requested_external_id: str | None,
    provider: str,
    disable_injection: bool,
    disable_extraction: bool,
    override_provider_key: str | None,
    body: dict[str, object],
    headers: Mapping[str, str],
    namespace: str = "default",
) -> Response:
    try:
        pool = get_pool()
    except RuntimeError as error:
        logger.warning("Database pool unavailable for streaming request: %s", error)
        raise HTTPException(status_code=503, detail="Database unavailable") from error
    acquire_context = pool.acquire()
    try:
        db = await acquire_context.__aenter__()
    except (asyncpg.PostgresError, OSError, ConnectionError, RuntimeError) as error:
        logger.warning("Database unavailable for streaming request: %s", error)
        raise HTTPException(status_code=503, detail="Database unavailable") from error
    try:
        try:
            user = await get_user_by_api_key(api_key, db)
        except (asyncpg.PostgresError, OSError, ConnectionError) as error:
            logger.warning("Database auth unavailable for streaming request: %s", error)
            raise HTTPException(status_code=503, detail="Database unavailable") from error
        if user is None:
            raise HTTPException(status_code=401, detail="Invalid API key")
        try:
            async with db.transaction():
                await enforce_workspace_limit(user["org_id"], "retrievals", db)
                prepared = await prepare_proxy_request(
                    user["id"],
                    user["org_id"],
                    user["external_id"],
                    requested_external_id,
                    body,
                    provider,
                    disable_injection,
                    db,
                    int(user["max_memories_injected"]),
                    float(user["retrieval_threshold"]),
                    override_provider=provider,
                    override_provider_key=override_provider_key,
                    retrieval_mode=str(user.get("retrieval_mode") or "vector"),
                    namespace=namespace,
                )
        except QuotaExceeded as error:
            raise HTTPException(
                status_code=429,
                detail="retrievals limit reached",
                headers=quota_headers(error),
            ) from error
        except PermissionError as error:
            raise HTTPException(status_code=403, detail=str(error)) from error
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error
        except RuntimeError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
    finally:
        try:
            await acquire_context.__aexit__(None, None, None)
        except (asyncpg.PostgresError, OSError, ConnectionError) as error:
            logger.warning("Database connection release failed: %s", error)

    try:
        provider_stream = await open_provider_stream(prepared.body, prepared.resolved, headers)
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    response_headers = {
        "X-Engram-Conversation-ID": str(prepared.conversation_id),
        "X-Engram-Memories-Injected": str(prepared.injected_count),
    }
    if provider_stream.status_code >= 400:
        try:
            content = await provider_stream.aread()
        finally:
            await provider_stream.aclose()
        return Response(
            content=content,
            status_code=provider_stream.status_code,
            media_type=provider_stream.media_type,
            headers=response_headers,
        )

    user_id = user["id"]
    org_id = user["org_id"]
    dedup_threshold = float(user["dedup_threshold"])

    async def stream_and_extract() -> AsyncIterator[bytes]:
        buffer = b""
        assistant_parts: list[str] = []
        try:
            async for chunk in provider_stream.aiter_bytes():
                buffer += chunk
                events, buffer = split_sse_events(buffer)
                assistant_parts.extend(filter(None, (extract_assistant_response_text(event) for event in events)))
                yield chunk
        finally:
            if buffer:
                remaining_text = extract_assistant_response_text(buffer)
                if remaining_text:
                    assistant_parts.append(remaining_text)
            await provider_stream.aclose()
            assistant_text = "".join(assistant_parts)
            if not disable_extraction and assistant_text:
                try:
                    asyncio.create_task(
                        run_extraction_task(
                            user_id,
                            org_id,
                            prepared.conversation_id,
                            body,
                            build_capture_response_body(assistant_text),
                            dedup_threshold,
                            override_provider=provider,
                            override_provider_key=override_provider_key,
                            namespace=namespace,
                        )
                    )
                except Exception as error:
                    logger.warning("Failed to schedule extraction after streaming: %s", error)

    return StreamingResponse(
        stream_and_extract(),
        media_type=provider_stream.media_type,
        headers={
            **response_headers,
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


def split_sse_events(buffer: bytes) -> tuple[list[bytes], bytes]:
    events: list[bytes] = []
    while True:
        separators = [
            (index, separator)
            for separator in (b"\n\n", b"\r\n\r\n")
            if (index := buffer.find(separator)) >= 0
        ]
        if not separators:
            return events, buffer
        index, separator = min(separators, key=lambda item: item[0])
        event_end = index + len(separator)
        events.append(buffer[:event_end])
        buffer = buffer[event_end:]


async def build_cached_proxy_response(
    api_key: str,
    requested_external_id: str | None,
    provider: str,
    body: dict[str, object],
    headers: Mapping[str, str],
) -> ProxyResult:
    user = get_cached_user_by_api_key(api_key)
    if user is None:
        raise HTTPException(status_code=503, detail="Database unavailable and API key is not cached")
    try:
        return await build_proxy_passthrough_result(str(user["external_id"]), requested_external_id, body, provider, headers)
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error


def create_response(result: ProxyResult) -> Response:
    return Response(
        content=result.content,
        status_code=result.status_code,
        media_type=result.media_type,
        headers={
            "X-Engram-Conversation-ID": str(result.conversation_id),
            "X-Engram-Memories-Injected": str(result.injected_count),
        },
    )


async def parse_request_body(request: Request) -> dict[str, object]:
    try:
        payload = await request.json()
    except json.JSONDecodeError as error:
        raise HTTPException(status_code=422, detail="Invalid request body") from error
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Invalid request body")
    return payload
