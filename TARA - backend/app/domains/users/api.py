from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.domains.auth.models import User
from app.domains.users.schemas import UserCreateRequest, UserItemResponse, UserListResponse
from app.domains.users.service import create_user, list_users, user_roles_for_list
from app.platform.db import get_db
from app.platform.dependencies import get_current_user, require_role_dependency

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "",
    response_model=UserListResponse,
    dependencies=[Depends(require_role_dependency("admin"))],
)
def list_users_endpoint(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    include_deleted: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    users, total = list_users(
        db=db,
        tenant_id=current_user.tenant_id,
        include_deleted=include_deleted,
        page=page,
        page_size=page_size,
    )
    items = [
        UserItemResponse(
            id=user.id,
            tenant_id=user.tenant_id,
            email=user.email,
            is_active=user.is_active,
            first_name=user.first_name,
            last_name=user.last_name,
            roles=user_roles_for_list(db=db, user_id=user.id, tenant_id=current_user.tenant_id),
        )
        for user in users
    ]
    return UserListResponse(items=items, total=total)


@router.post(
    "",
    response_model=UserItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role_dependency("admin"))],
)
def create_user_endpoint(
    payload: UserCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        user, roles = create_user(
            db=db,
            tenant_id=current_user.tenant_id,
            email=str(payload.email),
            password=payload.password,
            first_name=payload.first_name,
            last_name=payload.last_name,
            role_name=payload.role,
        )
    except ValueError as exc:
        msg = str(exc)
        if msg.startswith("Unknown role:"):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg) from exc
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg) from exc

    return UserItemResponse(
        id=user.id,
        tenant_id=user.tenant_id,
        email=user.email,
        is_active=user.is_active,
        first_name=user.first_name,
        last_name=user.last_name,
        roles=roles,
    )
