from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.audit.service import record_event
from app.domains.client_vendor_links.models import ClientVendorLink
from app.domains.clients.models import Client
from app.domains.vendors.models import Vendor
from app.platform.time import utcnow


def _assert_entities_exist(db: Session, *, tenant_id: int, client_id: int, vendor_id: int) -> None:
    client = db.scalar(
        select(Client).where(Client.tenant_id == tenant_id, Client.id == client_id, Client.deleted_at.is_(None))
    )
    if not client:
        raise ValueError("Client not found")
    vendor = db.scalar(
        select(Vendor).where(Vendor.tenant_id == tenant_id, Vendor.id == vendor_id, Vendor.deleted_at.is_(None))
    )
    if not vendor:
        raise ValueError("Vendor not found")


def create_link(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    client_id: int,
    vendor_id: int,
    status: str,
    priority: int,
    effective_from,
    effective_to,
) -> ClientVendorLink:
    _assert_entities_exist(db, tenant_id=tenant_id, client_id=client_id, vendor_id=vendor_id)
    existing = db.scalar(
        select(ClientVendorLink).where(
            ClientVendorLink.tenant_id == tenant_id,
            ClientVendorLink.client_id == client_id,
            ClientVendorLink.vendor_id == vendor_id,
        )
    )
    if existing:
        if existing.deleted_at is not None:
            existing.deleted_at = None
            existing.deleted_by = None
            existing.status = status
            existing.priority = priority
            existing.effective_from = effective_from
            existing.effective_to = effective_to
            existing.updated_by = actor_user_id
            db.commit()
            db.refresh(existing)
            return existing
        raise ValueError("Link already exists")

    link = ClientVendorLink(
        tenant_id=tenant_id,
        client_id=client_id,
        vendor_id=vendor_id,
        status=status,
        priority=priority,
        effective_from=effective_from,
        effective_to=effective_to,
        created_by=actor_user_id,
        updated_by=actor_user_id,
    )
    db.add(link)
    db.flush()
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="client_vendor_link",
        entity_id=link.id,
        event_type="created",
        actor_user_id=actor_user_id,
        payload={"client_id": client_id, "vendor_id": vendor_id, "status": status},
    )
    db.commit()
    db.refresh(link)
    return link


def list_links(
    db: Session,
    *,
    tenant_id: int,
    include_deleted: bool,
    client_id: int | None,
    vendor_id: int | None,
    page: int,
    page_size: int,
) -> tuple[list[ClientVendorLink], int]:
    stmt = select(ClientVendorLink).where(ClientVendorLink.tenant_id == tenant_id)
    count_stmt = select(func.count()).select_from(ClientVendorLink).where(ClientVendorLink.tenant_id == tenant_id)

    if not include_deleted:
        stmt = stmt.where(ClientVendorLink.deleted_at.is_(None))
        count_stmt = count_stmt.where(ClientVendorLink.deleted_at.is_(None))
    if client_id:
        stmt = stmt.where(ClientVendorLink.client_id == client_id)
        count_stmt = count_stmt.where(ClientVendorLink.client_id == client_id)
    if vendor_id:
        stmt = stmt.where(ClientVendorLink.vendor_id == vendor_id)
        count_stmt = count_stmt.where(ClientVendorLink.vendor_id == vendor_id)

    stmt = stmt.order_by(ClientVendorLink.priority.asc(), ClientVendorLink.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    return list(db.scalars(stmt).all()), int(db.scalar(count_stmt) or 0)


def get_link(db: Session, *, tenant_id: int, link_id: int, include_deleted: bool = False) -> ClientVendorLink | None:
    stmt = select(ClientVendorLink).where(ClientVendorLink.tenant_id == tenant_id, ClientVendorLink.id == link_id)
    if not include_deleted:
        stmt = stmt.where(ClientVendorLink.deleted_at.is_(None))
    return db.scalar(stmt)


def update_link(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    link: ClientVendorLink,
    status: str | None,
    priority: int | None,
    effective_from,
    effective_to,
) -> ClientVendorLink:
    if status is not None:
        link.status = status
    if priority is not None:
        link.priority = priority
    if effective_from is not None:
        link.effective_from = effective_from
    if effective_to is not None:
        link.effective_to = effective_to
    link.updated_by = actor_user_id

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="client_vendor_link",
        entity_id=link.id,
        event_type="updated",
        actor_user_id=actor_user_id,
        payload={"status": link.status, "priority": link.priority},
    )
    db.commit()
    db.refresh(link)
    return link


def soft_delete_link(db: Session, *, tenant_id: int, actor_user_id: int, link: ClientVendorLink) -> None:
    link.deleted_at = utcnow()
    link.deleted_by = actor_user_id
    link.updated_by = actor_user_id
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="client_vendor_link",
        entity_id=link.id,
        event_type="deleted",
        actor_user_id=actor_user_id,
        payload={},
    )
    db.commit()


def restore_link(db: Session, *, tenant_id: int, actor_user_id: int, link: ClientVendorLink) -> ClientVendorLink:
    link.deleted_at = None
    link.deleted_by = None
    link.updated_by = actor_user_id
    link.status = "active"
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="client_vendor_link",
        entity_id=link.id,
        event_type="restored",
        actor_user_id=actor_user_id,
        payload={},
    )
    db.commit()
    db.refresh(link)
    return link
