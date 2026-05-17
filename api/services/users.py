import asyncpg

from api.services.security import api_key_hashes_match, generate_api_key, hash_api_key


async def create_user(external_id: str, db: asyncpg.Connection) -> tuple[asyncpg.Record, str]:
    api_key = generate_api_key()
    api_key_hash = hash_api_key(api_key)
    row = await db.fetchrow(
        """
        INSERT INTO users (external_id, api_key_hash)
        VALUES ($1, $2)
        RETURNING id, external_id, created_at
        """,
        external_id,
        api_key_hash,
    )
    if row is None:
        raise RuntimeError("User creation failed")
    return row, api_key


async def get_user_by_api_key(api_key: str, db: asyncpg.Connection) -> asyncpg.Record | None:
    api_key_hash = hash_api_key(api_key)
    row = await db.fetchrow(
        """
        SELECT id, external_id, api_key_hash, created_at
        FROM users
        WHERE api_key_hash = $1
        """,
        api_key_hash,
    )
    if row is None:
        return None
    if not api_key_hashes_match(row["api_key_hash"], api_key):
        return None
    return row


async def delete_user(user_id: object, db: asyncpg.Connection) -> bool:
    result = await db.execute(
        """
        DELETE FROM users
        WHERE id = $1
        """,
        user_id,
    )
    return result.endswith("1")
