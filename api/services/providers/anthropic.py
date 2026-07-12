import httpx

from api.services.providers.base import ExtractionProvider, parse_memory_json
from api.services.provider_keys import ResolvedProvider


class AnthropicExtractionProvider(ExtractionProvider):
    def __init__(self, resolved: ResolvedProvider) -> None:
        self._base_url = resolved.base_url
        self._api_key = resolved.api_key
        self._model = resolved.model

    async def extract(self, prompt: str) -> list[str]:
        if not self._api_key:
            raise RuntimeError("Anthropic API key is required for Anthropic extraction")
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{self._base_url.rstrip('/')}/messages",
                headers={
                    "x-api-key": self._api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self._model,
                    "max_tokens": 1024,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                },
            )
        response.raise_for_status()
        payload = response.json()
        content = payload.get("content") if isinstance(payload, dict) else None
        if not isinstance(content, list):
            raise ValueError("Anthropic response did not include content")
        text = "".join(
            item["text"]
            for item in content
            if isinstance(item, dict) and item.get("type") == "text" and isinstance(item.get("text"), str)
        )
        return parse_memory_json(text)
