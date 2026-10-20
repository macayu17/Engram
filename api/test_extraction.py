import asyncio
import json
import logging


logger = logging.getLogger(__name__)


async def main() -> None:
    from api.config import settings
    from api.services.extraction import extract_memories
    from api.services.provider_keys import resolve_user_provider

    logging.basicConfig(level=logging.INFO)
    conversation = """
user: I am a CS student at RVITM Bengaluru. I prefer FastAPI for backend development and TypeScript for frontend work.
assistant: That stack is a good fit for your project.
user: Also remember that I want concise technical answers without em dash punctuation.
"""
    resolved = resolve_user_provider({"extraction_provider": settings.extraction_provider})
    memories = await extract_memories(conversation, resolved)
    logger.info(json.dumps(memories, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
