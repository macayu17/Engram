from uuid import UUID

import asyncpg
from fastapi import HTTPException

from api.services.embedding import embed, format_embedding_for_pgvector


async def propose_revision(
    user_id: object,
    org_id: object,
    memory_id: object,
    content: str,
    conversation_id: object | None,
    db: asyncpg.Connection,
    namespace: str = "default",
) -> dict[str, object] | None:
    current = await db.fetchrow(
        "SELECT id, content FROM memories WHERE user_id=$1 AND org_id=$2 AND id=$3 AND namespace=$4 AND status <> 'rejected' FOR UPDATE",
        user_id, org_id, memory_id, namespace,
    )
    if current is None or current["content"] == content:
        return None
    row = await db.fetchrow(
        """
        INSERT INTO memory_revision_proposals(memory_id,user_id,org_id,namespace,original_content,proposed_content,source_conversation_id)
        SELECT $1,$2,$3,$4,$5,$6,$7
        WHERE NOT EXISTS (SELECT 1 FROM memory_revision_proposals WHERE memory_id=$1 AND user_id=$2 AND org_id=$3 AND proposed_content=$6 AND status='pending')
        RETURNING *
        """,
        memory_id, user_id, org_id, namespace, current["content"], content, conversation_id,
    )
    return dict(row) if row is not None else None


async def list_revisions(
    user_id: object, org_id: object, db: asyncpg.Connection,
    namespace: str | None = None, status: str = "pending",
) -> list[dict[str, object]]:
    rows = await db.fetch(
        """
        SELECT revision.* FROM memory_revision_proposals revision JOIN memories memory ON memory.id=revision.memory_id
        WHERE revision.user_id=$1 AND revision.org_id=$2 AND revision.status=$3
          AND ($4::text IS NULL OR (revision.namespace=$4 AND memory.namespace=$4))
        ORDER BY revision.created_at DESC LIMIT 100
        """, user_id, org_id, status, namespace,
    )
    return [dict(row) for row in rows]


async def decide_revision(
    user_id: object, org_id: object, revision_id: object, accept: bool,
    db: asyncpg.Connection, namespace: str | None = None,
) -> dict[str, object]:
    async with db.transaction():
        revision = await db.fetchrow(
            "SELECT * FROM memory_revision_proposals WHERE user_id=$1 AND org_id=$2 AND id=$3 AND ($4::text IS NULL OR namespace=$4) FOR UPDATE",
            user_id, org_id, revision_id, namespace,
        )
        if revision is None:
            raise HTTPException(status_code=404, detail="Revision not found")
        if revision["status"] != "pending":
            raise HTTPException(status_code=409, detail="Revision has already been reviewed")
        if accept:
            current = await db.fetchrow(
                "SELECT content, namespace FROM memories WHERE user_id=$1 AND org_id=$2 AND id=$3 FOR UPDATE",
                user_id, org_id, revision["memory_id"],
            )
            if current is None or current["content"] != revision["original_content"] or current["namespace"] != revision["namespace"]:
                raise HTTPException(status_code=409, detail="Memory changed since this revision was proposed; review the current memory")
            await db.execute(
                """
                UPDATE memories SET content=$1,embedding=$2::vector,source_conversation_id=$3,
                    status='approved',last_confirmed=now()
                WHERE user_id=$4 AND org_id=$5 AND id=$6
                """,
                revision["proposed_content"], format_embedding_for_pgvector(embed(revision["proposed_content"])),
                revision["source_conversation_id"], user_id, org_id, revision["memory_id"],
            )
        row = await db.fetchrow(
            "UPDATE memory_revision_proposals SET status=$1 WHERE user_id=$2 AND org_id=$3 AND id=$4 RETURNING *",
            "accepted" if accept else "rejected", user_id, org_id, revision_id,
        )
        return dict(row)


async def memory_history(
    user_id: object, org_id: object, memory_id: object,
    db: asyncpg.Connection, namespace: str | None = None,
) -> list[dict[str, object]]:
    rows = await db.fetch(
        """
        SELECT versions.* FROM memory_versions versions JOIN memories memory ON memory.id=versions.memory_id
        WHERE versions.user_id=$1 AND versions.org_id=$2 AND versions.memory_id=$3
          AND memory.user_id=$1 AND memory.org_id=$2 AND ($4::text IS NULL OR (memory.namespace=$4 AND versions.namespace=$4))
        ORDER BY versions.created_at DESC LIMIT 100
        """, user_id, org_id, memory_id, namespace,
    )
    return [dict(row) for row in rows]


async def restore_memory(
    user_id: object, org_id: object, memory_id: object, version_id: UUID,
    db: asyncpg.Connection, namespace: str | None = None,
) -> dict[str, object]:
    from api.services.memories import get_memory

    async with db.transaction():
        current = await db.fetchrow(
            "SELECT id FROM memories WHERE user_id=$1 AND org_id=$2 AND id=$3 AND ($4::text IS NULL OR namespace=$4) FOR UPDATE",
            user_id, org_id, memory_id, namespace,
        )
        version = await db.fetchrow(
            "SELECT * FROM memory_versions WHERE user_id=$1 AND org_id=$2 AND memory_id=$3 AND id=$4",
            user_id, org_id, memory_id, version_id,
        )
        if current is None or version is None:
            raise HTTPException(status_code=404, detail="Memory version not found")
        if namespace is not None and version["namespace"] != namespace:
            raise HTTPException(status_code=409, detail="This version belongs to another project; move the memory explicitly first")
        await db.execute(
            """
            UPDATE memories SET content=$1,embedding=$2::vector,category=$3,status=$4,pinned=$5,namespace=$6,expires_at=$7
            WHERE user_id=$8 AND org_id=$9 AND id=$10
            """, version["content"], format_embedding_for_pgvector(embed(version["content"])), version["category"],
            version["status"], version["pinned"], version["namespace"], version["expires_at"], user_id, org_id, memory_id,
        )
        return await get_memory(user_id, org_id, memory_id, db)


async def save_feedback(
    user_id: object, org_id: object, memory_id: object, relevant: bool, query: str | None,
    db: asyncpg.Connection, namespace: str | None = None,
) -> None:
    result = await db.execute(
        """
        INSERT INTO memory_feedback(memory_id,user_id,org_id,relevant,query)
        SELECT id,user_id,org_id,$4,$5 FROM memories
        WHERE user_id=$1 AND org_id=$2 AND id=$3 AND ($6::text IS NULL OR namespace=$6)
        """, user_id, org_id, memory_id, relevant, query, namespace,
    )
    if result.endswith("0"):
        raise HTTPException(status_code=404, detail="Memory not found")
