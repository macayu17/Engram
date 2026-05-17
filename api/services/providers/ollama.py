import httpx

from api.config import settings
from api.services.providers.base import (
    ExtractionProvider,
    build_chat_completions_url,
    extract_chat_message_content,
    parse_memory_json,
)


class OllamaExtractionProvider(ExtractionProvider):
    async def extract(self, prompt: str) -> list[str]:
        async with httpx.AsyncClient(timeout=120) as client:
            response = await client.post(
                build_chat_completions_url(f"{settings.ollama_base_url.rstrip('/')}/v1"),
                headers={"Content-Type": "application/json"},
                json={
                    "model": settings.ollama_model,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                    "stream": False,
                },
            )
        response.raise_for_status()
        content = extract_chat_message_content(response.json())
        return parse_memory_json(content)
