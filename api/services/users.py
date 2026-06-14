from time import monotonic
from typing import TypedDict

import asyncpg

from api.config import settings
from api.services.security import api_key_hashes_match, generate_api_key, hash_api_key

from api.services.provider_keys import (
    ProviderConfigError,
    normalize_provider_name,
)
from api.services.security import encrypt_provider_key


_USER_COLUMNS: str = (
    "id, external_id, api_key_hash, created_at, max_memories_injected, "
    "retrieval_threshold, dedup_threshold, extraction_provider, "
    "openai_api_key_encrypted, gemini_api_key_encrypted, anthropic_api_key_encrypted"
)


_PROVIDER_KEY_ENCRYPTED_COLUMNS: dict[str, str] = {
    "openai": "openai_api_key_encrypted",
    "gemini": "gemini_api_key_encrypted",
    "anthropic": "anthropic_api_key_encrypted",
}


class CachedUser(TypedDict):
    id: object
    external_id: str
    api_key_hash: str
    created_at: object
    max_memories_injected: int
    retrieval_threshold: float
    dedup_threshold: float
    extraction_provider: str
    cached_at: float


_user_auth_cache: dict[str, CachedUser] = {}


async def create_user(external_id: str, db: asyncpg.Connection) -> tuple[asyncpg.Record, str]:
    api_key = generate_api_key()
    api_key_hash = hash_api_key(api_key)
    async with db.transaction():
        row = await db.fetchrow(
            f"""
            INSERT INTO users (external_id, api_key_hash)
            VALUES ($1, $2)
            RETURNING {_USER_COLUMNS}
            """,
            external_id,
            api_key_hash,
        )
        if row is not None:
            await insert_user_api_key(row["id"], api_key_hash, "default", db)
    if row is None:
        raise RuntimeError("User creation failed")
    cache_user_auth(api_key_hash, row)
    return row, api_key


async def create_or_issue_user_key(external_id: str, key_name: str, db: asyncpg.Connection) -> tuple[asyncpg.Record, str]:
    api_key = generate_api_key()
    api_key_hash = hash_api_key(api_key)
    async with db.transaction():
        row = await db.fetchrow(
            f"""
            INSERT INTO users (external_id, api_key_hash)
            VALUES ($1, $2)
            ON CONFLICT (external_id) DO UPDATE
            SET updated_at = users.updated_at
            RETURNING {_USER_COLUMNS}
            """,
            external_id,
            api_key_hash,
        )
        if row is None:
            raise RuntimeError("User key creation failed")
        await insert_user_api_key(row["id"], api_key_hash, key_name, db)
    cache_user_auth(api_key_hash, row)
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
        f"""
        SELECT {_USER_COLUMNS}
        FROM users
        WHERE api_key_hash = $1
        """,
        api_key_hash,
    )
    if row is None:
        row = await db.fetchrow(
            f"""
        SELECT users.id, users.external_id, user_api_keys.api_key_hash, users.created_at,
               users.max_memories_injected, users.retrieval_threshold, users.dedup_threshold,
               users.extraction_provider,
               users.openai_api_key_encrypted, users.gemini_api_key_encrypted, users.anthropic_api_key_encrypted
        FROM user_api_keys
        JOIN users ON users.id = user_api_keys.user_id
        WHERE user_api_keys.api_key_hash = $1
            """,
            api_key_hash,
        )
    if row is None:
        return None
    if not api_key_hashes_match(row["api_key_hash"], api_key):
        return None
    cache_user_auth(api_key_hash, row)
    return row


async def delete_user(user_id: object, db: asyncpg.Connection) -> bool:
    result = await db.execute(
        """
        DELETE FROM users
        WHERE id = $1
        """,
        user_id,
    )
    deleted = result.endswith("1")
    if deleted:
        clear_cached_user(user_id)
    return deleted


