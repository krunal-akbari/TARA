from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.access.service import can_manage_or_own
from app.domains.audit.service import record_event
from app.domains.client_vendor_links.models import ClientVendorLink
from app.domains.clients.models import Client
from app.domains.vendors.models import Vendor, VendorContact
from app.platform.time import utcnow


def _resolve_client_ids(
    db: Session,
    *,
    tenant_id: int,
    client_ids: list[int] | None,
    client_names: list[str] | None,
) -> list[int]:
    """Resolve a mix of client IDs and client names into a deduplicated list of IDs."""
    resolved: list[int] = []

    for cid in (client_ids or []):
        client = db.scalar(
            select(Client).where(
                Client.tenant_id == tenant_id,
                Client.id == cid,
                Client.deleted_at.is_(None),
            )
        )
        if not client:
            raise ValueError(f"Client with id {cid} not found")
        resolved.append(client.id)

    for cname in (client_names or []):
        client = db.scalar(
            select(Client).where(
                Client.tenant_id == tenant_id,
                Client.name == cname,
                Client.deleted_at.is_(None),
            )
        )
        if not client:
            raise ValueError(f"Client with name '{cname}' not found")
        resolved.append(client.id)

    # Deduplicate while preserving order
    seen: set[int] = set()
    unique: list[int] = []
    for cid in resolved:
        if cid not in seen:
            seen.add(cid)
            unique.append(cid)
    return unique


def create_vendor(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    name: str,
    status: str,
    client_ids: list[int] | None = None,
    client_names: list[str] | None = None,
    address: str | None = None,
    sector: str | None = None,
) -> Vendor:
    resolved_client_ids = _resolve_client_ids(
        db, tenant_id=tenant_id, client_ids=client_ids, client_names=client_names,
    )

    vendor = Vendor(
        tenant_id=tenant_id,
        name=name,
        status=status,
        owner_user_id=actor_user_id,
        address=address,
        sector=sector,
    )
    db.add(vendor)
    db.flush()
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="vendor",
        entity_id=str(vendor.id),
        event_type="created",
        actor_user_id=actor_user_id,
        payload={"name": name, "status": status},
    )

    # Auto-create client-vendor links for each client
    for client_id in resolved_client_ids:
        link = ClientVendorLink(
            tenant_id=tenant_id,
            client_id=client_id,
            vendor_id=vendor.id,
            status="active",
            priority="hot",
            created_by=actor_user_id,
            updated_by=actor_user_id,
        )
        db.add(link)
        db.flush()
        record_event(
            db,
            tenant_id=tenant_id,
            entity_type="client_vendor_link",
            entity_id=str(link.id),
            event_type="created",
            actor_user_id=actor_user_id,
            payload={"client_id": client_id, "vendor_id": vendor.id, "status": "active"},
        )

    db.commit()
    db.refresh(vendor)
    return vendor


