from datetime import UTC, datetime, timedelta
from uuid import uuid4

from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError

from app.platform.settings import get_settings

pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated=["bcrypt"])
settings = get_settings()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except UnknownHashError:
        return False


def _create_token(payload: dict, expires_delta: timedelta) -> str:
    to_encode = payload.copy()
    expire = datetime.now(UTC) + expires_delta
    to_encode.update({"exp": expire, "jti": str(uuid4())})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(*, user_id: int, tenant_id: int, roles: list[str]) -> str:
    return _create_token(
        {
            "sub": str(user_id),
            "tenant_id": tenant_id,
            "roles": roles,
            "token_type": "access",
        },
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_refresh_token(*, user_id: int, tenant_id: int, roles: list[str]) -> str:
    return _create_token(
        {
            "sub": str(user_id),
            "tenant_id": tenant_id,
            "roles": roles,
            "token_type": "refresh",
        },
        timedelta(minutes=settings.refresh_token_expire_minutes),
    )


def create_super_admin_access_token(*, admin_id: int) -> str:
    return _create_token(
        {
            "sub": str(admin_id),
            "role": "super_admin",
            "token_type": "access",
        },
        timedelta(minutes=settings.access_token_expire_minutes),
    )


def create_super_admin_refresh_token(*, admin_id: int) -> str:
    return _create_token(
        {
            "sub": str(admin_id),
            "role": "super_admin",
            "token_type": "refresh",
        },
        timedelta(minutes=settings.refresh_token_expire_minutes),
    )


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
    except JWTError as exc:
        raise ValueError("Invalid or expired token") from exc
