import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.auth.models import Role, User, UserRole
from app.domains.super_admin.models import SuperAdmin, SuperAdminEvent
from app.domains.tenancy.models import Tenant
from app.platform.security import (
    create_super_admin_access_token,
    create_super_admin_refresh_token,
    hash_password,
    verify_password,
)

logger = logging.getLogger(__name__)

DEFAULT_ROLES = ["admin", "manager", "recruiter"]
SEED_EMAIL = "superadmin@tara-ats.com"
SEED_PASSWORD = "SuperAdmin@123!"


# ── Activity recording ──


def _record_event(
    db: Session,
    *,
    actor_id: int,
    actor_email: str,
    action: str,
    target_type: str,
    target_id: int | None = None,
    target_label: str = "",
    detail: dict | None = None,
) -> None:
    db.add(
        SuperAdminEvent(
            actor_id=actor_id,
            actor_email=actor_email,
            action=action,
            target_type=target_type,
            target_id=target_id,
            target_label=target_label,
            detail=detail or {},
        )
    )


def list_events(
    db: Session, *, page: int = 1, page_size: int = 50
) -> tuple[list[SuperAdminEvent], int]:
    total = db.scalar(select(func.count()).select_from(SuperAdminEvent)) or 0
    items = list(
        db.scalars(
            select(SuperAdminEvent)
            .order_by(SuperAdminEvent.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return items, int(total)


# ── Dashboard stats ──


def get_dashboard_stats(db: Session) -> dict:
    tenants_total = db.scalar(select(func.count()).select_from(Tenant)) or 0
    tenants_active = (
        db.scalar(
            select(func.count()).select_from(Tenant).where(Tenant.status == "active")
        )
        or 0
    )
    tenants_inactive = tenants_total - tenants_active
    admins_total = db.scalar(select(func.count()).select_from(SuperAdmin)) or 0
    users_total = db.scalar(select(func.count()).select_from(User)) or 0
    events_total = db.scalar(select(func.count()).select_from(SuperAdminEvent)) or 0

    recent_tenants = list(
        db.scalars(
            select(Tenant).order_by(Tenant.id.desc()).limit(5)
        ).all()
    )

    return {
        "tenants_total": tenants_total,
        "tenants_active": tenants_active,
        "tenants_inactive": tenants_inactive,
        "admins_total": admins_total,
        "users_total": users_total,
        "events_total": events_total,
        "recent_tenants": [
            {"id": t.id, "name": t.name, "status": t.status} for t in recent_tenants
        ],
    }


# ── Seed ──


def seed_initial_super_admin(db: Session) -> None:
    exists = db.scalar(select(func.count()).select_from(SuperAdmin))
    if exists:
        return
    admin = SuperAdmin(
        email=SEED_EMAIL,
        password_hash=hash_password(SEED_PASSWORD),
        is_active=True,
    )
    db.add(admin)
    db.flush()
    _record_event(
        db,
        actor_id=admin.id,
        actor_email=admin.email,
        action="seed",
        target_type="super_admin",
        target_id=admin.id,
        target_label=admin.email,
        detail={"note": "Initial Super Admin seeded on first startup"},
    )
    db.commit()
    logger.info("Seeded initial Super Admin: %s", SEED_EMAIL)


# ── Auth ──


def authenticate_super_admin(
    db: Session, *, email: str, password: str
) -> tuple[str, str] | None:
    admin = db.scalar(
        select(SuperAdmin).where(SuperAdmin.email == email.lower())
    )
    if not admin or not admin.is_active:
        return None
    if not verify_password(password, admin.password_hash):
        return None
    _record_event(
        db,
        actor_id=admin.id,
        actor_email=admin.email,
        action="login",
        target_type="super_admin",
        target_id=admin.id,
        target_label=admin.email,
    )
    db.commit()
    return (
        create_super_admin_access_token(admin_id=admin.id),
        create_super_admin_refresh_token(admin_id=admin.id),
    )


def get_super_admin_by_id(db: Session, admin_id: int) -> SuperAdmin | None:
    return db.scalar(
        select(SuperAdmin).where(SuperAdmin.id == admin_id, SuperAdmin.is_active.is_(True))
    )


# ── Super Admin CRUD ──


def create_super_admin(
    db: Session, *, email: str, password: str, actor: SuperAdmin
) -> SuperAdmin:
    existing = db.scalar(
        select(SuperAdmin).where(SuperAdmin.email == email.lower())
    )
    if existing:
        raise ValueError("A Super Admin with this email already exists")
    admin = SuperAdmin(
        email=email.lower(),
        password_hash=hash_password(password),
        is_active=True,
    )
    db.add(admin)
    db.flush()
    _record_event(
        db,
        actor_id=actor.id,
        actor_email=actor.email,
        action="create",
        target_type="super_admin",
        target_id=admin.id,
        target_label=admin.email,
    )
    db.commit()
    db.refresh(admin)
    return admin


def list_super_admins(db: Session) -> list[SuperAdmin]:
    return list(db.scalars(select(SuperAdmin).order_by(SuperAdmin.id)).all())


# ── Tenant management ──


def _ensure_default_roles(db: Session) -> list[Role]:
    roles: list[Role] = []
    for role_name in DEFAULT_ROLES:
        role = db.scalar(select(Role).where(Role.name == role_name))
        if not role:
            role = Role(name=role_name)
            db.add(role)
            db.flush()
        roles.append(role)
    return roles


def create_tenant(
    db: Session,
    *,
    tenant_name: str,
    admin_email: str,
    admin_password: str,
    currency_code: str,
    timezone: str,
    resume_retention_days: int,
    audit_retention_days: int,
    actor: SuperAdmin,
) -> Tenant:
    existing = db.scalar(select(Tenant).where(Tenant.name == tenant_name))
    if existing:
        raise ValueError("Tenant already exists")

    tenant = Tenant(
        name=tenant_name,
        currency_code=currency_code,
        timezone=timezone,
        resume_retention_days=resume_retention_days,
        audit_retention_days=audit_retention_days,
    )
    db.add(tenant)
    db.flush()

    admin_user = User(
        tenant_id=tenant.id,
        email=admin_email.lower(),
        password_hash=hash_password(admin_password),
        is_active=True,
    )
    db.add(admin_user)
    db.flush()

    roles = _ensure_default_roles(db)
    admin_role = next(r for r in roles if r.name == "admin")
    db.add(UserRole(user_id=admin_user.id, role_id=admin_role.id, tenant_id=tenant.id))

    _record_event(
        db,
        actor_id=actor.id,
        actor_email=actor.email,
        action="create",
        target_type="tenant",
        target_id=tenant.id,
        target_label=tenant.name,
        detail={
            "admin_email": admin_email,
            "currency_code": currency_code,
            "timezone": timezone,
        },
    )

    db.commit()
    db.refresh(tenant)
    return tenant


def list_tenants(db: Session) -> list[Tenant]:
    return list(db.scalars(select(Tenant).order_by(Tenant.id)).all())


def get_tenant_by_id(db: Session, tenant_id: int) -> Tenant | None:
    return db.scalar(select(Tenant).where(Tenant.id == tenant_id))


def update_tenant(
    db: Session, tenant_id: int, *, actor: SuperAdmin, **fields: object
) -> Tenant:
    tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise ValueError("Tenant not found")
    changed = {}
    for key, value in fields.items():
        if value is not None:
            changed[key] = value
            setattr(tenant, key, value)
    _record_event(
        db,
        actor_id=actor.id,
        actor_email=actor.email,
        action="update",
        target_type="tenant",
        target_id=tenant.id,
        target_label=tenant.name,
        detail=changed,
    )
    db.commit()
    db.refresh(tenant)
    return tenant


def deactivate_tenant(db: Session, tenant_id: int, *, actor: SuperAdmin) -> Tenant:
    tenant = db.scalar(select(Tenant).where(Tenant.id == tenant_id))
    if not tenant:
        raise ValueError("Tenant not found")
    tenant.status = "inactive"
    _record_event(
        db,
        actor_id=actor.id,
        actor_email=actor.email,
        action="deactivate",
        target_type="tenant",
        target_id=tenant.id,
        target_label=tenant.name,
    )
    db.commit()
    db.refresh(tenant)
    return tenant
