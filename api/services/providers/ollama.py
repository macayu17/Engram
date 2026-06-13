import httpx

from api.services.providers.base import (
    ExtractionProvider,
    build_chat_completions_url,
    extract_chat_message_content,
    parse_memory_json,
)
from api.services.provider_keys import ResolvedProvider


class OllamaExtractionProvider(ExtractionProvider):
    def __init__(self, resolved: ResolvedProvider) -> None:
        self._base_url = resolved.base_url
        self._model = resolved.model

    async def extract(self, prompt: str) -> list[str]:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                build_chat_completions_url(self._base_url),
                headers={"Content-Type": "application/json"},
                json={
                    "model": self._model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                    "stream": False,
                },
            )
        response.raise_for_status()
        content = extract_chat_message_content(response.json())
        return parse_memory_json(content)
