import asyncio
import json
import logging
from uuid import UUID, uuid4

import asyncpg
from fastapi import HTTPException

from api.config import settings
from api.db.connection import get_pool


logger = logging.getLogger(__name__)
_extraction_tasks: set[asyncio.Task[None]] = set()


async def redact_override(value: object, override_key: str) -> object:
    if isinstance(value, str):
        return value.replace(override_key, "[redacted]")
    if isinstance(value, dict):
        return {name.replace(override_key, "[redacted]"): await redact_override(item, override_key) for name, item in value.items()}
    if isinstance(value, list):
        return [await redact_override(item, override_key) for item in value]
    return value


async def persist_job(
    user_id: UUID,
    org_id: UUID,
    conversation_id: UUID,
    request_body: dict[str, object],
    response_body: bytes,
    dedup_threshold: float | None = None,
    override_provider: str | None = None,
    override_provider_key: str | None = None,
    namespace: str = "default",
) -> bool:
    persisted_request = {**request_body, "namespace": namespace}
    exchange = {"request": persisted_request, "response": response_body.decode("utf-8", errors="replace")}
    if override_provider_key:
        exchange = await redact_override(exchange, override_provider_key)
    payload = json.dumps(exchange)
    if len(payload.encode("utf-8")) > 2 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Conversation exceeds the extraction payload limit")
    options = json.dumps({"dedup_threshold": dedup_threshold, "override_provider": override_provider})
    async with get_pool().acquire() as db:
        inserted = await db.fetchval(
            """INSERT INTO conversations (id, user_id, org_id, namespace, extraction_status, raw_exchange, recoverable, extraction_options)
            VALUES ($1, $2, $3, $4, 'pending', $5::jsonb, $6, $7::jsonb)
            ON CONFLICT (id) DO NOTHING RETURNING id""",
            conversation_id, user_id, org_id, namespace, payload, not bool(override_provider_key), options,
        )
    return inserted is not None


async def queue_extraction(
    user_id: UUID, org_id: UUID, conversation_id: UUID, request_body: dict[str, object],
    response_body: bytes, dedup_threshold: float | None = None, override_provider: str | None = None,
    override_provider_key: str | None = None, namespace: str = "default",
) -> None:
    inserted = await persist_job(user_id, org_id, conversation_id, request_body, response_body, dedup_threshold, override_provider, override_provider_key, namespace)
    if inserted:
        task = asyncio.create_task(run_queued_job(conversation_id, override_provider_key))
        _extraction_tasks.add(task)
        task.add_done_callback(_extraction_tasks.discard)


async def claim_job(
    db: asyncpg.Connection,
    conversation_id: UUID | None = None,
    allow_ephemeral: bool = False,
) -> asyncpg.Record | None:
    return await db.fetchrow(
        """WITH candidate AS (
            SELECT conversations.id FROM conversations
            WHERE ($1::uuid IS NULL OR conversations.id = $1)
              AND (recoverable OR ($3 AND conversations.id = $1))
              AND raw_exchange IS NOT NULL AND attempts < $2
              AND next_attempt_at <= now()
              AND (extraction_status IN ('pending', 'failed')
                   OR (extraction_status = 'running' AND lease_until <= now()))
              AND EXISTS (SELECT 1 FROM org_memberships
                  WHERE org_memberships.user_id = conversations.user_id AND org_memberships.org_id = conversations.org_id)
            ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1
        ) UPDATE conversations SET extraction_status = 'running', attempts = attempts + 1,
            lease_token = $4, lease_until = now() + $5 * interval '1 second', last_error = NULL
        FROM candidate WHERE conversations.id = candidate.id RETURNING conversations.*""",
        conversation_id, settings.extraction_job_max_attempts, allow_ephemeral, uuid4(), settings.extraction_job_lease_seconds,
    )


async def finish_failed_job(job: asyncpg.Record, cancelled: bool = False) -> None:
    async with get_pool().acquire() as db:
        await db.execute(
            """UPDATE conversations SET extraction_status = $3, last_error = $4,
                lease_token = NULL, lease_until = NULL,
                next_attempt_at = now() + $5 * interval '1 second'
            WHERE id = $1 AND lease_token = $2 AND extraction_status = 'running'""",
            job["id"], job["lease_token"], "pending" if cancelled and job["recoverable"] else "failed",
            "Extraction interrupted; awaiting retry" if cancelled and job["recoverable"] else "Extraction failed; check provider configuration and retry" if job["recoverable"] else "Extraction failed; the temporary provider key was not retained. Capture again to retry",
            0 if cancelled else min(300, 5 * 2 ** min(int(job["attempts"]) - 1, 6)),
        )


