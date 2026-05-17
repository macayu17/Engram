import asyncio

from api.db.schema import apply_schema


async def main() -> None:
    await apply_schema()


if __name__ == "__main__":
    asyncio.run(main())
