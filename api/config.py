from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql://engram:engram@localhost:5432/engram"
    database_min_pool_size: int = 2
    database_max_pool_size: int = 10
    database_statement_cache_size: int = 100
    extraction_provider: str = "openai"
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    anthropic_api_key: str = ""
    anthropic_base_url: str = "https://api.anthropic.com/v1"
    gemini_api_key: str = ""
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta/openai"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5:3b"
    embedding_model: str = "all-MiniLM-L6-v2"
    extraction_model: str = "gpt-4o-mini"
    max_memories_injected: int = 5
    retrieval_threshold: float = 0.5
    dedup_threshold: float = 0.95
    memory_refinement_threshold: float = 0.8
    log_level: str = "info"
    cors_origins: str = "http://localhost:3001"
    engram_service_key: str = ""
    proxy_auth_cache_ttl_seconds: int = 300
    proxy_auth_cache_max_entries: int = 4096
    engram_test_api_url: str = "http://localhost:8000"
    provider_key_encryption_key: str = ""
    engram_test_provider: str = "openai"
    engram_test_model: str = "gpt-4o-mini"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
