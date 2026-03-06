from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.access.service import can_manage_or_own
from app.domains.audit.service import record_event
from app.domains.client_vendor_links.models import ClientVendorLink
from app.domains.clients.models import Client
from app.domains.vendors.models import Vendor
from app.platform.time import utcnow


def create_vendor(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    name: str,
    status: str,
    client_id: int,
) -> Vendor:
    # Validate that the client exists and is active
    client = db.scalar(
        select(Client).where(
            Client.tenant_id == tenant_id,
            Client.id == client_id,
            Client.deleted_at.is_(None),
        )
    )
    if not client:
        raise ValueError("Client not found")

    vendor = Vendor(
        tenant_id=tenant_id,
        name=name,
        status=status,
        owner_user_id=actor_user_id,
    )
    db.add(vendor)
    db.flush()
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="vendor",
        entity_id=vendor.id,
        event_type="created",
        actor_user_id=actor_user_id,
        payload={"name": name, "status": status},
    )

    # Auto-create the initial client-vendor link
    link = ClientVendorLink(
        tenant_id=tenant_id,
        client_id=client_id,
        vendor_id=vendor.id,
        status="active",
        priority=100,
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
        payload={"client_id": client_id, "vendor_id": vendor.id, "status": "active"},
    )

    db.commit()
    db.refresh(vendor)
    return vendor


def list_vendors(db: Session, *, tenant_id: int, include_deleted: bool, page: int, page_size: int) -> tuple[list[Vendor], int]:
    stmt = select(Vendor).where(Vendor.tenant_id == tenant_id)
    count_stmt = select(func.count()).select_from(Vendor).where(Vendor.tenant_id == tenant_id)
    if not include_deleted:
        stmt = stmt.where(Vendor.deleted_at.is_(None))
        count_stmt = count_stmt.where(Vendor.deleted_at.is_(None))
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
) -> Vendor:
    if not can_manage_or_own(roles=roles, owner_user_id=vendor.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to update vendor")

    if name is not None:
        vendor.name = name
    if status is not None:
        vendor.status = status

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="vendor",
        entity_id=vendor.id,
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
        entity_id=vendor.id,
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
        entity_id=vendor.id,
        event_type="restored",
        actor_user_id=actor_user_id,
        payload={},
    )
    db.commit()
    db.refresh(vendor)
    return vendor
