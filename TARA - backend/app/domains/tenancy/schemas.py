from pydantic import BaseModel, EmailStr, Field


class TenantBootstrapRequest(BaseModel):
    tenant_name: str = Field(min_length=2, max_length=255)
    admin_email: EmailStr
    admin_password: str = Field(min_length=8, max_length=128)
    currency_code: str = "USD"
    timezone: str = "UTC"
    resume_retention_days: int = Field(default=365, ge=30, le=3650)
    audit_retention_days: int = Field(default=730, ge=90, le=3650)


class TenantBootstrapResponse(BaseModel):
    tenant_id: int
    admin_user_id: int
    default_roles: list[str]
