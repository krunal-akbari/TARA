from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.auth.models import Role, User, UserRole
from app.domains.tenancy.models import Tenant
from app.domains.tenancy.schemas import TenantBootstrapRequest
from app.platform.security import hash_password

DEFAULT_ROLES = ["admin", "manager", "recruiter"]


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


def bootstrap_tenant(db: Session, payload: TenantBootstrapRequest) -> tuple[Tenant, User, list[str]]:
    existing = db.scalar(select(Tenant).where(Tenant.name == payload.tenant_name))
    if existing:
        raise ValueError("Tenant already exists")

    tenant = Tenant(
        name=payload.tenant_name,
        currency_code=payload.currency_code,
        timezone=payload.timezone,
        resume_retention_days=payload.resume_retention_days,
        audit_retention_days=payload.audit_retention_days,
    )
    db.add(tenant)
    db.flush()

    admin_user = User(
        tenant_id=tenant.id,
        email=str(payload.admin_email).lower(),
        password_hash=hash_password(payload.admin_password),
        is_active=True,
    )
    db.add(admin_user)
    db.flush()

    roles = _ensure_default_roles(db)
    admin_role = next(role for role in roles if role.name == "admin")
    db.add(UserRole(user_id=admin_user.id, role_id=admin_role.id, tenant_id=tenant.id))

    db.commit()
    db.refresh(tenant)
    db.refresh(admin_user)
    return tenant, admin_user, [r.name for r in roles]
