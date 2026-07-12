from datetime import datetime

from pydantic import BaseModel, HttpUrl, UUID4


class UsageValues(BaseModel):
    members: int
    memories: int
    retrievals: int


class WorkspaceUsageResponse(BaseModel):
    plan: str
    subscription_status: str
    period_start: datetime
    current_period_end: datetime | None
    members: int
    memories: int
    retrievals: int
    limits: UsageValues


class BillingUrlResponse(BaseModel):
    url: HttpUrl


class BillingWorkspaceRequest(BaseModel):
    external_id: str
    org_id: UUID4
