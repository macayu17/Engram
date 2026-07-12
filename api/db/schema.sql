CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id TEXT UNIQUE NOT NULL,
    api_key_hash TEXT UNIQUE NOT NULL,
    max_memories_injected INT NOT NULL DEFAULT 5,
    retrieval_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    dedup_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.95,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS max_memories_injected INT NOT NULL DEFAULT 5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS retrieval_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.5;
ALTER TABLE users ADD COLUMN IF NOT EXISTS dedup_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.95;

ALTER TABLE users ADD COLUMN IF NOT EXISTS retrieval_mode TEXT NOT NULL DEFAULT 'vector';
ALTER TABLE users ADD COLUMN IF NOT EXISTS extraction_provider TEXT NOT NULL DEFAULT 'openai';
ALTER TABLE users ADD COLUMN IF NOT EXISTS extraction_model TEXT NOT NULL DEFAULT 'gpt-4o-mini';
ALTER TABLE users ADD COLUMN IF NOT EXISTS openai_api_key_encrypted BYTEA;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gemini_api_key_encrypted BYTEA;
ALTER TABLE users ADD COLUMN IF NOT EXISTS anthropic_api_key_encrypted BYTEA;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_extraction_provider_check') THEN
        ALTER TABLE users DROP CONSTRAINT users_extraction_provider_check;
    END IF;
    ALTER TABLE users ADD CONSTRAINT users_extraction_provider_check
        CHECK (extraction_provider IN ('openai', 'gemini', 'ollama', 'anthropic'));
END;
$$;

CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding vector(384) NOT NULL,
    source_conversation_id UUID,
    confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    access_count INT NOT NULL DEFAULT 0,
    last_accessed TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE memories ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'approved';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS last_confirmed TIMESTAMPTZ;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memories_status_check') THEN
        ALTER TABLE memories DROP CONSTRAINT memories_status_check;
    END IF;
    ALTER TABLE memories ADD CONSTRAINT memories_status_check
        CHECK (status IN ('pending', 'approved', 'rejected'));
END;
$$;

CREATE INDEX IF NOT EXISTS memories_embedding_idx ON memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS memories_user_id_idx ON memories(user_id);
CREATE INDEX IF NOT EXISTS memories_user_created_at_idx ON memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS memories_user_access_count_idx ON memories(user_id, access_count DESC);
CREATE INDEX IF NOT EXISTS memories_user_status_idx ON memories(user_id, status);
CREATE INDEX IF NOT EXISTS memories_user_category_idx ON memories(user_id, category);

ALTER TABLE memories ADD COLUMN IF NOT EXISTS content_tsv tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX IF NOT EXISTS memories_content_tsv_idx ON memories USING GIN (content_tsv);

ALTER TABLE memories ADD COLUMN IF NOT EXISTS namespace TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS memories_user_namespace_idx ON memories(user_id, namespace);

CREATE TABLE IF NOT EXISTS user_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    api_key_hash TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL DEFAULT 'default',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS user_api_keys_user_id_idx ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS user_api_keys_hash_idx ON user_api_keys(api_key_hash);

CREATE TABLE IF NOT EXISTS retrieval_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    query TEXT NOT NULL,
    query_embedding vector(384),
    retrieved_memory_ids UUID[] NOT NULL DEFAULT '{}',
    retrieved_scores DOUBLE PRECISION[] NOT NULL DEFAULT '{}',
    conversation_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS retrieval_logs_user_created_at_idx ON retrieval_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS retrieval_logs_conversation_id_idx ON retrieval_logs(conversation_id);

