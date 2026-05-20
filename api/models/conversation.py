from datetime import datetime

from pydantic import BaseModel, Field, UUID4


class ConversationResponse(BaseModel):
    id: UUID4
    extraction_status: str
    memories_extracted: int
    created_at: datetime


class ConversationCaptureRequest(BaseModel):
    user_message: str = Field(min_length=1, max_length=20000)
    assistant_response: str = Field(min_length=1, max_length=20000)
    source: str = Field(default="mcp", min_length=1, max_length=80)
    session_id: str | None = Field(default=None, max_length=255)


class ConversationCaptureResponse(BaseModel):
    conversation_id: UUID4
    memories_extracted: int
    extracted_memories: list[str]
    source: str
    session_id: str | None
