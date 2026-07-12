import json

import pytest

from api.services.extraction import build_conversation_text, extract_assistant_response_text
from api.services.providers.base import extract_chat_message_content, parse_memory_json


def test_build_conversation_text_includes_text_content_parts() -> None:
    conversation_text = build_conversation_text(
        {
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "I use FastAPI for backend work."},
                        {"type": "input_text", "text": "I use TypeScript for frontend work."},
                    ],
                }
            ]
        },
        json.dumps({"choices": [{"message": {"content": "Saved."}}]}).encode("utf-8"),
    )

    assert "user: I use FastAPI for backend work.\nI use TypeScript for frontend work." in conversation_text
    assert "assistant: Saved." in conversation_text


def test_extract_assistant_response_text_handles_message_content_parts() -> None:
    response_body = json.dumps(
        {
            "choices": [
                {
                    "message": {
                        "content": [
                            {"type": "text", "text": "First assistant part."},
                            {"type": "text", "text": "Second assistant part."},
                        ]
                    }
                }
            ]
        }
    ).encode("utf-8")

    assert extract_assistant_response_text(response_body) == "First assistant part.\nSecond assistant part."


def test_extract_assistant_response_text_handles_openai_sse() -> None:
    chunks = b'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\ndata: {"choices":[{"delta":{"content":"world"}}]}\n\ndata: [DONE]\n\n'

    assert extract_assistant_response_text(chunks) == "Hello world"


def test_extract_assistant_response_text_handles_anthropic_sse() -> None:
    chunks = b'event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello "}}\n\nevent: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"world"}}\n\n'

    assert extract_assistant_response_text(chunks) == "Hello world"


def test_extract_chat_message_content_accepts_text_choice_fallback() -> None:
    payload = {"choices": [{"text": "[\"User prefers concise answers\"]"}]}

    assert extract_chat_message_content(payload) == "[\"User prefers concise answers\"]"


def test_parse_memory_json_strips_markdown_json_fence() -> None:
    memories = parse_memory_json("```json\n[\"User prefers FastAPI\"]\n```")

    assert memories == ["User prefers FastAPI"]


def test_parse_memory_json_rejects_non_string_items() -> None:
    with pytest.raises(ValueError):
        parse_memory_json("[\"valid\", 123]")
