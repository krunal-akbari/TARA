from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.auth.models import Role, User, UserRole
from app.platform.security import hash_password

ALLOWED_USER_ROLES = {"admin", "manager", "recruiter", "hr"}


def list_users(
    db: Session,
    *,
    tenant_id: int,
    page: int = 1,
    page_size: int = 20,
    include_deleted: bool = False,
) -> tuple[list[User], int]:
    query = select(User).where(User.tenant_id == tenant_id)
    if not include_deleted:
        query = query.where(User.deleted_at.is_(None))

    total_query = select(func.count()).select_from(User).where(User.tenant_id == tenant_id)
    if not include_deleted:
        total_query = total_query.where(User.deleted_at.is_(None))
    total = db.scalar(total_query) or 0

    users = db.scalars(
        query.order_by(User.id.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return users, int(total)


def _get_role(db: Session, *, role_name: str) -> Role:
    normalized = role_name.strip().lower()
    role = db.scalar(select(Role).where(func.lower(func.trim(Role.name)) == normalized))
    if role:
        return role

    if normalized in ALLOWED_USER_ROLES:
        role = Role(name=normalized)
        db.add(role)
        db.flush()
        return role

    if not role:
        raise ValueError(f"Unknown role: {role_name}")


def _get_user_roles(db: Session, *, user_id: int, tenant_id: int) -> list[str]:
    rows = db.execute(
        select(Role.name)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id, UserRole.tenant_id == tenant_id)
        .order_by(Role.name.asc())
    ).all()
    return [str(row[0]).strip().lower() for row in rows if row[0]]


def create_user(
    db: Session,
    *,
    tenant_id: int,
    email: str,
    password: str,
    first_name: str,
    last_name: str,
    role_name: str,
) -> tuple[User, list[str]]:
    normalized_email = email.strip().lower()
    if db.scalar(select(User).where(User.tenant_id == tenant_id, User.email == normalized_email)):
        raise ValueError("User with this email already exists")

    role = _get_role(db, role_name=role_name)
    user = User(
        tenant_id=tenant_id,
        email=normalized_email,
        password_hash=hash_password(password),
        is_active=True,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
    )
    db.add(user)
    db.flush()

    db.add(UserRole(tenant_id=tenant_id, user_id=user.id, role_id=role.id))
    db.commit()
    db.refresh(user)
    roles = _get_user_roles(db, user_id=user.id, tenant_id=tenant_id)
    return user, roles


def user_roles_for_list(db: Session, *, user_id: int, tenant_id: int) -> list[str]:
    return _get_user_roles(db, user_id=user_id, tenant_id=tenant_id)
