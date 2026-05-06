from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.domains.auth.models import User
from app.domains.tenancy.schemas import TenantBootstrapRequest, TenantBootstrapResponse
from app.domains.tenancy.schemas import (
    TenantResumeUploadSettingsResponse,
    TenantResumeUploadSettingsUpdateRequest,
)
from app.domains.tenancy.service import (
    bootstrap_tenant,
    get_effective_resume_upload_max_bytes,
    get_tenant_by_id,
    update_tenant_resume_upload_max_bytes,
)
from app.platform.db import get_db
from app.platform.dependencies import get_current_user, require_role_dependency
from app.platform.settings import get_settings

router = APIRouter(prefix="/admin/tenants", tags=["Tenancy"])
public_router = APIRouter(prefix="/public", tags=["Tenancy"])
tenant_settings_router = APIRouter(prefix="/tenants/me", tags=["Tenancy"])
settings = get_settings()


def _csv_values(raw: str) -> set[str]:
    return {item.strip() for item in raw.split(",") if item.strip()}


@router.post("/bootstrap", response_model=TenantBootstrapResponse, status_code=status.HTTP_201_CREATED)
def bootstrap_tenant_endpoint(
    payload: TenantBootstrapRequest,
    db: Session = Depends(get_db),
    x_bootstrap_key: str | None = Header(default=None, alias="X-Bootstrap-Key"),
) -> TenantBootstrapResponse:
    if not x_bootstrap_key or x_bootstrap_key != settings.bootstrap_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid bootstrap key")

    try:
        tenant, admin_user, roles = bootstrap_tenant(db=db, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return TenantBootstrapResponse(tenant_id=tenant.id, admin_user_id=admin_user.id, default_roles=roles)


@public_router.post("/onboarding", response_model=TenantBootstrapResponse, status_code=status.HTTP_201_CREATED)
def public_onboarding_endpoint(
    payload: TenantBootstrapRequest,
    db: Session = Depends(get_db),
    x_onboarding_key: str | None = Header(default=None, alias="X-Onboarding-Key"),
) -> TenantBootstrapResponse:
    allowed_keys = _csv_values(settings.public_onboarding_keys)
    if not allowed_keys:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Public onboarding is not configured",
        )
    if not x_onboarding_key or x_onboarding_key not in allowed_keys:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid onboarding key")

    allowed_emails = {email.lower() for email in _csv_values(settings.public_onboarding_allowed_emails)}
    if allowed_emails and str(payload.admin_email).lower() not in allowed_emails:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin email is not allowed for public onboarding",
        )

    try:
        tenant, admin_user, roles = bootstrap_tenant(db=db, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return TenantBootstrapResponse(tenant_id=tenant.id, admin_user_id=admin_user.id, default_roles=roles)


def _to_resume_upload_settings_response(tenant) -> TenantResumeUploadSettingsResponse:
    effective_bytes = get_effective_resume_upload_max_bytes(tenant=tenant)
    return TenantResumeUploadSettingsResponse(
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        bulk_parse_resume_limit_mb=max(1, effective_bytes // (1024 * 1024)),
        bulk_parse_resume_limit_bytes=effective_bytes,
        uses_system_default=tenant.resume_upload_max_bytes is None,
    )


@tenant_settings_router.get("/settings/resume-upload", response_model=TenantResumeUploadSettingsResponse)
def get_current_tenant_resume_upload_settings_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TenantResumeUploadSettingsResponse:
    tenant = get_tenant_by_id(db=db, tenant_id=current_user.tenant_id)
    if not tenant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    return _to_resume_upload_settings_response(tenant)


@tenant_settings_router.patch(
    "/settings/resume-upload",
    response_model=TenantResumeUploadSettingsResponse,
    dependencies=[Depends(require_role_dependency("admin"))],
)
def update_current_tenant_resume_upload_settings_endpoint(
    payload: TenantResumeUploadSettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TenantResumeUploadSettingsResponse:
    resume_upload_max_bytes = (
        None if payload.bulk_parse_resume_limit_mb is None else payload.bulk_parse_resume_limit_mb * 1024 * 1024
    )
    try:
        tenant = update_tenant_resume_upload_max_bytes(
            db=db,
            tenant_id=current_user.tenant_id,
            resume_upload_max_bytes=resume_upload_max_bytes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    return _to_resume_upload_settings_response(tenant)
