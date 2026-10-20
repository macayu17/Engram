import httpx

from api.services.providers.base import (
    ExtractionProvider,
    build_chat_completions_url,
    extract_chat_message_content,
    parse_memory_json,
)
from api.services.provider_keys import ResolvedProvider


class ChatCompletionsExtractionProvider(ExtractionProvider):
    def __init__(self, resolved: ResolvedProvider) -> None:
        self._resolved = resolved

    async def extract(self, prompt: str) -> list[str]:
        resolved = self._resolved
        local_provider = resolved.name == "ollama"
        if not local_provider and not resolved.api_key:
            raise RuntimeError(f"{resolved.name} API key is required for extraction")
        headers = {"Content-Type": "application/json"}
        if not local_provider:
            headers["Authorization"] = f"Bearer {resolved.api_key}"
        payload: dict[str, object] = {
            "model": resolved.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
        }
        if local_provider:
            payload["stream"] = False
        async with httpx.AsyncClient(timeout=120 if local_provider else 60) as client:
            response = await client.post(
                build_chat_completions_url(resolved.base_url),
                headers=headers,
                json=payload,
            )
        response.raise_for_status()
        content = extract_chat_message_content(response.json())
        return parse_memory_json(content)


OpenAIExtractionProvider = ChatCompletionsExtractionProvider
