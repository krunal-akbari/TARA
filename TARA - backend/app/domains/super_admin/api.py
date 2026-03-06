from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.domains.super_admin.models import SuperAdmin
from app.domains.super_admin.schemas import (
    ActivityEventResponse,
    ActivityListResponse,
    CreateSuperAdminRequest,
    CreateTenantRequest,
    DashboardStatsResponse,
    SuperAdminLoginRequest,
    SuperAdminResponse,
    SuperAdminTokenResponse,
    TenantListResponse,
    TenantResponse,
    UpdateTenantRequest,
)
from app.domains.super_admin.service import (
    activate_tenant,
    authenticate_super_admin,
    create_super_admin,
    create_tenant,
    deactivate_tenant,
    get_dashboard_stats,
    get_super_admin_by_id,
    get_tenant_by_id,
    list_events,
    list_super_admins,
    list_tenants,
    update_tenant,
)
from app.platform.db import get_db
from app.platform.security import decode_token

router = APIRouter(prefix="/super-admin", tags=["Super Admin"])

_oauth2 = OAuth2PasswordBearer(tokenUrl="/api/v1/super-admin/login")


def get_current_super_admin(
    db: Session = Depends(get_db),
    token: str = Depends(_oauth2),
) -> SuperAdmin:
    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        ) from exc

    if payload.get("role") != "super_admin" or payload.get("token_type") != "access":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Super Admin access required"
        )

    admin = get_super_admin_by_id(db, int(payload["sub"]))
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing Super Admin"
        )
    return admin


# ── Auth ──


@router.post("/login", response_model=SuperAdminTokenResponse)
def login(payload: SuperAdminLoginRequest, db: Session = Depends(get_db)):
    tokens = authenticate_super_admin(
        db, email=str(payload.email), password=payload.password
    )
    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    return SuperAdminTokenResponse(access_token=tokens[0], refresh_token=tokens[1])


@router.get("/me", response_model=SuperAdminResponse)
def me(current: SuperAdmin = Depends(get_current_super_admin)):
    return SuperAdminResponse(id=current.id, email=current.email, is_active=current.is_active)


# ── Dashboard & Activity ──


@router.get("/dashboard", response_model=DashboardStatsResponse)
def dashboard(
    db: Session = Depends(get_db),
    _current: SuperAdmin = Depends(get_current_super_admin),
):
    return get_dashboard_stats(db)


@router.get("/activity", response_model=ActivityListResponse)
def activity(
    db: Session = Depends(get_db),
    _current: SuperAdmin = Depends(get_current_super_admin),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
):
    items, total = list_events(db, page=page, page_size=page_size)
    return ActivityListResponse(
        items=[
            ActivityEventResponse(
                id=e.id,
                actor_email=e.actor_email,
                action=e.action,
                target_type=e.target_type,
                target_id=e.target_id,
                target_label=e.target_label,
                detail=e.detail,
                created_at=e.created_at,
            )
            for e in items
        ],
        total=total,
    )


# ── Super Admin CRUD ──


@router.post("/admins", response_model=SuperAdminResponse, status_code=status.HTTP_201_CREATED)
def create_admin(
    payload: CreateSuperAdminRequest,
    db: Session = Depends(get_db),
    current: SuperAdmin = Depends(get_current_super_admin),
):
    try:
        admin = create_super_admin(
            db, email=str(payload.email), password=payload.password, actor=current
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return SuperAdminResponse(id=admin.id, email=admin.email, is_active=admin.is_active)


@router.get("/admins", response_model=list[SuperAdminResponse])
def list_admins(
    db: Session = Depends(get_db),
    _current: SuperAdmin = Depends(get_current_super_admin),
):
    admins = list_super_admins(db)
    return [
        SuperAdminResponse(id=a.id, email=a.email, is_active=a.is_active) for a in admins
    ]


# ── Tenant CRUD ──


@router.post("/tenants", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
def create_tenant_endpoint(
    payload: CreateTenantRequest,
    db: Session = Depends(get_db),
    current: SuperAdmin = Depends(get_current_super_admin),
):
    try:
        tenant = create_tenant(
            db,
            tenant_name=payload.tenant_name,
            admin_email=str(payload.admin_email),
            admin_password=payload.admin_password,
            admin_first_name=payload.admin_first_name,
            admin_last_name=payload.admin_last_name,
            currency_code=payload.currency_code,
            timezone=payload.timezone,
            resume_retention_days=payload.resume_retention_days,
            audit_retention_days=payload.audit_retention_days,
            actor=current,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        status=tenant.status,
        currency_code=tenant.currency_code,
        timezone=tenant.timezone,
        resume_retention_days=tenant.resume_retention_days,
        audit_retention_days=tenant.audit_retention_days,
    )


@router.get("/tenants", response_model=TenantListResponse)
def list_tenants_endpoint(
    db: Session = Depends(get_db),
    _current: SuperAdmin = Depends(get_current_super_admin),
):
    tenants = list_tenants(db)
    items = [
        TenantResponse(
            id=t.id,
            name=t.name,
            status=t.status,
            currency_code=t.currency_code,
            timezone=t.timezone,
            resume_retention_days=t.resume_retention_days,
            audit_retention_days=t.audit_retention_days,
        )
        for t in tenants
    ]
    return TenantListResponse(items=items, total=len(items))


@router.patch("/tenants/{tenant_id}", response_model=TenantResponse)
def update_tenant_endpoint(
    tenant_id: int,
    payload: UpdateTenantRequest,
    db: Session = Depends(get_db),
    current: SuperAdmin = Depends(get_current_super_admin),
):
    existing = get_tenant_by_id(db, tenant_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    try:
        tenant = update_tenant(
            db,
            tenant_id,
            actor=current,
            name=payload.name,
            currency_code=payload.currency_code,
            timezone=payload.timezone,
            resume_retention_days=payload.resume_retention_days,
            audit_retention_days=payload.audit_retention_days,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        status=tenant.status,
        currency_code=tenant.currency_code,
        timezone=tenant.timezone,
        resume_retention_days=tenant.resume_retention_days,
        audit_retention_days=tenant.audit_retention_days,
    )


@router.post("/tenants/{tenant_id}/deactivate", response_model=TenantResponse)
def deactivate_tenant_endpoint(
    tenant_id: int,
    db: Session = Depends(get_db),
    current: SuperAdmin = Depends(get_current_super_admin),
):
    existing = get_tenant_by_id(db, tenant_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    tenant = deactivate_tenant(db, tenant_id, actor=current)
    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        status=tenant.status,
        currency_code=tenant.currency_code,
        timezone=tenant.timezone,
        resume_retention_days=tenant.resume_retention_days,
        audit_retention_days=tenant.audit_retention_days,
    )


@router.post("/tenants/{tenant_id}/activate", response_model=TenantResponse)
def activate_tenant_endpoint(
    tenant_id: int,
    db: Session = Depends(get_db),
    current: SuperAdmin = Depends(get_current_super_admin),
):
    existing = get_tenant_by_id(db, tenant_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found")
    tenant = activate_tenant(db, tenant_id, actor=current)
    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        status=tenant.status,
        currency_code=tenant.currency_code,
        timezone=tenant.timezone,
        resume_retention_days=tenant.resume_retention_days,
        audit_retention_days=tenant.audit_retention_days,
    )
