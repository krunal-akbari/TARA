from datetime import datetime
from typing import Literal

from pydantic import BaseModel, model_validator


class ClientVendorLinkCreate(BaseModel):
    client_id: int
    vendor_id: int
    status: Literal["active", "inactive"] = "active"
    priority: Literal["hot", "warm", "cold"] = "hot"
    effective_from: datetime | None = None
    effective_to: datetime | None = None

    @model_validator(mode="after")
    def validate_effective_range(self) -> "ClientVendorLinkCreate":
        if self.effective_from and self.effective_to and self.effective_from > self.effective_to:
            raise ValueError("effective_from must be <= effective_to")
        return self


class ClientVendorLinkUpdate(BaseModel):
    status: Literal["active", "inactive"] | None = None
    priority: Literal["hot", "warm", "cold"] | None = None
    effective_from: datetime | None = None
    effective_to: datetime | None = None

    @model_validator(mode="after")
    def validate_effective_range(self) -> "ClientVendorLinkUpdate":
        if self.effective_from and self.effective_to and self.effective_from > self.effective_to:
            raise ValueError("effective_from must be <= effective_to")
        return self


class ClientVendorLinkResponse(BaseModel):
    id: int
    tenant_id: int
    client_id: int
    vendor_id: int
    status: str
    priority: str
    effective_from: datetime | None = None
    effective_to: datetime | None = None
    deleted_at: str | None = None


class ClientVendorLinkListResponse(BaseModel):
    items: list[ClientVendorLinkResponse]
    total: int