async def get_user_config(user_id: object, db: asyncpg.Connection) -> dict[str, object]:
    row = await db.fetchrow(
        """
        SELECT max_memories_injected, retrieval_threshold, dedup_threshold
        FROM users
        WHERE id = $1
        """,
        user_id,
    )
    if row is None:
        raise RuntimeError("User not found")
    return dict(row)


async def update_user_external_id(user_id: object, external_id: str, db: asyncpg.Connection) -> dict[str, object]:
    row = await db.fetchrow(
        """
        UPDATE users
        SET external_id = $2
        WHERE id = $1
        RETURNING id, external_id, created_at
        """,
        user_id,
        external_id,
    )
    if row is None:
        raise RuntimeError("User not found")
    clear_cached_user(user_id)
    return dict(row)


async def update_user_config(
    user_id: object,
    max_memories_injected: int | None,
    retrieval_threshold: float | None,
    dedup_threshold: float | None,
    db: asyncpg.Connection,
) -> dict[str, object]:
    row = await db.fetchrow(
        """
        UPDATE users
        SET
            max_memories_injected = COALESCE($2, max_memories_injected),
            retrieval_threshold = COALESCE($3, retrieval_threshold),
            dedup_threshold = COALESCE($4, dedup_threshold)
        WHERE id = $1
        RETURNING max_memories_injected, retrieval_threshold, dedup_threshold
        """,
        user_id,
        max_memories_injected,
        retrieval_threshold,
        dedup_threshold,
    )
    if row is None:
        raise RuntimeError("User not found")
    return dict(row)


async def regenerate_user_key(user: asyncpg.Record, db: asyncpg.Connection) -> tuple[dict[str, object], str]:
    api_key = generate_api_key()
    api_key_hash = hash_api_key(api_key)
    async with db.transaction():
        row = await db.fetchrow(
            f"""
            UPDATE users
            SET api_key_hash = $2
            WHERE id = $1
            RETURNING {_USER_COLUMNS}
            """,
            user["id"],
            api_key_hash,
        )
        if row is None:
            raise RuntimeError("User key regeneration failed")
        await db.execute(
            """
            DELETE FROM user_api_keys
            WHERE user_id = $1
            """,
            user["id"],
        )
        await insert_user_api_key(user["id"], api_key_hash, "default", db)
    clear_cached_user(user["id"])
    cache_user_auth(api_key_hash, row)
    return dict(row), api_key


_SENTINEL_NO_UPDATE = object()


async def get_user_provider_config(user_id: object, db: asyncpg.Connection) -> dict[str, object]:
    from api.services.provider_keys import summarize_provider_for_response
    row = await db.fetchrow(
        f"""
        SELECT {_USER_COLUMNS}
        FROM users
        WHERE id = $1
        """,
        user_id,
    )
    if row is None:
        raise RuntimeError("User not found")
    return summarize_provider_for_response(row)


