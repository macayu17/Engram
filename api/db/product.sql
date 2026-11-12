ALTER TABLE memories ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS namespace TEXT NOT NULL DEFAULT 'default';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS recoverable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS extraction_options JSONB NOT NULL DEFAULT '{}';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS lease_token UUID;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE retrieval_logs ADD COLUMN IF NOT EXISTS injected_count INT NOT NULL DEFAULT 0;
ALTER TABLE retrieval_logs ADD COLUMN IF NOT EXISTS retrieval_mode TEXT NOT NULL DEFAULT 'vector';
ALTER TABLE retrieval_logs ADD COLUMN IF NOT EXISTS memory_snapshots JSONB;

CREATE INDEX IF NOT EXISTS conversations_pending_jobs_idx ON conversations(next_attempt_at, created_at)
    WHERE recoverable AND extraction_status IN ('pending', 'running', 'failed');
CREATE INDEX IF NOT EXISTS memories_scope_expiry_idx ON memories(org_id, user_id, namespace, expires_at);

CREATE TABLE IF NOT EXISTS memory_revision_proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    namespace TEXT NOT NULL,
    original_content TEXT NOT NULL,
    proposed_content TEXT NOT NULL CHECK (length(proposed_content) BETWEEN 1 AND 4000),
    source_conversation_id UUID,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_revision_proposals_scope_status_idx ON memory_revision_proposals(org_id, user_id, namespace, status, created_at DESC);
ALTER TABLE memory_revision_proposals ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'update';
ALTER TABLE memory_revision_proposals DROP CONSTRAINT IF EXISTS memory_revision_proposals_kind_check;
ALTER TABLE memory_revision_proposals ADD CONSTRAINT memory_revision_proposals_kind_check CHECK (kind IN ('update', 'conflict'));
ALTER TABLE memory_revision_proposals DROP CONSTRAINT IF EXISTS memory_revision_proposals_status_check;
ALTER TABLE memory_revision_proposals ADD CONSTRAINT memory_revision_proposals_status_check
    CHECK (status IN ('pending', 'accepted', 'rejected', 'kept_both'));

DO $$
BEGIN
    IF to_regclass('public.memory_conflicts') IS NOT NULL THEN
        INSERT INTO memory_revision_proposals(memory_id, user_id, org_id, namespace, original_content, proposed_content, source_conversation_id, kind, created_at)
        SELECT existing.id, conflict.user_id, conflict.org_id, existing.namespace, existing.content, proposed.content,
               proposed.source_conversation_id, 'conflict', conflict.created_at
        FROM memory_conflicts conflict
        JOIN memories existing ON existing.id = conflict.existing_memory_id
        JOIN memories proposed ON proposed.id = conflict.proposed_memory_id
        WHERE conflict.status = 'open' AND existing.content <> proposed.content
          AND NOT EXISTS (
              SELECT 1 FROM memory_revision_proposals already
              WHERE already.memory_id = existing.id AND already.proposed_content = proposed.content AND already.kind = 'conflict'
          );
        DELETE FROM memories
        WHERE status = 'pending'
          AND id IN (SELECT proposed_memory_id FROM memory_conflicts WHERE status = 'open');
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS memory_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL,
    pinned BOOLEAN NOT NULL,
    namespace TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    reason TEXT NOT NULL DEFAULT 'edited',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memory_versions_memory_created_idx ON memory_versions(org_id, user_id, memory_id, created_at DESC);


CREATE OR REPLACE FUNCTION engram_save_memory_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (OLD.content, OLD.category, OLD.status, OLD.pinned, OLD.namespace, OLD.expires_at)
       IS DISTINCT FROM (NEW.content, NEW.category, NEW.status, NEW.pinned, NEW.namespace, NEW.expires_at) THEN
        INSERT INTO memory_versions(memory_id, user_id, org_id, content, category, status, pinned, namespace, expires_at)
        VALUES (OLD.id, OLD.user_id, OLD.org_id, OLD.content, OLD.category, OLD.status, OLD.pinned, OLD.namespace, OLD.expires_at);
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS engram_memory_version ON memories;
CREATE TRIGGER engram_memory_version BEFORE UPDATE ON memories
    FOR EACH ROW EXECUTE FUNCTION engram_save_memory_version();

CREATE OR REPLACE FUNCTION engram_redact_memory_trace() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.namespace = NEW.namespace THEN
        RETURN NEW;
    END IF;
    UPDATE retrieval_logs SET memory_snapshots=(
        SELECT COALESCE(jsonb_agg(
            CASE WHEN item->>'memory_id'=OLD.id::text THEN jsonb_set(item,'{content}','null'::jsonb) ELSE item END
            ORDER BY position),'[]'::jsonb)
        FROM jsonb_array_elements(memory_snapshots) WITH ORDINALITY AS entries(item,position)
    ) WHERE user_id=OLD.user_id AND org_id=OLD.org_id
        AND OLD.id=ANY(retrieved_memory_ids) AND memory_snapshots IS NOT NULL;
    IF TG_OP='DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS engram_memory_trace_delete ON memories;
CREATE TRIGGER engram_memory_trace_delete BEFORE DELETE ON memories
    FOR EACH ROW EXECUTE FUNCTION engram_redact_memory_trace();
DROP TRIGGER IF EXISTS engram_memory_trace_move ON memories;
CREATE TRIGGER engram_memory_trace_move BEFORE UPDATE OF namespace ON memories
    FOR EACH ROW EXECUTE FUNCTION engram_redact_memory_trace();

DO $$
DECLARE
    target_table TEXT;
    target_role TEXT;
BEGIN
    FOREACH target_table IN ARRAY ARRAY['memory_revision_proposals', 'memory_versions'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
        EXECUTE format('DROP POLICY IF EXISTS engram_server_access ON public.%I', target_table);
        EXECUTE format('CREATE POLICY engram_server_access ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)', target_table, current_user);
        FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
                EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', target_table, target_role);
            END IF;
        END LOOP;
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', target_table);
    END LOOP;
END;
$$;