ALTER TABLE retrieval_logs ADD COLUMN IF NOT EXISTS namespace TEXT NOT NULL DEFAULT 'default';

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    extraction_status TEXT NOT NULL DEFAULT 'pending',
    memories_extracted INT NOT NULL DEFAULT 0,
    raw_exchange JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_user_created_at_idx ON conversations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS orgs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    extraction_provider TEXT NOT NULL DEFAULT 'openai',
    extraction_model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    openai_api_key_encrypted BYTEA,
    gemini_api_key_encrypted BYTEA,
    anthropic_api_key_encrypted BYTEA,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE orgs ADD COLUMN IF NOT EXISTS extraction_provider TEXT NOT NULL DEFAULT 'openai';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS extraction_model TEXT NOT NULL DEFAULT 'gpt-4o-mini';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS openai_api_key_encrypted BYTEA;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS gemini_api_key_encrypted BYTEA;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS anthropic_api_key_encrypted BYTEA;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive';
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orgs_plan_check') THEN
        ALTER TABLE orgs ADD CONSTRAINT orgs_plan_check CHECK (plan IN ('free', 'pro'));
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS orgs_stripe_customer_id_idx
ON orgs(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orgs_stripe_subscription_id_idx
ON orgs(stripe_subscription_id)
WHERE stripe_subscription_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS stripe_events (
    event_id TEXT PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orgs_extraction_provider_check') THEN
        ALTER TABLE orgs ADD CONSTRAINT orgs_extraction_provider_check
            CHECK (extraction_provider IN ('openai', 'gemini', 'ollama', 'anthropic'));
    END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS org_memberships (
    org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, user_id)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'org_memberships_role_check') THEN
        ALTER TABLE org_memberships ADD CONSTRAINT org_memberships_role_check
            CHECK (role IN ('owner', 'admin', 'member'));
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS org_memberships_user_id_idx ON org_memberships(user_id);

ALTER TABLE memories ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS memories_org_id_idx ON memories(org_id);

CREATE TABLE IF NOT EXISTS memory_entities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, name, entity_type)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memory_entities_type_check') THEN
        ALTER TABLE memory_entities ADD CONSTRAINT memory_entities_type_check
            CHECK (entity_type IN ('person', 'project', 'skill', 'technology', 'preference', 'topic', 'organization'));
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS memory_entities_user_idx ON memory_entities(user_id);

CREATE TABLE IF NOT EXISTS memory_entity_links (
    memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    entity_id UUID NOT NULL REFERENCES memory_entities(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (memory_id, entity_id)
);
CREATE INDEX IF NOT EXISTS memory_entity_links_entity_idx ON memory_entity_links(entity_id);

CREATE TABLE IF NOT EXISTS memory_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    target_memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL,
    strength DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source_memory_id, target_memory_id, relationship_type)
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'memory_relationships_type_check') THEN
        ALTER TABLE memory_relationships ADD CONSTRAINT memory_relationships_type_check
            CHECK (relationship_type IN ('related_to', 'contradicts', 'refines', 'supports', 'mentions'));
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS memory_relationships_source_idx ON memory_relationships(source_memory_id);
CREATE INDEX IF NOT EXISTS memory_relationships_target_idx ON memory_relationships(target_memory_id);

