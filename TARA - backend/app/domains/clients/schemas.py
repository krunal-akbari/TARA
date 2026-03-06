from typing import Literal

from pydantic import BaseModel, Field


class ClientCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    status: Literal["active", "inactive"] = "active"
    vendor_id: int | None = None
    vendor_name: str | None = None
    address: str | None = None
    sector: str | None = None


class ClientUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    status: Literal["active", "inactive"] | None = None
    address: str | None = None
    sector: str | None = None


class ClientResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    status: str
    owner_user_id: int
    address: str | None = None
    sector: str | None = None
    deleted_at: str | None = None


class ClientListResponse(BaseModel):
    items: list[ClientResponse]
    total: int


class ClientContactCreate(BaseModel):
    first_name: str = Field(min_length=1, max_length=128)
    last_name: str = Field(min_length=1, max_length=128)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)


class ClientContactUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=128)
    last_name: str | None = Field(default=None, min_length=1, max_length=128)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=64)


class ClientContactResponse(BaseModel):
    id: int
    client_id: int
    first_name: str
    last_name: str
    email: str | None = None
    phone: str | None = None
