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

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    extraction_status TEXT NOT NULL DEFAULT 'pending',
    memories_extracted INT NOT NULL DEFAULT 0,
    raw_exchange JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversations_user_created_at_idx ON conversations(user_id, created_at DESC);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retrieval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    target_table TEXT;
    target_role TEXT;
BEGIN
    FOREACH target_table IN ARRAY ARRAY['users', 'memories', 'user_api_keys', 'retrieval_logs', 'conversations'] LOOP
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
