import asyncpg

from api.services.security import api_key_hashes_match, generate_api_key, hash_api_key


async def create_user(external_id: str, db: asyncpg.Connection) -> tuple[asyncpg.Record, str]:
    api_key = generate_api_key()
    api_key_hash = hash_api_key(api_key)
    async with db.transaction():
        row = await db.fetchrow(
            """
            INSERT INTO users (external_id, api_key_hash)
            VALUES ($1, $2)
            RETURNING id, external_id, created_at
            """,
            external_id,
            api_key_hash,
        )
        if row is not None:
            await insert_user_api_key(row["id"], api_key_hash, "default", db)
    if row is None:
        raise RuntimeError("User creation failed")
    return row, api_key


async def create_or_issue_user_key(external_id: str, key_name: str, db: asyncpg.Connection) -> tuple[asyncpg.Record, str]:
    api_key = generate_api_key()
    api_key_hash = hash_api_key(api_key)
    async with db.transaction():
        row = await db.fetchrow(
            """
            INSERT INTO users (external_id, api_key_hash)
            VALUES ($1, $2)
            ON CONFLICT (external_id) DO UPDATE
            SET updated_at = users.updated_at
            RETURNING id, external_id, created_at
            """,
            external_id,
            api_key_hash,
        )
        if row is None:
            raise RuntimeError("User key creation failed")
        await insert_user_api_key(row["id"], api_key_hash, key_name, db)
    return row, api_key


async def insert_user_api_key(user_id: object, api_key_hash: str, key_name: str, db: asyncpg.Connection) -> None:
    await db.execute(
        """
        INSERT INTO user_api_keys (user_id, api_key_hash, name)
        VALUES ($1, $2, $3)
        """,
        user_id,
        api_key_hash,
        key_name,
    )


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
        row = await db.fetchrow(
            """
            SELECT users.id, users.external_id, user_api_keys.api_key_hash, users.created_at
            FROM user_api_keys
            JOIN users ON users.id = user_api_keys.user_id
            WHERE user_api_keys.api_key_hash = $1
            """,
            api_key_hash,
        )
        if row is None:
            return None
        await db.execute(
            """
            UPDATE user_api_keys
            SET last_used_at = now()
            WHERE api_key_hash = $1
            """,
            api_key_hash,
        )
    return row if api_key_hashes_match(row["api_key_hash"], api_key) else None


async def delete_user(user_id: object, db: asyncpg.Connection) -> bool:
    result = await db.execute(
        """
        DELETE FROM users
        WHERE id = $1
        """,
        user_id,
    )
    return result.endswith("1")
