from datetime import UTC, datetime, timedelta
from time import monotonic
from typing import TypedDict

import asyncpg

from api.config import settings
from api.services.provider_keys import normalize_provider_name
from api.services.security import api_key_hashes_match, encrypt_provider_key, generate_api_key, hash_api_key


_USER_COLUMNS: str = (
    "id, external_id, api_key_hash, created_at, max_memories_injected, "
    "retrieval_threshold, dedup_threshold, retrieval_mode, extraction_provider, "
    "extraction_model, openai_api_key_encrypted, gemini_api_key_encrypted, anthropic_api_key_encrypted"
)


class CachedUser(TypedDict):
    id: object
    org_id: object
    role: str
    external_id: str
    api_key_hash: str
    created_at: object
    max_memories_injected: int
    retrieval_threshold: float
    dedup_threshold: float
    retrieval_mode: str
    extraction_provider: str
    extraction_model: str
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
            workspace = await db.fetchrow(
                """
                INSERT INTO orgs (name)
                VALUES ($1)
                RETURNING id, name, extraction_provider, extraction_model
                """,
                f"{external_id}'s workspace",
            )
            if workspace is None:
                raise RuntimeError("Workspace creation failed")
            await db.execute(
                """
                INSERT INTO org_memberships (org_id, user_id, role)
                VALUES ($1, $2, 'owner')
                """,
                workspace["id"],
                row["id"],
            )
            await insert_user_api_key(row["id"], workspace["id"], api_key_hash, "default", db)
    if row is None:
        raise RuntimeError("User creation failed")
    cache_user_auth(
        api_key_hash,
        {
            **dict(row),
            "org_id": workspace["id"],
            "role": "owner",
            "extraction_provider": workspace["extraction_provider"],
            "extraction_model": workspace["extraction_model"],
        },
    )
    return row, api_key


async def provision_hosted_user(
    external_id: str,
    workspace_name: str,
    key_name: str,
    db: asyncpg.Connection,
    workspace_id: object | None = None,
) -> dict[str, object]:
    api_key = generate_api_key()
    api_key_hash = hash_api_key(api_key)
    disabled_legacy_key_hash = hash_api_key(generate_api_key())
    async with db.transaction():
        row = await db.fetchrow(
            f"""
            INSERT INTO users (external_id, api_key_hash)
            VALUES ($1, $2)
            ON CONFLICT (external_id) DO UPDATE
            SET api_key_hash = EXCLUDED.api_key_hash
            RETURNING {_USER_COLUMNS}
            """,
            external_id,
            disabled_legacy_key_hash,
        )
        if row is None:
            raise RuntimeError("Hosted user provisioning failed")
        if workspace_id is None:
            workspace_row = await db.fetchrow(
                """
                SELECT orgs.id, orgs.name, org_memberships.role,
                       orgs.extraction_provider, orgs.extraction_model,
                       orgs.openai_api_key_encrypted, orgs.gemini_api_key_encrypted,
                       orgs.anthropic_api_key_encrypted
                FROM orgs
                JOIN org_memberships ON org_memberships.org_id = orgs.id
                WHERE org_memberships.user_id = $1
                  AND org_memberships.role = 'owner'
                ORDER BY org_memberships.created_at
                LIMIT 1
                """,
                row["id"],
            )
        else:
            workspace_row = await db.fetchrow(
                """
                SELECT orgs.id, orgs.name, org_memberships.role,
                       orgs.extraction_provider, orgs.extraction_model,
                       orgs.openai_api_key_encrypted, orgs.gemini_api_key_encrypted,
                       orgs.anthropic_api_key_encrypted
                FROM orgs
                JOIN org_memberships ON org_memberships.org_id = orgs.id
                WHERE org_memberships.user_id = $1
                  AND orgs.id = $2
                """,
                row["id"],
                workspace_id,
            )
            if workspace_row is None:
                raise PermissionError("Workspace not found")
        if workspace_row is None:
            workspace_row = await db.fetchrow(
                """
                INSERT INTO orgs (name)
                VALUES ($1)
                RETURNING id, name, extraction_provider, extraction_model,
                          openai_api_key_encrypted, gemini_api_key_encrypted,
                          anthropic_api_key_encrypted
                """,
                workspace_name,
            )
            if workspace_row is None:
                raise RuntimeError("Workspace provisioning failed")
            await db.execute(
                """
                INSERT INTO org_memberships (org_id, user_id, role)
                VALUES ($1, $2, 'owner')
                """,
                workspace_row["id"],
                row["id"],
            )
            workspace = {**dict(workspace_row), "role": "owner"}
        else:
            workspace = dict(workspace_row)
        key_row = await db.fetchrow(
            """
            INSERT INTO user_api_keys (user_id, org_id, api_key_hash, name)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, org_id, name) DO UPDATE
            SET api_key_hash = EXCLUDED.api_key_hash,
                last_used_at = NULL
            RETURNING id
            """,
            row["id"],
            workspace["id"],
            api_key_hash,
            key_name,
        )
        if key_row is None:
            raise RuntimeError("Workspace key provisioning failed")
    auth_row = {
        **dict(row),
        "org_id": workspace["id"],
        "role": workspace["role"],
        "api_key_hash": api_key_hash,
        "extraction_provider": workspace["extraction_provider"],
        "extraction_model": workspace["extraction_model"],
        "openai_api_key_encrypted": workspace["openai_api_key_encrypted"],
        "gemini_api_key_encrypted": workspace["gemini_api_key_encrypted"],
        "anthropic_api_key_encrypted": workspace["anthropic_api_key_encrypted"],
    }
    clear_cached_user(row["id"])
    cache_user_auth(api_key_hash, auth_row)
    return {
        "id": row["id"],
        "external_id": row["external_id"],
        "created_at": row["created_at"],
        "api_key": api_key,
        "workspace_id": workspace["id"],
        "workspace_name": workspace["name"],
        "role": workspace["role"],
    }


