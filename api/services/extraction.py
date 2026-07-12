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


RECONCILE_PROMPT = """You are a memory reconciliation system. New facts were extracted from a conversation. For each NEW FACT, decide how it relates to the user's EXISTING MEMORIES listed below it.

Decide one action per new fact:
- "ADD" if the fact is genuinely new information not covered by existing memories
- "UPDATE <memory_id>" if the fact supersedes, corrects, or contradicts that existing memory (the new fact will replace its content)
- "DISCARD" if existing memories already fully cover this fact

RULES:
1. Prefer UPDATE over ADD when the fact is a newer version of an existing memory (changed preference, corrected detail, progressed situation)
2. Only DISCARD when the fact adds nothing at all
3. Use the exact memory_id shown in the existing memory listing

OUTPUT FORMAT:
Return ONLY a valid JSON array of strings, one per new fact, in the same order as the facts. No preamble, no markdown.
Example: ["ADD", "UPDATE 3f2b8c9e-1a2b-4c5d-8e9f-0a1b2c3d4e5f", "DISCARD"]

{sections}

DECISIONS (JSON array only):"""


def get_extraction_provider(resolved: ResolvedProvider) -> ExtractionProvider:
    return build_extraction_provider(resolved)


async def extract_memories(conversation: str, resolved: ResolvedProvider) -> list[str]:
    provider = get_extraction_provider(resolved)
    return await provider.extract(EXTRACTION_PROMPT.format(conversation=conversation))


