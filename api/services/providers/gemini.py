import httpx

from api.config import settings
from api.services.providers.base import (
    ExtractionProvider,
    build_chat_completions_url,
    extract_chat_message_content,
    parse_memory_json,
)


class GeminiExtractionProvider(ExtractionProvider):
    async def extract(self, prompt: str) -> list[str]:
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is required for Gemini extraction")
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                build_chat_completions_url(settings.gemini_base_url),
                headers={
                    "Authorization": f"Bearer {settings.gemini_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.extraction_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                },
            )
        response.raise_for_status()
        content = extract_chat_message_content(response.json())
        return parse_memory_json(content)
