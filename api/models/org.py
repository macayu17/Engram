from datetime import datetime

from pydantic import UUID4, BaseModel


class OrgCreate(BaseModel):
    name: str


class OrgResponse(BaseModel):
    id: UUID4
    name: str
    created_at: datetime
    role: str | None = None


class OrgMemberAdd(BaseModel):
    external_id: str
    role: str = "member"


class OrgMemberResponse(BaseModel):
    user_id: UUID4
    external_id: str
    role: str
    created_at: datetime
