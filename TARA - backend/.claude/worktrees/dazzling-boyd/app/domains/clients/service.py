from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.access.service import can_manage_or_own
from app.domains.audit.service import record_event
from app.domains.client_vendor_links.models import ClientVendorLink
from app.domains.clients.models import Client
from app.domains.vendors.models import Vendor
from app.platform.time import utcnow


def create_client(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    name: str,
    status: str,
    vendor_id: int | None = None,
) -> Client:
    # If a vendor_id is provided, validate it exists and is active
    if vendor_id is not None:
        vendor = db.scalar(
            select(Vendor).where(
                Vendor.tenant_id == tenant_id,
                Vendor.id == vendor_id,
                Vendor.deleted_at.is_(None),
            )
        )
        if not vendor:
            raise ValueError("Vendor not found")

    client = Client(
        tenant_id=tenant_id,
        name=name,
        status=status,
        owner_user_id=actor_user_id,
    )
    db.add(client)
    db.flush()
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="client",
        entity_id=client.id,
        event_type="created",
        actor_user_id=actor_user_id,
        payload={"name": name, "status": status},
    )

    # Auto-create client-vendor link if vendor_id is provided
    if vendor_id is not None:
        link = ClientVendorLink(
            tenant_id=tenant_id,
            client_id=client.id,
            vendor_id=vendor_id,
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
            payload={"client_id": client.id, "vendor_id": vendor_id, "status": "active"},
        )

    db.commit()
    db.refresh(client)
    return client


def list_clients(db: Session, *, tenant_id: int, include_deleted: bool, page: int, page_size: int) -> tuple[list[Client], int]:
    stmt = select(Client).where(Client.tenant_id == tenant_id)
    count_stmt = select(func.count()).select_from(Client).where(Client.tenant_id == tenant_id)
    if not include_deleted:
        stmt = stmt.where(Client.deleted_at.is_(None))
        count_stmt = count_stmt.where(Client.deleted_at.is_(None))
    stmt = stmt.order_by(Client.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list(db.scalars(stmt).all())
    total = int(db.scalar(count_stmt) or 0)
    return items, total


def get_client(db: Session, *, tenant_id: int, client_id: int, include_deleted: bool = False) -> Client | None:
    stmt = select(Client).where(Client.tenant_id == tenant_id, Client.id == client_id)
    if not include_deleted:
        stmt = stmt.where(Client.deleted_at.is_(None))
    return db.scalar(stmt)


def update_client(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    roles: list[str],
    client: Client,
    name: str | None,
    status: str | None,
) -> Client:
    if not can_manage_or_own(roles=roles, owner_user_id=client.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to update client")

    if name is not None:
        client.name = name
    if status is not None:
        client.status = status

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="client",
        entity_id=client.id,
        event_type="updated",
        actor_user_id=actor_user_id,
        payload={"name": client.name, "status": client.status},
    )
    db.commit()
    db.refresh(client)
    return client


def soft_delete_client(db: Session, *, tenant_id: int, actor_user_id: int, roles: list[str], client: Client) -> None:
    if not can_manage_or_own(roles=roles, owner_user_id=client.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to delete client")
    client.deleted_at = utcnow()
    client.deleted_by = actor_user_id
    client.status = "inactive"
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="client",
        entity_id=client.id,
        event_type="deleted",
        actor_user_id=actor_user_id,
        payload={},
    )
    db.commit()


def restore_client(db: Session, *, tenant_id: int, actor_user_id: int, roles: list[str], client: Client) -> Client:
    if not can_manage_or_own(roles=roles, owner_user_id=client.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to restore client")
    client.deleted_at = None
    client.deleted_by = None
    client.status = "active"
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="client",
        entity_id=client.id,
        event_type="restored",
        actor_user_id=actor_user_id,
        payload={},
    )
    db.commit()
    db.refresh(client)
    return client
