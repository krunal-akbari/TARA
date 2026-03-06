from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.domains.auth.models import User
from app.domains.clients.schemas import (
    ClientCreate,
    ClientListResponse,
    ClientResponse,
    ClientUpdate,
)
from app.domains.clients.service import (
    create_client,
    get_client,
    list_clients,
    restore_client,
    soft_delete_client,
    update_client,
)
from app.platform.db import get_db
from app.platform.dependencies import get_current_roles, get_current_user

router = APIRouter(prefix="/clients", tags=["Clients"])


def _to_response(client) -> ClientResponse:
    return ClientResponse(
        id=client.id,
        tenant_id=client.tenant_id,
        name=client.name,
        status=client.status,
        owner_user_id=client.owner_user_id,
        deleted_at=client.deleted_at.isoformat() if client.deleted_at else None,
    )


@router.post("", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_client_endpoint(
    payload: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientResponse:
    try:
        client = create_client(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            name=payload.name,
            status=payload.status,
            vendor_id=payload.vendor_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_response(client)


@router.get("", response_model=ClientListResponse)
def list_clients_endpoint(
    include_deleted: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientListResponse:
    items, total = list_clients(
        db=db,
        tenant_id=current_user.tenant_id,
        include_deleted=include_deleted,
        page=page,
        page_size=page_size,
    )
    return ClientListResponse(items=[_to_response(c) for c in items], total=total)


@router.get("/{client_id}", response_model=ClientResponse)
def get_client_endpoint(
    client_id: int,
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ClientResponse:
    client = get_client(
        db=db,
        tenant_id=current_user.tenant_id,
        client_id=client_id,
        include_deleted=include_deleted,
    )
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    return _to_response(client)


@router.patch("/{client_id}", response_model=ClientResponse)
def update_client_endpoint(
    client_id: int,
    payload: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> ClientResponse:
    client = get_client(db=db, tenant_id=current_user.tenant_id, client_id=client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    try:
        updated = update_client(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            roles=roles,
            client=client,
            name=payload.name,
            status=payload.status,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return _to_response(updated)


@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_client_endpoint(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> None:
    client = get_client(db=db, tenant_id=current_user.tenant_id, client_id=client_id)
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    try:
        soft_delete_client(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            roles=roles,
            client=client,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return None


@router.post("/{client_id}/restore", response_model=ClientResponse)
def restore_client_endpoint(
    client_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> ClientResponse:
    client = get_client(
        db=db,
        tenant_id=current_user.tenant_id,
        client_id=client_id,
        include_deleted=True,
    )
    if not client:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
    try:
        restored = restore_client(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            roles=roles,
            client=client,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return _to_response(restored)
