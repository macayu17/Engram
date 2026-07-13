from datetime import datetime

from pydantic import BaseModel, UUID4


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


class ClientRegistryItem(BaseModel):
    source: str
    conversations: int
    memories_extracted: int
    last_seen: datetime


class ClientRegistryResponse(BaseModel):
    clients: list[ClientRegistryItem]


class RetrievalLogDetailResponse(RetrievalLogResponse):
    query_embedding_dimensions: int | None
