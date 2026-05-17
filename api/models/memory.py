from datetime import datetime

from pydantic import BaseModel, Field, UUID4


class MemoryCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class MemoryUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


class MemoryResponse(BaseModel):
    id: UUID4
    content: str
    confidence: float
    access_count: int
    last_accessed: datetime | None
    created_at: datetime
    source_conversation_id: UUID4 | None


class MemoryListResponse(BaseModel):
    memories: list[MemoryResponse]
    total: int
    limit: int
    offset: int


class MemorySearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    limit: int = Field(default=5, ge=1, le=20)
    threshold: float = Field(default=0.5, ge=0, le=1)


class MemorySearchResult(BaseModel):
    memory: MemoryResponse
    score: float


class MemorySearchResponse(BaseModel):
    results: list[MemorySearchResult]
