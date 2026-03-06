from pydantic import BaseModel, Field


class ClientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    status: str = Field(default="active")
    vendor_id: int | None = None


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    status: str | None = None


class ClientResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    status: str
    owner_user_id: int
    deleted_at: str | None = None


class ClientListResponse(BaseModel):
    items: list[ClientResponse]
    total: int
