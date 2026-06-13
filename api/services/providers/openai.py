import httpx

from api.services.providers.base import (
    ExtractionProvider,
    build_chat_completions_url,
    extract_chat_message_content,
    parse_memory_json,
)
from api.services.provider_keys import ResolvedProvider


class OpenAIExtractionProvider(ExtractionProvider):
    def __init__(self, resolved: ResolvedProvider) -> None:
        self._base_url = resolved.base_url
        self._api_key = resolved.api_key
        self._model = resolved.model

    async def extract(self, prompt: str) -> list[str]:
        if not self._api_key:
            raise RuntimeError("OpenAI API key is required for OpenAI extraction")
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                build_chat_completions_url(self._base_url),
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                },
            )
        response.raise_for_status()
        content = extract_chat_message_content(response.json())
        return parse_memory_json(content)
