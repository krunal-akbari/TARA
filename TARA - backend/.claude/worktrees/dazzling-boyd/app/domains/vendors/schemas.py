from pydantic import BaseModel, Field


class VendorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    status: str = Field(default="active")
    client_id: int


class VendorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    status: str | None = None


class VendorResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    status: str
    owner_user_id: int
    deleted_at: str | None = None


class VendorListResponse(BaseModel):
    items: list[VendorResponse]
    total: int
