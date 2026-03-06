from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.auth.models import RevokedToken, Role, User, UserRole
from app.platform.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)


def get_user_roles(db: Session, user_id: int, tenant_id: int) -> list[str]:
    rows = db.execute(
        select(Role.name)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id, UserRole.tenant_id == tenant_id)
    ).all()
    return [str(row[0]).strip().lower() for row in rows if row[0]]


def authenticate(db: Session, *, email: str, password: str) -> tuple[str, str] | None:
    normalized_email = email.strip().lower()
    candidates = db.scalars(
        select(User).where(
            User.email == normalized_email,
            User.is_active.is_(True),
            User.deleted_at.is_(None),
        )
    ).all()
    for user in candidates:
        if not verify_password(password, user.password_hash):
            continue
        roles = get_user_roles(db=db, user_id=user.id, tenant_id=user.tenant_id)
        return (
            create_access_token(user_id=user.id, tenant_id=user.tenant_id, roles=roles),
            create_refresh_token(user_id=user.id, tenant_id=user.tenant_id, roles=roles),
        )
    return None


def is_token_revoked(db: Session, jti: str) -> bool:
    if not jti:
        return True
    token = db.scalar(select(RevokedToken).where(RevokedToken.jti == jti))
    return token is not None


def revoke_refresh_token(db: Session, refresh_token: str) -> None:
    payload = decode_token(refresh_token)
    if payload.get("token_type") != "refresh":
        raise ValueError("Not a refresh token")
    jti = payload.get("jti")
    if not jti:
        raise ValueError("Token missing jti")
    if is_token_revoked(db=db, jti=jti):
        return

    revoked = RevokedToken(
        tenant_id=int(payload["tenant_id"]),
        user_id=int(payload["sub"]),
        jti=jti,
        expires_at=datetime.fromtimestamp(payload["exp"], tz=UTC) if payload.get("exp") else None,
        revoked_at=datetime.now(UTC),
    )
    db.add(revoked)
    db.commit()


def refresh_tokens(db: Session, refresh_token: str) -> tuple[str, str]:
    payload = decode_token(refresh_token)
    if payload.get("token_type") != "refresh":
        raise ValueError("Not a refresh token")
    if is_token_revoked(db=db, jti=payload.get("jti", "")):
        raise ValueError("Refresh token revoked")

    user = db.scalar(select(User).where(User.id == int(payload.get("sub")), User.tenant_id == int(payload.get("tenant_id"))))
    if not user or not user.is_active:
        raise ValueError("User not active")

    revoke_refresh_token(db=db, refresh_token=refresh_token)

    roles = get_user_roles(db=db, user_id=user.id, tenant_id=user.tenant_id)
    return (
        create_access_token(user_id=user.id, tenant_id=user.tenant_id, roles=roles),
        create_refresh_token(user_id=user.id, tenant_id=user.tenant_id, roles=roles),
    )
