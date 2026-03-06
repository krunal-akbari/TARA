from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.domains.tenancy.schemas import TenantBootstrapRequest, TenantBootstrapResponse
from app.domains.tenancy.service import bootstrap_tenant
from app.platform.db import get_db
from app.platform.settings import get_settings

router = APIRouter(prefix="/admin/tenants", tags=["Tenancy"])
public_router = APIRouter(prefix="/public", tags=["Tenancy"])
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
