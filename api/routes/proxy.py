import asyncio
from collections.abc import Mapping
import json
import logging

import asyncpg
from fastapi import APIRouter, Header, HTTPException, Request, Response

from api.db.connection import get_pool
from api.services.extraction import run_extraction_task
from api.services.proxy import ProxyResult, build_proxy_passthrough_result, build_proxy_result
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
) -> Response:
    body = await parse_request_body(request)
    result = await build_proxy_response_with_available_auth(
        x_engram_key,
        x_engram_user_id,
        x_engram_provider,
        x_engram_disable_injection,
        x_engram_disable_extraction,
        body,
        request.headers,
    )
    return create_response(result)


async def build_proxy_response_with_available_auth(
    api_key: str,
    requested_external_id: str,
    provider: str,
    disable_injection: bool,
    disable_extraction: bool,
    body: dict[str, object],
    headers: Mapping[str, str],
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
        result = await build_proxy_result(
            user["id"],
            user["external_id"],
            requested_external_id,
            body,
            provider,
            disable_injection,
            headers,
            db,
            int(user["max_memories_injected"]),
            float(user["retrieval_threshold"]),
        )
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
    if not disable_extraction and result.status_code < 400:
        try:
            asyncio.create_task(run_extraction_task(user["id"], result.conversation_id, body, result.content, float(user["dedup_threshold"])))
        except Exception as error:
            logger.warning("Failed to schedule extraction: %s", error)
    return result


async def build_cached_proxy_response(
    api_key: str,
    requested_external_id: str,
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
