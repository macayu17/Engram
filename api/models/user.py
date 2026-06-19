from datetime import datetime

from pydantic import BaseModel, Field, UUID4, field_validator


class ExternalIdModel(BaseModel):
    external_id: str = Field(min_length=1, max_length=255)

    @field_validator("external_id")
    @classmethod
    def strip_external_id(cls, value: str) -> str:
        stripped_value = value.strip()
        if not stripped_value:
            raise ValueError("External ID is required")
        return stripped_value


class UserCreate(ExternalIdModel):
    pass


class UserUpdate(ExternalIdModel):
    pass


class ServiceUserKeyCreate(ExternalIdModel):
    key_name: str = Field(default="clerk", min_length=1, max_length=80)


class UserResponse(BaseModel):
    id: UUID4
    external_id: str
    created_at: datetime


class UserCreateResponse(UserResponse):
    api_key: str


class UserConfigUpdate(BaseModel):
    max_memories_injected: int | None = Field(default=None, ge=1, le=20)
    retrieval_threshold: float | None = Field(default=None, ge=0, le=1)
    dedup_threshold: float | None = Field(default=None, ge=0, le=1)


class UserConfigResponse(BaseModel):
    max_memories_injected: int
    retrieval_threshold: float
    dedup_threshold: float


class UserProviderConfigUpdate(BaseModel):
    extraction_provider: str | None = Field(default=None, pattern="^(openai|gemini|ollama)$")
    extraction_model: str | None = Field(default=None, min_length=1, max_length=120)
    openai_api_key: str | None = Field(default=None, max_length=512)
    gemini_api_key: str | None = Field(default=None, max_length=512)
    anthropic_api_key: str | None = Field(default=None, max_length=512)
    clear_openai_key: bool = Field(default=False)
    clear_gemini_key: bool = Field(default=False)
    clear_anthropic_key: bool = Field(default=False)


class UserProviderConfigResponse(BaseModel):
    extraction_provider: str
    extraction_model: str
    has_user_api_key: bool
    user_api_key_preview: str | None
