from datetime import datetime

from pydantic import UUID4, BaseModel


class EntityResponse(BaseModel):
    id: UUID4
    name: str
    entity_type: str
    memory_count: int


class EntityListResponse(BaseModel):
    entities: list[EntityResponse]


class EntityMemoryItem(BaseModel):
    id: UUID4
    content: str
    confidence: float
    category: str
    pinned: bool
    created_at: datetime


class EntityMemoriesResponse(BaseModel):
    entity_name: str
    entity_type: str
    memories: list[EntityMemoryItem]


class MemoryNeighborItem(BaseModel):
    id: UUID4
    content: str
    confidence: float
    category: str
    pinned: bool
    created_at: datetime


class MemoryNeighborsResponse(BaseModel):
    memory_id: UUID4
    neighbors: list[MemoryNeighborItem]
    entities: list[EntityResponse]


class GraphExtractResponse(BaseModel):
    processed: int
    entities_created: int
