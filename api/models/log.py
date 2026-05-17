from datetime import datetime

from pydantic import BaseModel, Field, UUID4


class RetrievedMemoryLog(BaseModel):
    memory_id: UUID4
    content: str | None
    score: float


class RetrievalLogResponse(BaseModel):
    id: UUID4
    query: str
    retrieved_memories: list[RetrievedMemoryLog]
    conversation_id: UUID4 | None
    created_at: datetime


class RetrievalLogListResponse(BaseModel):
    logs: list[RetrievalLogResponse]
    total: int
    limit: int
    offset: int


class RetrievalLogDetailResponse(RetrievalLogResponse):
    query_embedding_dimensions: int | None


class RetrievalLogListParams(BaseModel):
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
    conversation_id: UUID4 | None = None