async def run_extraction_task(
    user_id: UUID,
    org_id: UUID,
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
        pool = get_pool()
        async with pool.acquire() as db:
            await record_conversation(user_id, org_id, conversation_id, request_body, response_body, "running", 0, db)
            user_row = await db.fetchrow(
                f"""
                SELECT {_USER_COLUMNS}
                FROM users
                WHERE id = $1
                  AND EXISTS (
                      SELECT 1 FROM org_memberships
                      WHERE user_id = users.id AND org_id = $2
                  )
                """,
                user_id,
                org_id,
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
        from api.services.embedding import embed_batch

        embeddings = embed_batch(extracted) if extracted else []
        candidates_per_fact: list[list[dict[str, object]]] = [[] for _ in extracted]
        if extracted and settings.enable_reconciliation:
            async with pool.acquire() as db:
                candidates_per_fact = await load_reconciliation_candidates(
                    user_id, org_id, embeddings, db, namespace
                )
        decisions = await reconcile_memories(user_id, org_id, extracted, candidates_per_fact, resolved)
        async with pool.acquire() as db:
            inserted_count, stored_refs = await store_extracted_memories(
                user_id,
                org_id,
                conversation_id,
                extracted,
                db,
                dedup_threshold,
                namespace=namespace,
                embeddings=embeddings,
                decisions=decisions,
            )
            await record_conversation(
                user_id,
                org_id,
                conversation_id,
                request_body,
                response_body,
                "completed",
                inserted_count,
                db,
            )
        if settings.enable_graph and stored_refs:
            asyncio.create_task(_run_graph_extraction(user_id, org_id, stored_refs, resolved))
    except Exception as error:
        logger.warning("Memory extraction failed: %s", error)
        try:
            async with get_pool().acquire() as db:
                await mark_conversation_failed(user_id, org_id, conversation_id, request_body, response_body, db)
        except Exception as status_error:
            logger.warning("Failed to record extraction status: %s", status_error)


async def store_extracted_memories(
    user_id: UUID,
    org_id: UUID,
    conversation_id: UUID,
    memories: list[str],
    db: asyncpg.Connection,
    dedup_threshold: float | None = None,
    namespace: str = "default",
    embeddings: list[list[float]] | None = None,
    decisions: list[tuple[str, UUID | None]] | None = None,
) -> tuple[int, list[tuple[UUID, str]]]:
    if not memories:
        return 0, []
    from api.services.embedding import embed_batch

    memory_embeddings = embed_batch(memories) if embeddings is None else embeddings
    memory_decisions = [("add", None) for _ in memories] if decisions is None else decisions
    stored_count = 0
    stored_refs: list[tuple[UUID, str]] = []
    for index, content in enumerate(memories):
        action, target_id = memory_decisions[index]
        if action == "discard":
            continue
        if action == "update" and target_id is not None:
            updated = await apply_memory_update(
                user_id, org_id, target_id, content, memory_embeddings[index], conversation_id, db
            )
            if updated is not None:
                stored_count += 1
                stored_refs.append((target_id, content))
            continue
        result = await store_memory_with_deduplication(
            user_id,
            org_id,
            content,
            memory_embeddings[index],
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


async def reconcile_memories(
    user_id: UUID,
    org_id: UUID,
    memories: list[str],
    candidates_per_fact: list[list[dict[str, object]]],
    resolved: ResolvedProvider | None,
) -> list[tuple[str, UUID | None]]:
    add_all: list[tuple[str, UUID | None]] = [("add", None) for _ in memories]
    if not settings.enable_reconciliation or resolved is None:
        return add_all
    if not any(candidates_per_fact):
        return add_all
    sections: list[str] = []
    for index, content in enumerate(memories):
        sections.append(f"NEW FACT {index + 1}: {content}")
        if candidates_per_fact[index]:
            sections.append("EXISTING MEMORIES:")
            sections.extend(f"  {row['id']}: {row['content']}" for row in candidates_per_fact[index])
        else:
            sections.append("EXISTING MEMORIES: none")
    try:
        provider = get_extraction_provider(resolved)
        raw_decisions = await provider.extract(RECONCILE_PROMPT.format(sections="\n".join(sections)))
        return parse_reconcile_decisions(raw_decisions, candidates_per_fact)
    except Exception as error:
        logger.warning("Memory reconciliation failed, storing all facts: %s", error)
        return add_all


async def load_reconciliation_candidates(
    user_id: UUID,
    org_id: UUID,
    embeddings: list[list[float]],
    db: asyncpg.Connection,
    namespace: str = "default",
) -> list[list[dict[str, object]]]:
    from api.services.embedding import format_embedding_for_pgvector

    candidates_per_fact: list[list[dict[str, object]]] = []
    for embedding in embeddings:
        rows = await db.fetch(
            """
            SELECT id, content, 1 - (embedding <=> $1::vector) AS score
            FROM memories
            WHERE user_id = $2
              AND org_id = $3
              AND namespace = $4
              AND status IN ('approved', 'pending')
              AND 1 - (embedding <=> $1::vector) >= $5
              AND 1 - (embedding <=> $1::vector) < $6
            ORDER BY score DESC
            LIMIT 3
            """,
            format_embedding_for_pgvector(embedding),
            user_id,
            org_id,
            namespace,
            settings.reconcile_threshold,
            settings.memory_refinement_threshold,
        )
        candidates_per_fact.append([dict(row) for row in rows])
    return candidates_per_fact


def parse_reconcile_decisions(
    raw_decisions: list[str],
    candidates_per_fact: list[list[dict[str, object]]],
) -> list[tuple[str, UUID | None]]:
    decisions: list[tuple[str, UUID | None]] = []
    for index in range(len(candidates_per_fact)):
        raw = raw_decisions[index].strip() if index < len(raw_decisions) else "ADD"
        normalized = raw.upper()
        if normalized == "DISCARD":
            decisions.append(("discard", None))
            continue
        if normalized.startswith("UPDATE"):
            target = parse_update_target(raw, candidates_per_fact[index])
            if target is not None:
                decisions.append(("update", target))
                continue
        decisions.append(("add", None))
    return decisions


def parse_update_target(raw_decision: str, candidates: list[dict[str, object]]) -> UUID | None:
    parts = raw_decision.split()
    if len(parts) < 2:
        return None
    try:
        target = UUID(parts[1])
    except ValueError:
        return None
    candidate_ids = {row["id"] for row in candidates}
    return target if target in candidate_ids else None


async def apply_memory_update(
    user_id: UUID,
    org_id: UUID,
    memory_id: UUID,
    content: str,
    embedding: list[float],
    conversation_id: UUID,
    db: asyncpg.Connection,
) -> dict[str, object] | None:
    from api.services.embedding import format_embedding_for_pgvector

    row = await db.fetchrow(
        """
        UPDATE memories
        SET content = $1,
            embedding = $2::vector,
            source_conversation_id = $3,
            category = $4,
            source = 'extraction'
        WHERE user_id = $5
          AND org_id = $6
          AND id = $7
        RETURNING id
        """,
        content,
        format_embedding_for_pgvector(embedding),
        conversation_id,
        infer_category(content),
        user_id,
        org_id,
        memory_id,
    )
    return dict(row) if row is not None else None


async def _run_graph_extraction(
    user_id: UUID,
    org_id: UUID,
    memory_refs: list[tuple[UUID, str]],
    resolved: ResolvedProvider,
) -> None:
    if not memory_refs:
        return
    from api.services.graph import extract_entities_for_memory

    pool = get_pool()
    semaphore = asyncio.Semaphore(3)

    async def _one(memory_id: UUID, content: str) -> None:
        async with semaphore:
            try:
                async with pool.acquire() as db:
                    await extract_entities_for_memory(user_id, org_id, memory_id, content, resolved, db)
            except Exception as inner_error:
                logger.warning("Entity extraction failed for memory %s: %s", memory_id, inner_error)

    try:
        await asyncio.gather(*(_one(mid, content) for mid, content in memory_refs))
    except Exception as outer_error:
        logger.warning("Graph extraction task failed: %s", outer_error)


async def capture_conversation_memories(
    user_id: UUID,
    org_id: UUID,
    user_message: str,
    assistant_response: str,
    source: str,
    session_id: str | None,
    dedup_threshold: float | None = None,
    override_provider: str | None = None,
    override_provider_key: str | None = None,
) -> dict[str, object]:
    conversation_id = uuid4()
    request_body = build_capture_request_body(user_message, assistant_response, source, session_id)
    response_body = build_capture_response_body(assistant_response)
    conversation = build_capture_conversation_text(user_message, assistant_response)
    pool = get_pool()
    async with pool.acquire() as db:
        user_row = await db.fetchrow(
            f"""
            SELECT {_USER_COLUMNS}
            FROM users
            WHERE id = $1
              AND EXISTS (
                  SELECT 1 FROM org_memberships
                  WHERE user_id = users.id AND org_id = $2
              )
            """,
            user_id,
            org_id,
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
    from api.services.embedding import embed_batch

    embeddings = embed_batch(extracted_memories) if extracted_memories else []
    candidates_per_fact: list[list[dict[str, object]]] = [[] for _ in extracted_memories]
    if extracted_memories and settings.enable_reconciliation:
        async with pool.acquire() as db:
            candidates_per_fact = await load_reconciliation_candidates(
                user_id, org_id, embeddings, db
            )
    decisions = await reconcile_memories(
        user_id, org_id, extracted_memories, candidates_per_fact, resolved
    )
    memories_extracted = 0
    stored_refs: list[tuple[UUID, str]] = []
    async with pool.acquire() as db:
        if extracted_memories:
            memories_extracted, stored_refs = await store_extracted_memories(
                user_id,
                org_id,
                conversation_id,
                extracted_memories,
                db,
                dedup_threshold,
                embeddings=embeddings,
                decisions=decisions,
            )
        await record_conversation(
            user_id, org_id, conversation_id, request_body, response_body, "completed", memories_extracted, db
        )
    if settings.enable_graph and stored_refs:
        asyncio.create_task(_run_graph_extraction(user_id, org_id, stored_refs, resolved))
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
        return extract_sse_response_text(response_body)
    return extract_assistant_payload_text(decoded)


def extract_sse_response_text(response_body: bytes) -> str:
    text_parts: list[str] = []
    for line in response_body.decode("utf-8", errors="replace").splitlines():
        if not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if not data or data == "[DONE]":
            continue
        try:
            payload: object = json.loads(data)
        except json.JSONDecodeError:
            continue
        text = extract_assistant_payload_text(payload)
        if text:
            text_parts.append(text)
    return "".join(text_parts)


def extract_assistant_payload_text(decoded: object) -> str:
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
            delta = first_choice.get("delta")
            if isinstance(delta, dict):
                delta_content = stringify_message_content(delta.get("content"))
                if delta_content:
                    return delta_content
    delta = decoded.get("delta")
    if isinstance(delta, dict) and isinstance(delta.get("text"), str):
        return delta["text"]
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
    org_id: UUID,
    conversation_id: UUID,
    request_body: dict[str, object],
    response_body: bytes,
    status: str,
    memories_extracted: int,
    db: asyncpg.Connection,
) -> None:
    await db.execute(
        """
        INSERT INTO conversations (id, user_id, org_id, extraction_status, memories_extracted, raw_exchange)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET extraction_status = EXCLUDED.extraction_status,
            memories_extracted = EXCLUDED.memories_extracted,
            raw_exchange = EXCLUDED.raw_exchange
        WHERE conversations.user_id = EXCLUDED.user_id
          AND conversations.org_id = EXCLUDED.org_id
        """,
        conversation_id,
        user_id,
        org_id,
        status,
        memories_extracted,
        json.dumps({"request": request_body, "response": response_body.decode("utf-8", errors="replace")}),
    )


async def mark_conversation_failed(
    user_id: UUID,
    org_id: UUID,
    conversation_id: UUID,
    request_body: dict[str, object],
    response_body: bytes,
    db: asyncpg.Connection,
) -> None:
    await record_conversation(user_id, org_id, conversation_id, request_body, response_body, "failed", 0, db)
