import asyncio
import json
import logging
from uuid import UUID
from uuid import uuid4

import asyncpg

from api.config import settings
from api.services.users import _USER_COLUMNS
from api.db.connection import get_pool
from api.services.deduplication import store_memory_with_deduplication
from api.services.memories import infer_category
from api.services.providers.base import ExtractionProvider
from api.services.providers.factory import build_extraction_provider
from api.services.provider_keys import ProviderConfigError, resolve_user_provider, ResolvedProvider


logger = logging.getLogger(__name__)

EXTRACTION_PROMPT = """You are a precise memory extraction system for an AI assistant. Your job is to extract durable, useful facts about the USER from a conversation.

RULES:
1. Extract facts ONLY about the user, not about the assistant, not about general topics
2. Only extract things likely to remain true over time, such as preferences, projects, skills, context, corrections
3. Do NOT extract greetings, pleasantries, one-off questions, or things the assistant said
4. Do NOT extract obvious or trivially true things
5. Be specific and concrete. Bad: "user likes coding". Good: "user prefers FastAPI over Flask for Python backends"
6. If the user corrected the assistant, extract the correction as a fact
7. Maximum 5 memories per conversation. Quality over quantity
8. If nothing worth remembering was said, return an empty array

OUTPUT FORMAT:
Return ONLY a valid JSON array of strings. No preamble, no explanation, no markdown.
Example: ["User is a 3rd year CS student", "User prefers FastAPI for backends"]
Empty: []

CONVERSATION:
{conversation}

MEMORIES (JSON array only):"""


def get_extraction_provider(resolved: ResolvedProvider) -> ExtractionProvider:
    return build_extraction_provider(resolved)


async def extract_memories(conversation: str, resolved: ResolvedProvider) -> list[str]:
    provider = get_extraction_provider(resolved)
    return await provider.extract(EXTRACTION_PROMPT.format(conversation=conversation))


async def run_extraction_task(
    user_id: UUID,
    conversation_id: UUID,
    request_body: dict[str, object],
    response_body: bytes,
    dedup_threshold: float | None = None,
    override_provider: str | None = None,
    override_provider_key: str | None = None,
    namespace: str = "default",
) -> None:
    try:
        conversation = build_conversation_text(request_body, response_body)
        async with get_pool().acquire() as db:
            await record_conversation(user_id, conversation_id, request_body, response_body, "running", 0, db)
            user_row = await db.fetchrow(
                f"""
                SELECT {_USER_COLUMNS}
                FROM users
                WHERE id = $1
                """,
                user_id,
            )
            if user_row is None:
                raise RuntimeError("User not found during extraction")
            try:
                resolved = resolve_user_provider(
                    user_row,
                    override_provider=override_provider,
                    override_key=override_provider_key,
                )
            except ProviderConfigError as error:
                raise RuntimeError(str(error)) from error
            extracted = await extract_memories(conversation, resolved)
            inserted_count, stored_refs = await store_extracted_memories(
                user_id, conversation_id, extracted, db, dedup_threshold, namespace=namespace
            )
            await record_conversation(
                user_id,
                conversation_id,
                request_body,
                response_body,
                "completed",
                inserted_count,
                db,
            )
        if settings.enable_graph and stored_refs:
            asyncio.create_task(_run_graph_extraction(user_id, stored_refs, resolved))
    except Exception as error:
        logger.warning("Memory extraction failed: %s", error)
        try:
            async with get_pool().acquire() as db:
                await mark_conversation_failed(user_id, conversation_id, request_body, response_body, db)
        except Exception as status_error:
            logger.warning("Failed to record extraction status: %s", status_error)


async def store_extracted_memories(
    user_id: UUID,
    conversation_id: UUID,
    memories: list[str],
    db: asyncpg.Connection,
    dedup_threshold: float | None = None,
    namespace: str = "default",
) -> tuple[int, list[tuple[UUID, str]]]:
    if not memories:
        return 0, []
    from api.services.embedding import embed_batch

    embeddings = embed_batch(memories)
    stored_count = 0
    stored_refs: list[tuple[UUID, str]] = []
    for index, content in enumerate(memories):
        result = await store_memory_with_deduplication(
            user_id,
            content,
            embeddings[index],
            conversation_id,
            1.0,
            db,
            dedup_threshold,
            "pending",
            infer_category(content),
            "extraction",
            namespace=namespace,
        )
        if result["action"] in {"inserted", "updated"} and result["memory"] is not None:
            stored_count += 1
            memory_id = result["memory"].get("id")
            if isinstance(memory_id, UUID):
                stored_refs.append((memory_id, content))
    return stored_count, stored_refs


async def _run_graph_extraction(
    user_id: UUID,
    memory_refs: list[tuple[UUID, str]],
    resolved: ResolvedProvider,
) -> None:
    if not memory_refs:
        return
    from api.services.graph import extract_entities_for_memory

    try:
        async with get_pool().acquire() as db:
            for memory_id, content in memory_refs:
                try:
                    await extract_entities_for_memory(memory_id, content, user_id, resolved, db)
                except Exception as inner_error:
                    logger.warning("Entity extraction failed for memory %s: %s", memory_id, inner_error)
    except Exception as outer_error:
        logger.warning("Graph extraction task failed: %s", outer_error)


