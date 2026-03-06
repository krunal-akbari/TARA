from datetime import datetime

from pydantic import BaseModel, Field


class ClientVendorLinkCreate(BaseModel):
    client_id: int
    vendor_id: int
    status: str = "active"
    priority: int = Field(default=100, ge=1, le=1000)
    effective_from: datetime | None = None
    effective_to: datetime | None = None


class ClientVendorLinkUpdate(BaseModel):
    status: str | None = None
    priority: int | None = Field(default=None, ge=1, le=1000)
    effective_from: datetime | None = None
    effective_to: datetime | None = None


class ClientVendorLinkResponse(BaseModel):
    id: int
    tenant_id: int
    client_id: int
    vendor_id: int
    status: str
    priority: int
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    deleted_at: str | None = None


class ClientVendorLinkListResponse(BaseModel):
    items: list[ClientVendorLinkResponse]
    total: int
