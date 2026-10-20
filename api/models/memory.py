from datetime import datetime
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, Field, StringConstraints, UUID4


MemoryStatus = Literal["pending", "approved", "rejected"]
Namespace = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")]


class MemoryCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    category: str | None = Field(default=None, min_length=1, max_length=80)
    pinned: bool = False
    namespace: Namespace = "default"
    expires_at: AwareDatetime | None = None


class MemoryUpdate(BaseModel):
    content: str | None = Field(default=None, min_length=1, max_length=4000)
    category: str | None = Field(default=None, min_length=1, max_length=80)
    pinned: bool | None = None
    status: MemoryStatus | None = None
    namespace: Namespace | None = None
    expires_at: AwareDatetime | None = None


class MemoryResponse(BaseModel):
    id: UUID4
    content: str
    confidence: float
    access_count: int
    last_accessed: datetime | None
    created_at: datetime
    source_conversation_id: UUID4 | None
    status: MemoryStatus
    category: str
    pinned: bool
    source: str
    last_confirmed: datetime | None
    namespace: str = "default"
    expires_at: datetime | None = None


class MemoryListResponse(BaseModel):
    memories: list[MemoryResponse]
    total: int
    limit: int
    offset: int


class MemorySearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    limit: int = Field(default=5, ge=1, le=20)
    threshold: float = Field(default=0.5, ge=0, le=1)
    namespace: Namespace = "default"
    include_personal: bool = False


class MemorySearchResult(BaseModel):
    memory: MemoryResponse
    score: float


class MemorySearchResponse(BaseModel):
    results: list[MemorySearchResult]


class MemoryImportRequest(BaseModel):
    memories: list[MemoryCreate] = Field(min_length=1, max_length=500)
    namespace: Namespace = "default"


class MemoryBulkReview(BaseModel):
    memory_ids: list[UUID4] = Field(min_length=1, max_length=100)
    status: Literal["approved", "rejected"]
    namespace: Namespace = "default"


class MemoryRestore(BaseModel):
    version_id: UUID4


class MemoryFeedback(BaseModel):
    relevant: bool
    query: str | None = Field(default=None, max_length=4000)


class MemoryImportResponse(BaseModel):
    imported: int


class MemoryExportResponse(BaseModel):
    memories: list[MemoryResponse]


class MemorySourceResponse(BaseModel):
    memory: MemoryResponse
    conversation: dict[str, object] | None


class MemoryMergeSuggestion(BaseModel):
    primary: MemoryResponse
    duplicate: MemoryResponse
    reason: str


class MemoryMergeSuggestionsResponse(BaseModel):
    suggestions: list[MemoryMergeSuggestion]


class MemoryMergeRequest(BaseModel):
    primary_id: UUID4
    duplicate_id: UUID4
    content: str | None = Field(default=None, min_length=1, max_length=4000)


class MemoryTimelineItem(BaseModel):
    id: str
    type: str
    title: str
    category: str | None = None
    created_at: datetime


class MemoryTimelineResponse(BaseModel):
    items: list[MemoryTimelineItem]


class MemoryDecayResponse(BaseModel):
    updated: int