async def insert_user_api_key(
    user_id: object,
    org_id: object,
    api_key_hash: str,
    key_name: str,
    db: asyncpg.Connection,
) -> None:
    await db.execute(
        """
        INSERT INTO user_api_keys (user_id, org_id, api_key_hash, name)
        VALUES ($1, $2, $3, $4)
        """,
        user_id,
        org_id,
        api_key_hash,
        key_name,
    )


async def get_user_by_api_key(api_key: str, db: asyncpg.Connection) -> asyncpg.Record | None:
    api_key_hash = hash_api_key(api_key)
    row = await db.fetchrow(
        """
        SELECT users.id, membership.org_id, membership.role, users.external_id,
               users.api_key_hash, users.created_at, users.max_memories_injected,
               users.retrieval_threshold, users.dedup_threshold, users.retrieval_mode,
               orgs.extraction_provider, orgs.extraction_model,
               orgs.openai_api_key_encrypted, orgs.gemini_api_key_encrypted,
               orgs.anthropic_api_key_encrypted
        FROM users
        JOIN LATERAL (
            SELECT org_id, role
            FROM org_memberships
            WHERE user_id = users.id
            ORDER BY CASE WHEN role = 'owner' THEN 0 ELSE 1 END, created_at
            LIMIT 1
        ) AS membership ON true
        JOIN orgs ON orgs.id = membership.org_id
        WHERE api_key_hash = $1
        """,
        api_key_hash,
    )
    secondary_key = row is None
    if row is None:
        row = await db.fetchrow(
            """
        SELECT users.id, user_api_keys.org_id, org_memberships.role,
               users.external_id, user_api_keys.api_key_hash, users.created_at,
               users.max_memories_injected, users.retrieval_threshold, users.dedup_threshold,
               users.retrieval_mode, orgs.extraction_provider, orgs.extraction_model,
               orgs.openai_api_key_encrypted, orgs.gemini_api_key_encrypted,
               orgs.anthropic_api_key_encrypted, user_api_keys.last_used_at
        FROM user_api_keys
        JOIN users ON users.id = user_api_keys.user_id
        JOIN orgs ON orgs.id = user_api_keys.org_id
        JOIN org_memberships ON org_memberships.org_id = user_api_keys.org_id
                            AND org_memberships.user_id = user_api_keys.user_id
        WHERE user_api_keys.api_key_hash = $1
            """,
            api_key_hash,
        )
    if row is None:
        return None
    if not api_key_hashes_match(row["api_key_hash"], api_key):
        return None
    last_used_at = get_row_value(row, "last_used_at", None)
    if isinstance(last_used_at, datetime) and last_used_at.tzinfo is None:
        last_used_at = last_used_at.replace(tzinfo=UTC)
    should_update_last_used = not isinstance(last_used_at, datetime) or datetime.now(UTC) - last_used_at >= timedelta(
        seconds=max(1, settings.proxy_auth_cache_ttl_seconds)
    )
    if secondary_key and should_update_last_used:
        await db.execute(
            """
            UPDATE user_api_keys
            SET last_used_at = now()
            WHERE api_key_hash = $1
            """,
            api_key_hash,
        )
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
              AND org_id = $2
            """,
            user["id"],
            user["org_id"],
        )
        await insert_user_api_key(user["id"], user["org_id"], api_key_hash, "default", db)
    clear_cached_user(user["id"])
    cache_user_auth(api_key_hash, {**dict(row), **dict(user), "api_key_hash": api_key_hash})
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
    extraction_model: str | None,
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
    clean_extraction_model: str | None = None
    if extraction_model is not None:
        clean_extraction_model = extraction_model.strip()
        if not clean_extraction_model:
            raise ValueError("Extraction model is required")

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
    if clean_extraction_model is not None:
        assignments.append("extraction_model = $" + str(len(params) + 2))
        params.append(clean_extraction_model)
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
    org_id = get_row_value(row, "org_id", None)
    role = get_row_value(row, "role", "member")
    max_memories_injected = get_row_value(row, "max_memories_injected", settings.max_memories_injected)
    retrieval_threshold = get_row_value(row, "retrieval_threshold", settings.retrieval_threshold)
    dedup_threshold = get_row_value(row, "dedup_threshold", settings.dedup_threshold)
    retrieval_mode = get_row_value(row, "retrieval_mode", settings.retrieval_mode)
    extraction_provider = get_row_value(row, "extraction_provider", settings.extraction_provider)
    extraction_model = get_row_value(row, "extraction_model", settings.extraction_model)
    _user_auth_cache[api_key_hash] = {
        "id": row["id"],
        "org_id": org_id,
        "role": str(role),
        "external_id": row["external_id"],
        "api_key_hash": api_key_hash,
        "created_at": row["created_at"],
        "max_memories_injected": int(max_memories_injected),
        "retrieval_threshold": float(retrieval_threshold),
        "dedup_threshold": float(dedup_threshold),
        "retrieval_mode": str(retrieval_mode),
        "extraction_provider": str(extraction_provider),
        "extraction_model": str(extraction_model),
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
