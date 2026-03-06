from sqlalchemy import select

from app.domains.auth.models import Role, User, UserRole
from app.platform.db import SessionLocal
from app.platform.security import hash_password
from tests.conftest import auth_header, bootstrap_tenant, login


def _setup(client):
    """Bootstrap a tenant, login, and create a client. Return headers and client_id."""
    bootstrap_tenant(client, "ContactTest")
    token = login(client)
    h = auth_header(token)
    r = client.post(
        "/api/v1/clients",
        headers=h,
        json={"name": "Test Client"},
    )
    assert r.status_code == 201
    return h, r.json()["id"]


def _create_recruiter_user(*, tenant_id: int, email: str = "recruiter@example.com") -> None:
    db = SessionLocal()
    try:
        recruiter = User(
            tenant_id=tenant_id,
            email=email,
            password_hash=hash_password("Password123!"),
            is_active=True,
        )
        db.add(recruiter)
        db.flush()
        recruiter_role = db.scalar(select(Role).where(Role.name == "recruiter"))
        assert recruiter_role is not None
        db.add(UserRole(user_id=recruiter.id, role_id=recruiter_role.id, tenant_id=tenant_id))
        db.commit()
    finally:
        db.close()


def test_create_client_contact(client):
    h, client_id = _setup(client)
    r = client.post(
        f"/api/v1/clients/{client_id}/contacts",
        headers=h,
        json={"first_name": "Alice", "last_name": "Smith", "email": "alice@example.com", "phone": "+1234567890"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["first_name"] == "Alice"
    assert data["last_name"] == "Smith"
    assert data["email"] == "alice@example.com"
    assert data["phone"] == "+1234567890"
    assert data["client_id"] == client_id
    assert "id" in data


def test_list_client_contacts(client):
    h, client_id = _setup(client)
    client.post(
        f"/api/v1/clients/{client_id}/contacts",
        headers=h,
        json={"first_name": "Contact", "last_name": "One", "email": "one@example.com"},
    )
    client.post(
        f"/api/v1/clients/{client_id}/contacts",
        headers=h,
        json={"first_name": "Contact", "last_name": "Two", "phone": "555-0002"},
    )
    r = client.get(f"/api/v1/clients/{client_id}/contacts", headers=h)
    assert r.status_code == 200
    contacts = r.json()
    assert len(contacts) == 2
    last_names = [c["last_name"] for c in contacts]
    assert "One" in last_names
    assert "Two" in last_names


def test_update_client_contact(client):
    h, client_id = _setup(client)
    create = client.post(
        f"/api/v1/clients/{client_id}/contacts",
        headers=h,
        json={"first_name": "Old", "last_name": "Name", "phone": "111-111"},
    )
    contact_id = create.json()["id"]

    r = client.patch(
        f"/api/v1/clients/{client_id}/contacts/{contact_id}",
        headers=h,
        json={"first_name": "New", "last_name": "Updated", "phone": "222-222"},
    )
    assert r.status_code == 200
    assert r.json()["first_name"] == "New"
    assert r.json()["last_name"] == "Updated"
    assert r.json()["phone"] == "222-222"


def test_delete_client_contact(client):
    h, client_id = _setup(client)
    create = client.post(
        f"/api/v1/clients/{client_id}/contacts",
        headers=h,
        json={"first_name": "To", "last_name": "Delete"},
    )
    contact_id = create.json()["id"]

    r = client.delete(f"/api/v1/clients/{client_id}/contacts/{contact_id}", headers=h)
    assert r.status_code == 204

    # Verify gone from list
    contacts = client.get(f"/api/v1/clients/{client_id}/contacts", headers=h)
    assert contacts.status_code == 200
    assert len(contacts.json()) == 0


def test_contact_requires_valid_client(client):
    bootstrap_tenant(client, "ContactTest2")
    token = login(client)
    h = auth_header(token)

    r = client.post(
        "/api/v1/clients/99999/contacts",
        headers=h,
        json={"first_name": "Ghost", "last_name": "Contact"},
    )
    assert r.status_code == 404


def test_contact_requires_auth(client):
    r = client.post(
        "/api/v1/clients/1/contacts",
        json={"first_name": "No", "last_name": "Auth"},
    )
    assert r.status_code == 401

    r = client.get("/api/v1/clients/1/contacts")
    assert r.status_code == 401


def test_create_client_with_address_sector(client):
    bootstrap_tenant(client, "AddrSectorTest")
    token = login(client)
    h = auth_header(token)
    r = client.post(
        "/api/v1/clients",
        headers=h,
        json={"name": "Acme Corp", "address": "123 Main St", "sector": "Technology"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["address"] == "123 Main St"
    assert data["sector"] == "Technology"

    # Verify via GET
    r2 = client.get(f"/api/v1/clients/{data['id']}", headers=h)
    assert r2.status_code == 200
    assert r2.json()["address"] == "123 Main St"
    assert r2.json()["sector"] == "Technology"


def test_contact_update_and_delete_require_matching_client_path(client):
    bootstrap_tenant(client, "ContactPathCheck")
    token = login(client)
    h = auth_header(token)

    c1 = client.post("/api/v1/clients", headers=h, json={"name": "Parent A"}).json()
    c2 = client.post("/api/v1/clients", headers=h, json={"name": "Parent B"}).json()
    contact = client.post(
        f"/api/v1/clients/{c1['id']}/contacts",
        headers=h,
        json={"first_name": "Mismatch", "last_name": "Case"},
    ).json()

    wrong_update = client.patch(
        f"/api/v1/clients/{c2['id']}/contacts/{contact['id']}",
        headers=h,
        json={"first_name": "ShouldFail"},
    )
    assert wrong_update.status_code == 404

    wrong_delete = client.delete(
        f"/api/v1/clients/{c2['id']}/contacts/{contact['id']}",
        headers=h,
    )
    assert wrong_delete.status_code == 404


def test_contact_permissions_still_apply_when_parent_client_soft_deleted(client):
    tenant_id, _ = bootstrap_tenant(client, "ContactPermDeletedParent")
    admin_h = auth_header(login(client))
    _create_recruiter_user(tenant_id=tenant_id)
    recruiter_h = auth_header(login(client, "recruiter@example.com"))

    owner_client = client.post("/api/v1/clients", headers=admin_h, json={"name": "Owned Client"}).json()
    contact = client.post(
        f"/api/v1/clients/{owner_client['id']}/contacts",
        headers=admin_h,
        json={"first_name": "Protected", "last_name": "Contact"},
    ).json()

    active_update = client.patch(
        f"/api/v1/clients/{owner_client['id']}/contacts/{contact['id']}",
        headers=recruiter_h,
        json={"first_name": "NoAccess"},
    )
    assert active_update.status_code == 403

    delete_client = client.delete(f"/api/v1/clients/{owner_client['id']}", headers=admin_h)
    assert delete_client.status_code == 204

    after_delete_update = client.patch(
        f"/api/v1/clients/{owner_client['id']}/contacts/{contact['id']}",
        headers=recruiter_h,
        json={"first_name": "StillNoAccess"},
    )
    assert after_delete_update.status_code == 403
