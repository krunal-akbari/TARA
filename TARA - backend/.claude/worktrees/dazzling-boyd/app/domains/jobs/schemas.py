from pydantic import BaseModel, Field


class JobCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255)
    description: str = Field(default="", max_length=4000)
    status: str = "draft"
    intake_channel: str = "direct_client"
    origin_client_id: int | None = None
    origin_vendor_id: int | None = None


class JobUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = Field(default=None, max_length=4000)
    status: str | None = None
    intake_channel: str | None = None


class JobResponse(BaseModel):
    id: int
    tenant_id: int
    title: str
    description: str
    status: str
    intake_channel: str
    origin_client_id: int | None = None
    origin_vendor_id: int | None = None
    owner_user_id: int
    deleted_at: str | None = None


class JobListResponse(BaseModel):
    items: list[JobResponse]
    total: int
