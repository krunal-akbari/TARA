from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.domains.auth.models import User
from app.domains.client_vendor_links.schemas import (
    ClientVendorLinkCreate,
    ClientVendorLinkListResponse,
    ClientVendorLinkResponse,
    ClientVendorLinkUpdate,
)
from app.domains.client_vendor_links.service import (
    create_link,
    get_link,
    list_links,
    restore_link,
    soft_delete_link,
    update_link,
)
from app.platform.db import get_db
from app.platform.dependencies import get_current_user, require_role_dependency

router = APIRouter(prefix="/client-vendor-links", tags=["ClientVendorLinks"])


def _to_response(link) -> ClientVendorLinkResponse:
    return ClientVendorLinkResponse(
        id=link.id,
        tenant_id=link.tenant_id,
        client_id=link.client_id,
        vendor_id=link.vendor_id,
        status=link.status,
        priority=link.priority,
        effective_from=link.effective_from,
        effective_to=link.effective_to,
        deleted_at=link.deleted_at.isoformat() if link.deleted_at else None,
    )


@router.post(
    "",
    response_model=ClientVendorLinkResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_role_dependency("admin", "manager"))],
)
def create_link_endpoint(
    payload: ClientVendorLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientVendorLinkResponse:
    try:
        link = create_link(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            client_id=payload.client_id,
            vendor_id=payload.vendor_id,
            status=payload.status,
            priority=payload.priority,
            effective_from=payload.effective_from,
            effective_to=payload.effective_to,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_response(link)


@router.get("", response_model=ClientVendorLinkListResponse)
def list_links_endpoint(
    include_deleted: bool = Query(default=False),
    client_id: int | None = Query(default=None),
    vendor_id: int | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientVendorLinkListResponse:
    items, total = list_links(
        db=db,
        tenant_id=current_user.tenant_id,
        include_deleted=include_deleted,
        client_id=client_id,
        vendor_id=vendor_id,
        page=page,
        page_size=page_size,
    )
    return ClientVendorLinkListResponse(items=[_to_response(item) for item in items], total=total)


@router.patch(
    "/{link_id}",
    response_model=ClientVendorLinkResponse,
    dependencies=[Depends(require_role_dependency("admin", "manager"))],
)
def update_link_endpoint(
    link_id: int,
    payload: ClientVendorLinkUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientVendorLinkResponse:
    link = get_link(db=db, tenant_id=current_user.tenant_id, link_id=link_id)
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    updated = update_link(
        db=db,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        link=link,
        status=payload.status,
        priority=payload.priority,
        effective_from=payload.effective_from,
        effective_to=payload.effective_to,
    )
    return _to_response(updated)


@router.delete(
    "/{link_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_role_dependency("admin", "manager"))],
)
def delete_link_endpoint(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    link = get_link(db=db, tenant_id=current_user.tenant_id, link_id=link_id)
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    soft_delete_link(db=db, tenant_id=current_user.tenant_id, actor_user_id=current_user.id, link=link)
    return None


@router.post(
    "/{link_id}/restore",
    response_model=ClientVendorLinkResponse,
    dependencies=[Depends(require_role_dependency("admin", "manager"))],
)
def restore_link_endpoint(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientVendorLinkResponse:
    link = get_link(db=db, tenant_id=current_user.tenant_id, link_id=link_id, include_deleted=True)
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Link not found")
    restored = restore_link(db=db, tenant_id=current_user.tenant_id, actor_user_id=current_user.id, link=link)
    return _to_response(restored)
