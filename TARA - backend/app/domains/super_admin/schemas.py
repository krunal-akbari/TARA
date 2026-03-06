from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class SuperAdminLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class SuperAdminTokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class SuperAdminResponse(BaseModel):
    id: int
    email: str
    is_active: bool


class CreateSuperAdminRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class CreateTenantRequest(BaseModel):
    tenant_name: str = Field(min_length=2, max_length=255)
    admin_email: EmailStr
    admin_password: str = Field(min_length=8, max_length=128)
    admin_first_name: str = Field(default="", max_length=128)
    admin_last_name: str = Field(default="", max_length=128)
    currency_code: str = "USD"
    timezone: str = "UTC"
    resume_retention_days: int = Field(default=365, ge=30, le=3650)
    audit_retention_days: int = Field(default=730, ge=90, le=3650)


class TenantResponse(BaseModel):
    id: int
    name: str
    status: str
    currency_code: str
    timezone: str
    resume_retention_days: int
    audit_retention_days: int


class TenantListResponse(BaseModel):
    items: list[TenantResponse]
    total: int


class UpdateTenantRequest(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=255)
    currency_code: str | None = None
    timezone: str | None = None
    resume_retention_days: int | None = Field(default=None, ge=30, le=3650)
    audit_retention_days: int | None = Field(default=None, ge=90, le=3650)


class RecentTenant(BaseModel):
    id: int
    name: str
    status: str


class DashboardStatsResponse(BaseModel):
    tenants_total: int
    tenants_active: int
    tenants_inactive: int
    admins_total: int
    users_total: int
    events_total: int
    recent_tenants: list[RecentTenant]


class ActivityEventResponse(BaseModel):
    id: int
    actor_email: str
    action: str
    target_type: str
    target_id: int | None
    target_label: str
    detail: dict
    created_at: datetime


class ActivityListResponse(BaseModel):
    items: list[ActivityEventResponse]
    total: int
