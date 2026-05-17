import asyncio
import json
import logging


logger = logging.getLogger(__name__)


async def main() -> None:
    from api.services.extraction import extract_memories

    logging.basicConfig(level=logging.INFO)
    conversation = """
user: I am a CS student at RVITM Bengaluru. I prefer FastAPI for backend development and TypeScript for frontend work.
assistant: That stack is a good fit for your project.
user: Also remember that I want concise technical answers without em dash punctuation.
"""
    memories = await extract_memories(conversation)
    logger.info(json.dumps(memories, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