ALTER TABLE user_api_keys ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE retrieval_logs ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE memory_entities ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE memory_relationships ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS user_api_keys_org_id_idx ON user_api_keys(org_id);
CREATE INDEX IF NOT EXISTS retrieval_logs_org_created_at_idx ON retrieval_logs(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversations_org_created_at_idx ON conversations(org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS memory_entities_org_idx ON memory_entities(org_id);
CREATE INDEX IF NOT EXISTS memory_relationships_org_idx ON memory_relationships(org_id);

DO $$
DECLARE
    user_row RECORD;
    personal_org_id UUID;
BEGIN
    FOR user_row IN
        SELECT id, external_id, extraction_provider, extraction_model,
               openai_api_key_encrypted, gemini_api_key_encrypted, anthropic_api_key_encrypted
        FROM users
    LOOP
        SELECT org_id
        INTO personal_org_id
        FROM org_memberships
        WHERE user_id = user_row.id
          AND role = 'owner'
        ORDER BY created_at
        LIMIT 1;

        IF personal_org_id IS NULL THEN
            INSERT INTO orgs (
                name,
                extraction_provider,
                extraction_model,
                openai_api_key_encrypted,
                gemini_api_key_encrypted,
                anthropic_api_key_encrypted
            )
            VALUES (
                'legacy:' || user_row.external_id,
                user_row.extraction_provider,
                user_row.extraction_model,
                user_row.openai_api_key_encrypted,
                user_row.gemini_api_key_encrypted,
                user_row.anthropic_api_key_encrypted
            )
            RETURNING id INTO personal_org_id;

            INSERT INTO org_memberships (org_id, user_id, role)
            VALUES (personal_org_id, user_row.id, 'owner');
        END IF;

        UPDATE memories
        SET org_id = personal_org_id
        WHERE user_id = user_row.id
          AND org_id IS NULL;

        UPDATE user_api_keys
        SET org_id = personal_org_id
        WHERE user_id = user_row.id
          AND org_id IS NULL;

        UPDATE retrieval_logs
        SET org_id = personal_org_id
        WHERE user_id = user_row.id
          AND org_id IS NULL;

        UPDATE conversations
        SET org_id = personal_org_id
        WHERE user_id = user_row.id
          AND org_id IS NULL;

        UPDATE memory_entities AS entity
        SET org_id = COALESCE(
            (
                SELECT memory.org_id
                FROM memory_entity_links AS link
                JOIN memories AS memory ON memory.id = link.memory_id
                WHERE link.entity_id = entity.id
                ORDER BY memory.created_at
                LIMIT 1
            ),
            personal_org_id
        )
        WHERE entity.user_id = user_row.id
          AND entity.org_id IS NULL;

        UPDATE memory_relationships AS relationship
        SET org_id = COALESCE(
            (
                SELECT memory.org_id
                FROM memories AS memory
                WHERE memory.id = relationship.source_memory_id
            ),
            personal_org_id
        )
        WHERE relationship.user_id = user_row.id
          AND relationship.org_id IS NULL;
    END LOOP;
END;
$$;

WITH ranked_keys AS (
    SELECT id,
           row_number() OVER (PARTITION BY user_id, org_id, name ORDER BY created_at, id) AS duplicate_number
    FROM user_api_keys
)
UPDATE user_api_keys AS api_key
SET name = api_key.name || '-' || left(api_key.id::text, 8)
FROM ranked_keys
WHERE ranked_keys.id = api_key.id
  AND ranked_keys.duplicate_number > 1;

ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_org_id_fkey;
ALTER TABLE memories ADD CONSTRAINT memories_org_id_fkey
    FOREIGN KEY (org_id) REFERENCES orgs(id) ON DELETE CASCADE;

ALTER TABLE memory_entities DROP CONSTRAINT IF EXISTS memory_entities_user_id_name_entity_type_key;
CREATE UNIQUE INDEX IF NOT EXISTS memory_entities_org_user_name_type_idx
    ON memory_entities(org_id, user_id, name, entity_type);
CREATE UNIQUE INDEX IF NOT EXISTS user_api_keys_user_org_name_idx
    ON user_api_keys(user_id, org_id, name);

CREATE INDEX IF NOT EXISTS memories_org_user_namespace_idx
    ON memories(org_id, user_id, namespace);
CREATE INDEX IF NOT EXISTS retrieval_logs_org_user_created_at_idx
    ON retrieval_logs(org_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS conversations_org_user_created_at_idx
    ON conversations(org_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS memory_entities_org_user_idx
    ON memory_entities(org_id, user_id);

ALTER TABLE memories ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE user_api_keys ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE retrieval_logs ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE conversations ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE memory_entities ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE memory_relationships ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retrieval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memory_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    target_table TEXT;
    target_role TEXT;
BEGIN
    FOREACH target_table IN ARRAY ARRAY['users', 'memories', 'user_api_keys', 'retrieval_logs', 'conversations', 'orgs', 'org_memberships', 'memory_entities', 'memory_entity_links', 'memory_relationships', 'stripe_events'] LOOP
        EXECUTE format('DROP POLICY IF EXISTS engram_server_access ON public.%I', target_table);
        EXECUTE format(
            'CREATE POLICY engram_server_access ON public.%I FOR ALL TO %I USING (true) WITH CHECK (true)',
            target_table,
            current_user
        );
        FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
            IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
                EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', target_table, target_role);
            END IF;
        END LOOP;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS memories_set_updated_at ON memories;
CREATE TRIGGER memories_set_updated_at BEFORE UPDATE ON memories FOR EACH ROW EXECUTE FUNCTION set_updated_at();