async def capture_conversation_memories(
    user_id: UUID,
    user_message: str,
    assistant_response: str,
    source: str,
    session_id: str | None,
    db: asyncpg.Connection,
    dedup_threshold: float | None = None,
    override_provider: str | None = None,
    override_provider_key: str | None = None,
) -> dict[str, object]:
    conversation_id = uuid4()
    request_body = build_capture_request_body(user_message, assistant_response, source, session_id)
    response_body = build_capture_response_body(assistant_response)
    conversation = build_capture_conversation_text(user_message, assistant_response)
    user_row = await db.fetchrow(
        f"""
        SELECT {_USER_COLUMNS}
        FROM users
        WHERE id = $1
        """,
        user_id,
    )
    if user_row is None:
        raise RuntimeError("User not found during capture")
    try:
        resolved = resolve_user_provider(
            user_row,
            override_provider=override_provider,
            override_key=override_provider_key,
        )
    except ProviderConfigError as error:
        raise RuntimeError(str(error)) from error
    extracted_memories = await extract_memories(conversation, resolved)
    memories_extracted = 0
    stored_refs: list[tuple[UUID, str]] = []
    if extracted_memories:
        memories_extracted, stored_refs = await store_extracted_memories(
            user_id, conversation_id, extracted_memories, db, dedup_threshold
        )
    await record_conversation(user_id, conversation_id, request_body, response_body, "completed", memories_extracted, db)
    if settings.enable_graph and stored_refs:
        asyncio.create_task(_run_graph_extraction(user_id, stored_refs, resolved))
    return {
        "conversation_id": conversation_id,
        "memories_extracted": memories_extracted,
        "extracted_memories": extracted_memories,
        "source": source,
        "session_id": session_id,
    }


def build_capture_request_body(
    user_message: str,
    assistant_response: str,
    source: str,
    session_id: str | None,
) -> dict[str, object]:
    return {
        "messages": [
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": assistant_response},
        ],
        "source": source,
        "session_id": session_id,
    }


def build_capture_response_body(assistant_response: str) -> bytes:
    return json.dumps({
        "choices": [
            {
                "message": {
                    "role": "assistant",
                    "content": assistant_response,
                },
            },
        ],
    }).encode("utf-8")


def build_capture_conversation_text(user_message: str, assistant_response: str) -> str:
    return f"user: {user_message}\nassistant: {assistant_response}"


def build_conversation_text(request_body: dict[str, object], response_body: bytes) -> str:
    messages = request_body.get("messages")
    lines: list[str] = []
    if isinstance(messages, list):
        for message in messages:
            if not isinstance(message, dict):
                continue
            role = message.get("role")
            content = stringify_message_content(message.get("content"))
            if isinstance(role, str) and content:
                lines.append(f"{role}: {content}")
    assistant_text = extract_assistant_response_text(response_body)
    if assistant_text:
        lines.append(f"assistant: {assistant_text}")
    return "\n".join(lines)


def extract_assistant_response_text(response_body: bytes) -> str:
    try:
        decoded: object = json.loads(response_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return ""
    if not isinstance(decoded, dict):
        return ""
    choices = decoded.get("choices")
    if isinstance(choices, list) and choices:
        first_choice = choices[0]
        if isinstance(first_choice, dict):
            message = first_choice.get("message")
            if isinstance(message, dict):
                message_content = stringify_message_content(message.get("content"))
                if message_content:
                    return message_content
            text = first_choice.get("text")
            if isinstance(text, str):
                return text
    content = decoded.get("content")
    if isinstance(content, list):
        text_parts = [
            part["text"]
            for part in content
            if isinstance(part, dict) and part.get("type") == "text" and isinstance(part.get("text"), str)
        ]
        return "\n".join(text_parts)
    return ""


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


async def record_conversation(
    user_id: UUID,
    conversation_id: UUID,
    request_body: dict[str, object],
    response_body: bytes,
    status: str,
    memories_extracted: int,
    db: asyncpg.Connection,
) -> None:
    await db.execute(
        """
        INSERT INTO conversations (id, user_id, extraction_status, memories_extracted, raw_exchange)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET extraction_status = EXCLUDED.extraction_status,
            memories_extracted = EXCLUDED.memories_extracted,
            raw_exchange = EXCLUDED.raw_exchange
        """,
        conversation_id,
        user_id,
        status,
        memories_extracted,
        json.dumps({"request": request_body, "response": response_body.decode("utf-8", errors="replace")}),
    )


async def mark_conversation_failed(
    user_id: UUID,
    conversation_id: UUID,
    request_body: dict[str, object],
    response_body: bytes,
    db: asyncpg.Connection,
) -> None:
    await record_conversation(user_id, conversation_id, request_body, response_body, "failed", 0, db)
