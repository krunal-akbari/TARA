from typing import Literal

from pydantic import BaseModel, Field


class VendorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    status: Literal["active", "inactive"] = "active"
    client_ids: list[int] | None = None
    client_names: list[str] | None = None
    address: str | None = None
    sector: str | None = None


class VendorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    status: Literal["active", "inactive"] | None = None
    address: str | None = None
    sector: str | None = None


class VendorResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    status: str
    owner_user_id: int
    address: str | None = None
    sector: str | None = None
    deleted_at: str | None = None


class VendorListResponse(BaseModel):
    items: list[VendorResponse]
    total: int


class VendorContactCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)


class VendorContactUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=128)
    last_name: str | None = Field(default=None, min_length=1, max_length=128)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)


class VendorContactResponse(BaseModel):
    id: int
    vendor_id: int
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
