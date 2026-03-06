from fastapi import Cookie, Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.access.service import require_roles
from app.domains.auth.models import User
from app.domains.auth.service import get_user_roles, is_token_revoked
from app.platform.db import get_db
from app.platform.security import decode_token

def get_current_user(
    db: Session = Depends(get_db),
    token: str | None = Cookie(default=None, alias="access_token"),
    x_tenant_id: int | None = Header(default=None, alias="X-Tenant-Id"),
) -> User:
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing access token")

    try:
        payload = decode_token(token)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    if payload.get("token_type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")

    tenant_claim = payload.get("tenant_id")
    if tenant_claim is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing tenant claim")
    try:
        tenant_id = int(tenant_claim)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid tenant claim") from exc

    if x_tenant_id is not None and x_tenant_id != tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant header mismatch")

    try:
        user_id = int(payload.get("sub"))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid subject claim") from exc

    user = db.scalar(select(User).where(User.id == user_id, User.tenant_id == tenant_id))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or missing user")

    if is_token_revoked(db=db, jti=payload.get("jti", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has been revoked")

    return user


def get_current_tenant_id(current_user: User = Depends(get_current_user)) -> int:
    return current_user.tenant_id


def get_current_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[str]:
    return get_user_roles(db=db, user_id=current_user.id, tenant_id=current_user.tenant_id)


def require_role_dependency(*allowed_roles: str):
    def _dep(roles: list[str] = Depends(get_current_roles)) -> None:
        require_roles(roles, set(allowed_roles))

    return _dep