async def process_claimed_job(job: asyncpg.Record, override_provider_key: str | None = None, propagate_errors: bool = False) -> tuple[int, list[str]] | None:
    try:
        from api.services.extraction import build_conversation_text, process_conversation_memories

        raw_exchange = job["raw_exchange"]
        payload = json.loads(raw_exchange) if isinstance(raw_exchange, str) else raw_exchange
        raw_options = job["extraction_options"]
        options = json.loads(raw_options) if isinstance(raw_options, str) else raw_options
        if not isinstance(payload, dict) or not isinstance(payload.get("request"), dict) or not isinstance(payload.get("response"), str) or not isinstance(options, dict):
            raise ValueError("Invalid extraction payload")
        request_body = {**payload["request"], "namespace": job["namespace"]}
        response_body = payload["response"].encode("utf-8")
        async with asyncio.timeout(max(1, settings.extraction_job_lease_seconds - 1)):
            return await process_conversation_memories(
                job["user_id"], job["org_id"], job["id"], request_body, response_body,
                build_conversation_text(request_body, response_body), options.get("dedup_threshold"),
                options.get("override_provider"), override_provider_key, namespace=job["namespace"], job_token=job["lease_token"],
            )
    except asyncio.CancelledError:
        try:
            await finish_failed_job(job, cancelled=True)
        except Exception:
            logger.warning("Could not release cancelled extraction lease")
        raise
    except Exception:
        logger.warning("Conversation extraction failed")
        try:
            await finish_failed_job(job)
        except Exception:
            logger.warning("Could not record failed extraction attempt")
        if propagate_errors:
            raise


async def run_queued_job(conversation_id: UUID, override_provider_key: str | None = None) -> None:
    try:
        async with get_pool().acquire() as db:
            job = await claim_job(db, conversation_id, allow_ephemeral=bool(override_provider_key))
        if job is not None:
            await process_claimed_job(job, override_provider_key)
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.warning("Could not claim queued extraction")


async def expire_exhausted_jobs(db: asyncpg.Connection) -> None:
    await db.execute(
        """UPDATE conversations SET extraction_status = 'failed', lease_until = NULL, lease_token = NULL,
            last_error = CASE WHEN recoverable THEN 'Extraction attempts exhausted; check configuration and retry'
                ELSE 'Temporary provider key unavailable; capture again to retry' END
        WHERE extraction_status IN ('pending', 'running') AND (
            (attempts >= $1 AND (lease_until IS NULL OR lease_until <= now())) OR
            (NOT recoverable AND ((extraction_status = 'running' AND lease_until <= now()) OR
                (extraction_status = 'pending' AND created_at < now() - $2 * interval '1 second'))))""",
        settings.extraction_job_max_attempts, settings.extraction_job_lease_seconds,
    )


async def extraction_worker() -> None:
    while True:
        try:
            async with get_pool().acquire() as db:
                await expire_exhausted_jobs(db)
                job = await claim_job(db)
            if job is not None:
                await process_claimed_job(job)
                continue
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.warning("Extraction recovery worker could not poll jobs")
        await asyncio.sleep(settings.extraction_job_poll_seconds)


async def shutdown_extraction_tasks() -> None:
    tasks = list(_extraction_tasks)
    for task in tasks:
        task.cancel()
    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def list_jobs(user_id: object, org_id: object, namespace: str, db: asyncpg.Connection) -> list[dict[str, object]]:
    rows = await db.fetch(
        """SELECT id, extraction_status, memories_extracted, created_at, attempts,
            last_error, namespace, recoverable FROM conversations
        WHERE user_id = $1 AND org_id = $2 AND namespace = $3
        ORDER BY created_at DESC LIMIT 50""", user_id, org_id, namespace,
    )
    return [dict(row) for row in rows]


async def retry_job(user_id: object, org_id: object, conversation_id: UUID, namespace: str, db: asyncpg.Connection) -> None:
    updated = await db.fetchval(
        """UPDATE conversations SET extraction_status = 'pending', attempts = 0, last_error = NULL,
            next_attempt_at = now(), lease_until = NULL, lease_token = NULL
        WHERE id = $1 AND user_id = $2 AND org_id = $3 AND namespace = $4
          AND extraction_status = 'failed' AND recoverable AND raw_exchange IS NOT NULL
          AND (lease_until IS NULL OR lease_until <= now()) RETURNING id""",
        conversation_id, user_id, org_id, namespace,
    )
    if updated is None:
        raise HTTPException(status_code=409, detail="Capture is unavailable or cannot be retried")


async def clear_captures(user_id: object, org_id: object, older_than_days: int, namespace: str, db: asyncpg.Connection) -> int:
    count = await db.fetchval(
        """WITH cleared AS (UPDATE conversations SET raw_exchange = NULL, recoverable = false
        WHERE user_id = $1 AND org_id = $2 AND namespace = $3
          AND created_at < now() - $4 * interval '1 day'
          AND extraction_status IN ('completed', 'failed') AND raw_exchange IS NOT NULL
          AND (lease_until IS NULL OR lease_until <= now()) RETURNING id)
        SELECT count(*) FROM cleared""", user_id, org_id, namespace, older_than_days,
    )
    return int(count)
