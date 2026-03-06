from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.domains.auth.models import User
from app.domains.vendors.schemas import (
    VendorContactCreate,
    VendorContactResponse,
    VendorContactUpdate,
    VendorCreate,
    VendorListResponse,
    VendorResponse,
    VendorUpdate,
)
from app.domains.vendors.service import (
    create_vendor,
    create_vendor_contact,
    delete_vendor_contact,
    get_vendor,
    list_vendor_contacts,
    list_vendors,
    restore_vendor,
    soft_delete_vendor,
    update_vendor,
    update_vendor_contact,
)
from app.platform.db import get_db
from app.platform.dependencies import get_current_roles, get_current_user

router = APIRouter(prefix="/vendors", tags=["Vendors"])


def _to_response(vendor) -> VendorResponse:
    return VendorResponse(
        id=vendor.id,
        tenant_id=vendor.tenant_id,
        name=vendor.name,
        status=vendor.status,
        owner_user_id=vendor.owner_user_id,
        address=vendor.address,
        sector=vendor.sector,
        deleted_at=vendor.deleted_at.isoformat() if vendor.deleted_at else None,
    )


@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
def create_vendor_endpoint(
    payload: VendorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorResponse:
    try:
        vendor = create_vendor(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            name=payload.name,
            status=payload.status,
            client_ids=payload.client_ids,
            client_names=payload.client_names,
            address=payload.address,
            sector=payload.sector,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_response(vendor)


@router.get("", response_model=VendorListResponse)
def list_vendors_endpoint(
    include_deleted: bool = Query(default=False),
    search: str | None = Query(default=None, min_length=1, max_length=255),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorListResponse:
    items, total = list_vendors(
        db=db,
        tenant_id=current_user.tenant_id,
        include_deleted=include_deleted,
        search=search,
        page=page,
        page_size=page_size,
    )
    return VendorListResponse(items=[_to_response(v) for v in items], total=total)


@router.get("/{vendor_id}", response_model=VendorResponse)
def get_vendor_endpoint(
    vendor_id: int,
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorResponse:
    vendor = get_vendor(
        db=db,
        tenant_id=current_user.tenant_id,
        vendor_id=vendor_id,
        include_deleted=include_deleted,
    )
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    return _to_response(vendor)


@router.patch("/{vendor_id}", response_model=VendorResponse)
def update_vendor_endpoint(
    vendor_id: int,
    payload: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> VendorResponse:
    vendor = get_vendor(db=db, tenant_id=current_user.tenant_id, vendor_id=vendor_id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    try:
        updated = update_vendor(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            roles=roles,
            vendor=vendor,
            name=payload.name,
            status=payload.status,
            address=payload.address,
            sector=payload.sector,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return _to_response(updated)


@router.delete("/{vendor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor_endpoint(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> None:
    vendor = get_vendor(db=db, tenant_id=current_user.tenant_id, vendor_id=vendor_id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    try:
        soft_delete_vendor(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            roles=roles,
            vendor=vendor,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return None


@router.post("/{vendor_id}/restore", response_model=VendorResponse)
def restore_vendor_endpoint(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> VendorResponse:
    vendor = get_vendor(
        db=db,
        tenant_id=current_user.tenant_id,
        vendor_id=vendor_id,
        include_deleted=True,
    )
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    try:
        restored = restore_vendor(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            roles=roles,
            vendor=vendor,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return _to_response(restored)


# ── Vendor Contacts ──


def _contact_to_response(contact) -> VendorContactResponse:
    return VendorContactResponse(
        id=contact.id,
        vendor_id=contact.vendor_id,
        first_name=contact.first_name,
        last_name=contact.last_name,
        email=contact.email,
        phone=contact.phone,
    )


@router.post(
    "/{vendor_id}/contacts",
    response_model=VendorContactResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_vendor_contact_endpoint(
    vendor_id: int,
    payload: VendorContactCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> VendorContactResponse:
    try:
        contact = create_vendor_contact(
            db=db,
            tenant_id=current_user.tenant_id,
            vendor_id=vendor_id,
            actor_user_id=current_user.id,
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            phone=payload.phone,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return _contact_to_response(contact)


@router.get("/{vendor_id}/contacts", response_model=list[VendorContactResponse])
def list_vendor_contacts_endpoint(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[VendorContactResponse]:
    vendor = get_vendor(db=db, tenant_id=current_user.tenant_id, vendor_id=vendor_id)
    if not vendor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    contacts = list_vendor_contacts(
        db=db, tenant_id=current_user.tenant_id, vendor_id=vendor_id
    )
    return [_contact_to_response(c) for c in contacts]


@router.patch("/{vendor_id}/contacts/{contact_id}", response_model=VendorContactResponse)
def update_vendor_contact_endpoint(
    vendor_id: int,
    contact_id: int,
    payload: VendorContactUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> VendorContactResponse:
    try:
        contact = update_vendor_contact(
            db=db,
            tenant_id=current_user.tenant_id,
            vendor_id=vendor_id,
            contact_id=contact_id,
            actor_user_id=current_user.id,
            roles=roles,
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=payload.email,
            phone=payload.phone,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return _contact_to_response(contact)


@router.delete("/{vendor_id}/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_vendor_contact_endpoint(
    vendor_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> None:
    try:
        delete_vendor_contact(
            db=db,
            tenant_id=current_user.tenant_id,
            vendor_id=vendor_id,
            contact_id=contact_id,
            actor_user_id=current_user.id,
            roles=roles,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return None
