from abc import ABC, abstractmethod
import json


class ExtractionProvider(ABC):
    @abstractmethod
    async def extract(self, prompt: str) -> list[str]:
        raise NotImplementedError


def parse_memory_json(content: str) -> list[str]:
    parsed = json.loads(content)
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
    if not isinstance(message, dict):
        raise ValueError("Provider choice did not include a message")
    content = message.get("content")
    if not isinstance(content, str):
        raise ValueError("Provider message did not include text content")
    return content
