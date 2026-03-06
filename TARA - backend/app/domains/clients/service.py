from sqlalchemy import MetaData, Table, func, insert, select
from sqlalchemy.orm import Session

from app.domains.access.service import can_manage_or_own
from app.domains.audit.service import record_event
from app.domains.client_vendor_links.models import ClientVendorLink
from app.domains.clients.models import Client, ClientContact
from app.domains.vendors.models import Vendor
from app.platform.time import utcnow


def _resolve_vendor_id(
    db: Session,
    *,
    tenant_id: int,
    vendor_id: int | None,
    vendor_name: str | None,
) -> int | None:
    """Resolve vendor_id or vendor_name into a validated vendor ID."""
    if vendor_id is not None:
        vendor = db.scalar(
            select(Vendor).where(
                Vendor.tenant_id == tenant_id,
                Vendor.id == vendor_id,
                Vendor.deleted_at.is_(None),
            )
        )
        if not vendor:
            raise ValueError(f"Vendor with id {vendor_id} not found")
        return vendor.id

    if vendor_name is not None:
        vendor = db.scalar(
            select(Vendor).where(
                Vendor.tenant_id == tenant_id,
                Vendor.name == vendor_name,
                Vendor.deleted_at.is_(None),
            )
        )
        if not vendor:
            raise ValueError(f"Vendor with name '{vendor_name}' not found")
        return vendor.id

    return None


def create_client(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    name: str,
    status: str,
    vendor_id: int | None = None,
    vendor_name: str | None = None,
    address: str | None = None,
    sector: str | None = None,
) -> Client:
    # Resolve vendor by ID or name
    resolved_vendor_id = _resolve_vendor_id(
        db, tenant_id=tenant_id, vendor_id=vendor_id, vendor_name=vendor_name,
    )

    client = Client(
        tenant_id=tenant_id,
        name=name,
        status=status,
        owner_user_id=actor_user_id,
        address=address,
        sector=sector,
    )
    db.add(client)
    db.flush()
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="client",
        entity_id=str(client.id),
        event_type="created",
        actor_user_id=actor_user_id,
        payload={"name": name, "status": status},
    )

    # Auto-create client-vendor link if a vendor was specified
    if resolved_vendor_id is not None:
        link = ClientVendorLink(
            tenant_id=tenant_id,
            client_id=client.id,
            vendor_id=resolved_vendor_id,
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
            payload={"client_id": client.id, "vendor_id": resolved_vendor_id, "status": "active"},
        )

    db.commit()
    db.refresh(client)
    return client


def list_clients(db: Session, *, tenant_id: int, include_deleted: bool, page: int, page_size: int, search: str | None = None) -> tuple[list[Client], int]:
    stmt = select(Client).where(Client.tenant_id == tenant_id)
    count_stmt = select(func.count()).select_from(Client).where(Client.tenant_id == tenant_id)
    if not include_deleted:
        stmt = stmt.where(Client.deleted_at.is_(None))
        count_stmt = count_stmt.where(Client.deleted_at.is_(None))
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(Client.name.ilike(pattern))
        count_stmt = count_stmt.where(Client.name.ilike(pattern))
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
    address: str | None = None,
    sector: str | None = None,
) -> Client:
    if not can_manage_or_own(roles=roles, owner_user_id=client.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to update client")

    if name is not None:
        client.name = name
    if status is not None:
        client.status = status
    if address is not None:
        client.address = address
    if sector is not None:
        client.sector = sector

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="client",
        entity_id=str(client.id),
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
        entity_id=str(client.id),
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
        entity_id=str(client.id),
        event_type="restored",
        actor_user_id=actor_user_id,
        payload={},
    )
    db.commit()
    db.refresh(client)
    return client


# ── Client Contacts ──