def list_vendors(db: Session, *, tenant_id: int, include_deleted: bool, page: int, page_size: int, search: str | None = None) -> tuple[list[Vendor], int]:
    stmt = select(Vendor).where(Vendor.tenant_id == tenant_id)
    count_stmt = select(func.count()).select_from(Vendor).where(Vendor.tenant_id == tenant_id)
    if not include_deleted:
        stmt = stmt.where(Vendor.deleted_at.is_(None))
        count_stmt = count_stmt.where(Vendor.deleted_at.is_(None))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(Vendor.name.ilike(pattern))
        count_stmt = count_stmt.where(Vendor.name.ilike(pattern))
    stmt = stmt.order_by(Vendor.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list(db.scalars(stmt).all())
    total = int(db.scalar(count_stmt) or 0)
    return items, total


def get_vendor(db: Session, *, tenant_id: int, vendor_id: int, include_deleted: bool = False) -> Vendor | None:
    stmt = select(Vendor).where(Vendor.tenant_id == tenant_id, Vendor.id == vendor_id)
    if not include_deleted:
        stmt = stmt.where(Vendor.deleted_at.is_(None))
    return db.scalar(stmt)


def update_vendor(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    roles: list[str],
    vendor: Vendor,
    name: str | None,
    status: str | None,
    address: str | None = None,
    sector: str | None = None,
) -> Vendor:
    if not can_manage_or_own(roles=roles, owner_user_id=vendor.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to update vendor")

    if name is not None:
        vendor.name = name
    if status is not None:
        vendor.status = status
    if address is not None:
        vendor.address = address
    if sector is not None:
        vendor.sector = sector

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="vendor",
        entity_id=str(vendor.id),
        event_type="updated",
        actor_user_id=actor_user_id,
        payload={"name": vendor.name, "status": vendor.status},
    )
    db.commit()
    db.refresh(vendor)
    return vendor


def soft_delete_vendor(db: Session, *, tenant_id: int, actor_user_id: int, roles: list[str], vendor: Vendor) -> None:
    if not can_manage_or_own(roles=roles, owner_user_id=vendor.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to delete vendor")
    vendor.deleted_at = utcnow()
    vendor.deleted_by = actor_user_id
    vendor.status = "inactive"
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="vendor",
        entity_id=str(vendor.id),
        event_type="deleted",
        actor_user_id=actor_user_id,
        payload={},
    )
    db.commit()


def restore_vendor(db: Session, *, tenant_id: int, actor_user_id: int, roles: list[str], vendor: Vendor) -> Vendor:
    if not can_manage_or_own(roles=roles, owner_user_id=vendor.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to restore vendor")
    vendor.deleted_at = None
    vendor.deleted_by = None
    vendor.status = "active"
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="vendor",
        entity_id=str(vendor.id),
        event_type="restored",
        actor_user_id=actor_user_id,
        payload={},
    )
    db.commit()
    db.refresh(vendor)
    return vendor


# ── Vendor Contacts ──


def create_vendor_contact(
    db: Session,
    *,
    tenant_id: int,
    vendor_id: int,
    actor_user_id: int,
    first_name: str,
    last_name: str,
    email: str | None = None,
    phone: str | None = None,
) -> VendorContact:
    vendor = get_vendor(db=db, tenant_id=tenant_id, vendor_id=vendor_id)
    if not vendor:
        raise ValueError("Vendor not found")
    contact = VendorContact(
        tenant_id=tenant_id,
        vendor_id=vendor_id,
        first_name=first_name,
        last_name=last_name,
        email=email,
        phone=phone,
    )
    db.add(contact)
    db.flush()
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="vendor_contact",
        entity_id=str(contact.id),
        event_type="created",
        actor_user_id=actor_user_id,
        payload={"vendor_id": vendor_id, "first_name": first_name, "last_name": last_name},
    )
    db.commit()
    db.refresh(contact)
    return contact


def list_vendor_contacts(
    db: Session, *, tenant_id: int, vendor_id: int
) -> list[VendorContact]:
    stmt = (
        select(VendorContact)
        .where(VendorContact.tenant_id == tenant_id, VendorContact.vendor_id == vendor_id)
        .order_by(VendorContact.id)
    )
    return list(db.scalars(stmt).all())


def update_vendor_contact(
    db: Session,
    *,
    tenant_id: int,
    vendor_id: int,
    contact_id: int,
    actor_user_id: int,
    roles: list[str],
    first_name: str | None = None,
    last_name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
) -> VendorContact:
    contact = db.scalar(
        select(VendorContact).where(
            VendorContact.tenant_id == tenant_id,
            VendorContact.vendor_id == vendor_id,
            VendorContact.id == contact_id,
        )
    )
    if not contact:
        raise ValueError("Contact not found")

    # Check permission via the parent vendor
    vendor = get_vendor(db=db, tenant_id=tenant_id, vendor_id=contact.vendor_id, include_deleted=True)
    if not vendor:
        raise ValueError("Vendor not found")
    if not can_manage_or_own(roles=roles, owner_user_id=vendor.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to update contact")

    if first_name is not None:
        contact.first_name = first_name
    if last_name is not None:
        contact.last_name = last_name
    if email is not None:
        contact.email = email
    if phone is not None:
        contact.phone = phone

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="vendor_contact",
        entity_id=str(contact.id),
        event_type="updated",
        actor_user_id=actor_user_id,
        payload={"first_name": contact.first_name, "last_name": contact.last_name},
    )
    db.commit()
    db.refresh(contact)
    return contact


def delete_vendor_contact(
    db: Session,
    *,
    tenant_id: int,
    vendor_id: int,
    contact_id: int,
    actor_user_id: int,
    roles: list[str],
) -> None:
    contact = db.scalar(
        select(VendorContact).where(
            VendorContact.tenant_id == tenant_id,
            VendorContact.vendor_id == vendor_id,
            VendorContact.id == contact_id,
        )
    )
    if not contact:
        raise ValueError("Contact not found")

    vendor = get_vendor(db=db, tenant_id=tenant_id, vendor_id=contact.vendor_id, include_deleted=True)
    if not vendor:
        raise ValueError("Vendor not found")
    if not can_manage_or_own(roles=roles, owner_user_id=vendor.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to delete contact")

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="vendor_contact",
        entity_id=str(contact.id),
        event_type="deleted",
        actor_user_id=actor_user_id,
        payload={"vendor_id": contact.vendor_id, "first_name": contact.first_name, "last_name": contact.last_name},
    )
    db.delete(contact)
    db.commit()
