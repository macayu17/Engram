from datetime import datetime

from pydantic import BaseModel, UUID4


class ConversationResponse(BaseModel):
    id: UUID4
    extraction_status: str
    memories_extracted: int
    created_at: datetime
