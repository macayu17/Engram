from datetime import datetime

from pydantic import BaseModel, Field, UUID4


class UserCreate(BaseModel):
    external_id: str = Field(min_length=1, max_length=255)


class ServiceUserKeyCreate(BaseModel):
    external_id: str = Field(min_length=1, max_length=255)
    key_name: str = Field(default="clerk", min_length=1, max_length=80)


class UserResponse(BaseModel):
    id: UUID4
    external_id: str
    created_at: datetime


class UserCreateResponse(UserResponse):
    api_key: str
