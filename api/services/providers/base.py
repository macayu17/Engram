from abc import ABC, abstractmethod
import json


class ExtractionProvider(ABC):
    @abstractmethod
    async def extract(self, prompt: str) -> list[str]:
        raise NotImplementedError


def parse_memory_json(content: str) -> list[str]:
    parsed = json.loads(strip_json_fence(content))
    if not isinstance(parsed, list):
        raise ValueError("Extraction provider returned non-array JSON")
    memories: list[str] = []
    for item in parsed:
        if not isinstance(item, str):
            raise ValueError("Extraction provider returned a non-string memory")
        stripped = item.strip()
        if stripped:
            memories.append(stripped)
    return memories[:5]


def build_chat_completions_url(base_url: str) -> str:
    normalized = base_url.rstrip("/")
    if normalized.endswith("/chat/completions"):
        return normalized
    return f"{normalized}/chat/completions"


def extract_chat_message_content(payload: object) -> str:
    if not isinstance(payload, dict):
        raise ValueError("Provider response was not a JSON object")
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ValueError("Provider response did not include choices")
    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise ValueError("Provider choice was not a JSON object")
    message = first_choice.get("message")
    if isinstance(message, dict):
        content = message.get("content")
        if isinstance(content, str):
            return content
        content_blocks = extract_text_content_parts(content)
        if content_blocks:
            return content_blocks
    text = first_choice.get("text")
    if isinstance(text, str):
        return text
    raise ValueError("Provider response did not include text content")


def strip_json_fence(content: str) -> str:
    stripped = content.strip()
    if not stripped.startswith("```"):
        return stripped
    lines = stripped.splitlines()
    if len(lines) >= 3 and lines[-1].strip() == "```":
        return "\n".join(lines[1:-1]).strip()
    return stripped


def extract_text_content_parts(content: object) -> str:
    if not isinstance(content, list):
        return ""
    parts = [
        part["text"]
        for part in content
        if isinstance(part, dict) and isinstance(part.get("text"), str)
    ]
    return "\n".join(parts)
