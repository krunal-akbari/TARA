from fastapi import APIRouter, Body, Cookie, Depends, HTTPException, Request, Response, status
from slowapi import Limiter
from sqlalchemy.orm import Session

from app.domains.auth.models import User
from app.domains.auth.schemas import (
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    UserResponse,
)
from app.domains.auth.service import (
    authenticate,
    get_user_roles,
    refresh_tokens,
    revoke_refresh_token,
)
from app.platform.db import get_db
from app.platform.dependencies import get_current_user
from app.platform.rate_limiter import limiter
from app.platform.settings import get_settings

router = APIRouter(prefix="/auth", tags=["Auth"])
auth_limiter: Limiter = limiter
settings = get_settings()
COOKIE_SECURE = settings.env.lower() not in {"local", "dev", "development"}


@router.post("/login")
@auth_limiter.limit("5/minute")
def login(
    request: Request,
    response: Response,
    payload: LoginRequest,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    tokens = authenticate(
        db=db,
        email=str(payload.email),
        password=payload.password,
    )
    if not tokens:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    response.set_cookie(
        key="access_token",
        value=tokens[0],
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=1800,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=tokens[1],
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=604800,
        path="/api/v1/auth",
    )
    return {"status": "success", "message": "Logged in successfully"}


@router.post("/refresh")
@auth_limiter.limit("10/minute")
def refresh(
    request: Request,
    response: Response,
    payload: RefreshRequest | None = Body(default=None),
    refresh_token_cookie: str | None = Cookie(default=None, alias="refresh_token"),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    refresh_token_value = payload.refresh_token if payload else refresh_token_cookie
    if not refresh_token_value:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")

    try:
        access_token, refresh_token = refresh_tokens(db=db, refresh_token=refresh_token_value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=1800,
        path="/",
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="strict",
        max_age=604800,
        path="/api/v1/auth",
    )
    return {"status": "success", "message": "Session refreshed"}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    payload: LogoutRequest | None = Body(default=None),
    refresh_token_cookie: str | None = Cookie(default=None, alias="refresh_token"),
    db: Session = Depends(get_db),
) -> None:
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/v1/auth")

    refresh_token_value = payload.refresh_token if payload else refresh_token_cookie
    if not refresh_token_value:
        return None

    try:
        revoke_refresh_token(db=db, refresh_token=refresh_token_value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return None


@router.get("/me", response_model=UserResponse)
def me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    roles = get_user_roles(db=db, user_id=current_user.id, tenant_id=current_user.tenant_id)
    return UserResponse(
        id=current_user.id,
        tenant_id=current_user.tenant_id,
        email=current_user.email,
        is_active=current_user.is_active,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        roles=roles,
    )