async def update_user_provider_config(
    user_id: object,
    extraction_provider: str | None,
    openai_api_key: str | None,
    gemini_api_key: str | None,
    anthropic_api_key: str | None,
    clear_openai_key: bool,
    clear_gemini_key: bool,
    clear_anthropic_key: bool,
    db: asyncpg.Connection,
) -> dict[str, object]:
    chosen_provider: str | None = None
    if extraction_provider is not None:
        chosen_provider = normalize_provider_name(extraction_provider)

    openai_blob: object = _SENTINEL_NO_UPDATE
    gemini_blob: object = _SENTINEL_NO_UPDATE
    anthropic_blob: object = _SENTINEL_NO_UPDATE
    if openai_api_key is not None:
        openai_blob = encrypt_provider_key(openai_api_key) if openai_api_key else None
    if clear_openai_key:
        openai_blob = None
    if gemini_api_key is not None:
        gemini_blob = encrypt_provider_key(gemini_api_key) if gemini_api_key else None
    if clear_gemini_key:
        gemini_blob = None
    if anthropic_api_key is not None:
        anthropic_blob = encrypt_provider_key(anthropic_api_key) if anthropic_api_key else None
    if clear_anthropic_key:
        anthropic_blob = None

    assignments: list[str] = []
    params: list[object] = []
    if chosen_provider is not None:
        assignments.append("extraction_provider = $" + str(len(params) + 2))
        params.append(chosen_provider)
    if openai_blob is not _SENTINEL_NO_UPDATE:
        assignments.append("openai_api_key_encrypted = $" + str(len(params) + 2))
        params.append(openai_blob)
    if gemini_blob is not _SENTINEL_NO_UPDATE:
        assignments.append("gemini_api_key_encrypted = $" + str(len(params) + 2))
        params.append(gemini_blob)
    if anthropic_blob is not _SENTINEL_NO_UPDATE:
        assignments.append("anthropic_api_key_encrypted = $" + str(len(params) + 2))
        params.append(anthropic_blob)

    if not assignments:
        return await get_user_provider_config(user_id, db)

    set_clause = ", ".join(assignments)
    row = await db.fetchrow(
        f"""
        UPDATE users
        SET {set_clause}
        WHERE id = $1
        RETURNING {_USER_COLUMNS}
        """,
        user_id,
        *params,
    )
    if row is None:
        raise RuntimeError("User not found")
    clear_cached_user(user_id)
    from api.services.provider_keys import summarize_provider_for_response
    return summarize_provider_for_response(row)


def cache_user_auth(api_key_hash: str, row: asyncpg.Record | dict[str, object]) -> None:
    prune_user_auth_cache()
    max_memories_injected = get_row_value(row, "max_memories_injected", settings.max_memories_injected)
    retrieval_threshold = get_row_value(row, "retrieval_threshold", settings.retrieval_threshold)
    dedup_threshold = get_row_value(row, "dedup_threshold", settings.dedup_threshold)
    extraction_provider = get_row_value(row, "extraction_provider", settings.extraction_provider)
    _user_auth_cache[api_key_hash] = {
        "id": row["id"],
        "external_id": row["external_id"],
        "api_key_hash": api_key_hash,
        "created_at": row["created_at"],
        "max_memories_injected": int(max_memories_injected),
        "retrieval_threshold": float(retrieval_threshold),
        "dedup_threshold": float(dedup_threshold),
        "extraction_provider": str(extraction_provider),
        "cached_at": monotonic(),
    }
    trim_user_auth_cache()


def get_row_value(row: asyncpg.Record | dict[str, object], key: str, default: object) -> object:
    try:
        value = row[key]
    except KeyError:
        return default
    if value is None:
        return default
    return value


def get_cached_user_by_api_key(api_key: str) -> CachedUser | None:
    api_key_hash = hash_api_key(api_key)
    cached_user = _user_auth_cache.get(api_key_hash)
    if cached_user is None:
        return None
    if is_cached_user_expired(cached_user):
        del _user_auth_cache[api_key_hash]
        return None
    return cached_user


def clear_cached_user(user_id: object) -> None:
    for api_key_hash, cached_user in list(_user_auth_cache.items()):
        if cached_user["id"] == user_id:
            del _user_auth_cache[api_key_hash]


def prune_user_auth_cache() -> None:
    for api_key_hash, cached_user in list(_user_auth_cache.items()):
        if is_cached_user_expired(cached_user):
            del _user_auth_cache[api_key_hash]


def trim_user_auth_cache() -> None:
    max_entries = max(1, settings.proxy_auth_cache_max_entries)
    while len(_user_auth_cache) > max_entries:
        oldest_key = min(_user_auth_cache, key=lambda api_key_hash: _user_auth_cache[api_key_hash]["cached_at"])
        del _user_auth_cache[oldest_key]


def is_cached_user_expired(cached_user: CachedUser) -> bool:
    ttl_seconds = max(1, settings.proxy_auth_cache_ttl_seconds)
    return monotonic() - cached_user["cached_at"] > ttl_seconds
