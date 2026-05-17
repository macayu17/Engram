import json
import logging
from uuid import UUID

import asyncpg

from api.config import settings
from api.db.connection import get_pool
from api.services.deduplication import store_memory_with_deduplication
from api.services.embedding import embed_batch
from api.services.providers.base import ExtractionProvider
from api.services.providers.gemini import GeminiExtractionProvider
from api.services.providers.ollama import OllamaExtractionProvider
from api.services.providers.openai import OpenAIExtractionProvider


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


def get_extraction_provider() -> ExtractionProvider:
    provider = settings.extraction_provider.lower()
    if provider == "openai":
        return OpenAIExtractionProvider()
    if provider == "gemini":
        return GeminiExtractionProvider()
    if provider == "ollama":
        return OllamaExtractionProvider()
    raise RuntimeError(f"Unsupported extraction provider: {settings.extraction_provider}")


async def extract_memories(conversation: str) -> list[str]:
    provider = get_extraction_provider()
    return await provider.extract(EXTRACTION_PROMPT.format(conversation=conversation))


async def run_extraction_task(
    user_id: UUID,
    conversation_id: UUID,
    request_body: dict[str, object],
    response_body: bytes,
) -> None:
    try:
        conversation = build_conversation_text(request_body, response_body)
        async with get_pool().acquire() as db:
            await record_conversation(user_id, conversation_id, request_body, response_body, "running", 0, db)
            extracted = await extract_memories(conversation)
            inserted_count = await store_extracted_memories(user_id, conversation_id, extracted, db)
            await record_conversation(
                user_id,
                conversation_id,
                request_body,
                response_body,
                "completed",
                inserted_count,
                db,
            )
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
) -> int:
    if not memories:
        return 0
    embeddings = embed_batch(memories)
    stored_count = 0
    for index, content in enumerate(memories):
        result = await store_memory_with_deduplication(
            user_id,
            content,
            embeddings[index],
            conversation_id,
            1.0,
            db,
        )
        if result["action"] in {"inserted", "updated"}:
            stored_count += 1
    return stored_count


def build_conversation_text(request_body: dict[str, object], response_body: bytes) -> str:
    messages = request_body.get("messages")
    lines: list[str] = []
    if isinstance(messages, list):
        for message in messages:
            if not isinstance(message, dict):
                continue
            role = message.get("role")
            content = message.get("content")
            if isinstance(role, str) and isinstance(content, str):
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
            if isinstance(message, dict) and isinstance(message.get("content"), str):
                return message["content"]
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