def create_client_contact(
    db: Session,
    *,
    tenant_id: int,
    client_id: int,
    actor_user_id: int,
    first_name: str,
    last_name: str,
    email: str | None = None,
    phone: str | None = None,
) -> ClientContact:
    client = get_client(db=db, tenant_id=tenant_id, client_id=client_id)
    if not client:
        raise ValueError("Client not found")

    # Backward-compatible insert for legacy SQLite schemas that still have
    # a NOT NULL `name` column on client_contacts.
    contacts_table = Table("client_contacts", MetaData(), autoload_with=db.bind)
    insert_values: dict[str, object | None] = {
        "tenant_id": tenant_id,
        "client_id": client_id,
        "first_name": first_name,
        "last_name": last_name,
        "email": email,
        "phone": phone,
    }
    now = utcnow()
    if "name" in contacts_table.c:
        insert_values["name"] = f"{first_name} {last_name}".strip()
    if "created_at" in contacts_table.c:
        insert_values["created_at"] = now
    if "updated_at" in contacts_table.c:
        insert_values["updated_at"] = now

    result = db.execute(insert(contacts_table).values(**insert_values))
    contact_id = result.inserted_primary_key[0] if result.inserted_primary_key else None
    if not contact_id:
        raise ValueError("Failed to create contact")
    contact = db.scalar(
        select(ClientContact).where(
            ClientContact.tenant_id == tenant_id,
            ClientContact.id == contact_id,
        )
    )
    if not contact:
        raise ValueError("Contact was created but could not be loaded")
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="client_contact",
        entity_id=str(contact.id),
        event_type="created",
        actor_user_id=actor_user_id,
        payload={"client_id": client_id, "first_name": first_name, "last_name": last_name},
    )
    db.commit()
    db.refresh(contact)
    return contact


def list_client_contacts(
    db: Session, *, tenant_id: int, client_id: int
) -> list[ClientContact]:
    stmt = (
        select(ClientContact)
        .where(ClientContact.tenant_id == tenant_id, ClientContact.client_id == client_id)
        .order_by(ClientContact.id)
    )
    return list(db.scalars(stmt).all())


def update_client_contact(
    db: Session,
    *,
    tenant_id: int,
    client_id: int,
    contact_id: int,
    actor_user_id: int,
    roles: list[str],
    first_name: str | None = None,
    last_name: str | None = None,
    email: str | None = None,
    phone: str | None = None,
) -> ClientContact:
    contact = db.scalar(
        select(ClientContact).where(
            ClientContact.tenant_id == tenant_id,
            ClientContact.client_id == client_id,
            ClientContact.id == contact_id,
        )
    )
    if not contact:
        raise ValueError("Contact not found")

    # Check permission via the parent client
    client = get_client(db=db, tenant_id=tenant_id, client_id=contact.client_id, include_deleted=True)
    if not client:
        raise ValueError("Client not found")
    if not can_manage_or_own(roles=roles, owner_user_id=client.owner_user_id, actor_user_id=actor_user_id):
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
        entity_type="client_contact",
        entity_id=str(contact.id),
        event_type="updated",
        actor_user_id=actor_user_id,
        payload={"first_name": contact.first_name, "last_name": contact.last_name},
    )
    db.commit()
    db.refresh(contact)
    return contact


def delete_client_contact(
    db: Session,
    *,
    tenant_id: int,
    client_id: int,
    contact_id: int,
    actor_user_id: int,
    roles: list[str],
) -> None:
    contact = db.scalar(
        select(ClientContact).where(
            ClientContact.tenant_id == tenant_id,
            ClientContact.client_id == client_id,
            ClientContact.id == contact_id,
        )
    )
    if not contact:
        raise ValueError("Contact not found")

    client = get_client(db=db, tenant_id=tenant_id, client_id=contact.client_id, include_deleted=True)
    if not client:
        raise ValueError("Client not found")
    if not can_manage_or_own(roles=roles, owner_user_id=client.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to delete contact")

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="client_contact",
        entity_id=str(contact.id),
        event_type="deleted",
        actor_user_id=actor_user_id,
        payload={"client_id": contact.client_id, "first_name": contact.first_name, "last_name": contact.last_name},
    )
    db.delete(contact)
    db.commit()
