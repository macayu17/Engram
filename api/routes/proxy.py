import asyncio
import json
import logging
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response

from api.dependencies import get_current_user, get_db
from api.services.extraction import run_extraction_task
from api.services.proxy import build_proxy_result


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/v1/chat")
async def proxy_chat(
    request: Request,
    x_engram_user_id: str = Header(...),
    x_engram_provider: str = Header(default="openai"),
    x_engram_disable_injection: bool = Header(default=False),
    x_engram_disable_extraction: bool = Header(default=False),
    db: asyncpg.Connection = Depends(get_db),
    user: asyncpg.Record = Depends(get_current_user),
) -> Response:
    body = await parse_request_body(request)
    try:
        result = await build_proxy_result(
            user["id"],
            user["external_id"],
            x_engram_user_id,
            body,
            x_engram_provider,
            x_engram_disable_injection,
            request.headers,
            db,
        )
    except PermissionError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
    if not x_engram_disable_extraction and result.status_code < 400:
        try:
            asyncio.create_task(run_extraction_task(user["id"], result.conversation_id, body, result.content))
        except Exception as error:
            logger.warning("Failed to schedule extraction: %s", error)
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
