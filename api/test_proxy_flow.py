import asyncio
import logging

import httpx


logger = logging.getLogger(__name__)


async def main() -> None:
    from api.config import settings

    logging.basicConfig(level=logging.INFO)
    base_url = settings.engram_test_api_url
    async with httpx.AsyncClient(timeout=120) as client:
        user_response = await client.post(f"{base_url}/users", json={"external_id": "test_user_1"})
        user_response.raise_for_status()
        api_key = user_response.json()["api_key"]
        headers = {
            "Content-Type": "application/json",
            "X-Engram-Key": api_key,
            "X-Engram-User-ID": "test_user_1",
            "X-Engram-Provider": settings.engram_test_provider,
        }
        first_response = await client.post(
            f"{base_url}/v1/chat",
            headers=headers,
            json={
                "model": settings.engram_test_model,
                "messages": [
                    {
                        "role": "user",
                        "content": "I am a CS student at RVITM Bengaluru. I prefer FastAPI for backend development and TypeScript for frontend work.",
                    }
                ],
            },
        )
        first_response.raise_for_status()
        await asyncio.sleep(3)
        memories_response = await client.get(f"{base_url}/memories", headers={"X-Engram-Key": api_key})
        memories_response.raise_for_status()
        second_response = await client.post(
            f"{base_url}/v1/chat",
            headers=headers,
            json={
                "model": settings.engram_test_model,
                "messages": [{"role": "user", "content": "What tech stack should I use for my next project?"}],
            },
        )
        second_response.raise_for_status()
        logs_response = await client.get(f"{base_url}/logs", headers={"X-Engram-Key": api_key})
        logs_response.raise_for_status()
        logger.info("memories=%s", memories_response.json())
        logger.info("second_response=%s", second_response.text)
        logger.info("logs=%s", logs_response.json())


if __name__ == "__main__":
    asyncio.run(main())
