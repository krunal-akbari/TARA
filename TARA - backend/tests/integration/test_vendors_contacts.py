from sqlalchemy import select

from app.domains.auth.models import Role, User, UserRole
from app.platform.db import SessionLocal
from app.platform.security import hash_password
from tests.conftest import auth_header, bootstrap_tenant, login


def _setup(client):
    """Bootstrap a tenant, login, create a client, then create a vendor. Return headers and vendor_id."""
    bootstrap_tenant(client, "VendorContactTest")
    token = login(client)
    h = auth_header(token)

    # Create a client first (required for vendor creation)
    r = client.post("/api/v1/clients", headers=h, json={"name": "Parent Client"})
    assert r.status_code == 201
    client_id = r.json()["id"]

    # Create a vendor linked to that client
    r = client.post(
        "/api/v1/vendors",
        headers=h,
        json={"name": "Test Vendor", "client_ids": [client_id]},
    )
    assert r.status_code == 201
    return h, r.json()["id"], client_id


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


def test_create_vendor_with_address_sector(client):
    bootstrap_tenant(client, "VendorAddrTest")
    token = login(client)
    h = auth_header(token)

    r = client.post("/api/v1/clients", headers=h, json={"name": "Client For Vendor"})
    assert r.status_code == 201
    client_id = r.json()["id"]

    r = client.post(
        "/api/v1/vendors",
        headers=h,
        json={
            "name": "Vendor Inc",
            "client_ids": [client_id],
            "address": "456 Elm St",
            "sector": "Healthcare",
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["address"] == "456 Elm St"
    assert data["sector"] == "Healthcare"

    # Verify via GET
    r2 = client.get(f"/api/v1/vendors/{data['id']}", headers=h)
    assert r2.status_code == 200
    assert r2.json()["address"] == "456 Elm St"
    assert r2.json()["sector"] == "Healthcare"


def test_create_vendor_contact(client):
    h, vendor_id, _ = _setup(client)
    r = client.post(
        f"/api/v1/vendors/{vendor_id}/contacts",
        headers=h,
        json={"first_name": "Bob", "last_name": "Jones", "email": "bob@example.com", "phone": "+9876543210"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["first_name"] == "Bob"
    assert data["last_name"] == "Jones"
    assert data["email"] == "bob@example.com"
    assert data["phone"] == "+9876543210"
    assert data["vendor_id"] == vendor_id
    assert "id" in data


def test_list_vendor_contacts(client):
    h, vendor_id, _ = _setup(client)
    client.post(
        f"/api/v1/vendors/{vendor_id}/contacts",
        headers=h,
        json={"first_name": "Contact", "last_name": "One", "email": "one@vendor.com"},
    )
    client.post(
        f"/api/v1/vendors/{vendor_id}/contacts",
        headers=h,
        json={"first_name": "Contact", "last_name": "Two", "phone": "555-0003"},
    )
    r = client.get(f"/api/v1/vendors/{vendor_id}/contacts", headers=h)
    assert r.status_code == 200
    contacts = r.json()
    assert len(contacts) == 2
    last_names = [c["last_name"] for c in contacts]
    assert "One" in last_names
    assert "Two" in last_names


def test_update_vendor_contact(client):
    h, vendor_id, _ = _setup(client)
    create = client.post(
        f"/api/v1/vendors/{vendor_id}/contacts",
        headers=h,
        json={"first_name": "Old", "last_name": "Name", "phone": "111-111"},
    )
    contact_id = create.json()["id"]

    r = client.patch(
        f"/api/v1/vendors/{vendor_id}/contacts/{contact_id}",
        headers=h,
        json={"first_name": "New", "last_name": "Updated", "phone": "222-222"},
    )
    assert r.status_code == 200
    assert r.json()["first_name"] == "New"
    assert r.json()["last_name"] == "Updated"
    assert r.json()["phone"] == "222-222"


def test_delete_vendor_contact_is_disabled(client):
    h, vendor_id, _ = _setup(client)
    create = client.post(
        f"/api/v1/vendors/{vendor_id}/contacts",
        headers=h,
        json={"first_name": "To", "last_name": "Delete"},
    )
    contact_id = create.json()["id"]

    r = client.delete(f"/api/v1/vendors/{vendor_id}/contacts/{contact_id}", headers=h)
    assert r.status_code == 405
    assert r.json()["detail"] == "Deletion is disabled"

    # Verify record is still present
    contacts = client.get(f"/api/v1/vendors/{vendor_id}/contacts", headers=h)
    assert contacts.status_code == 200
    assert len(contacts.json()) == 1
    assert contacts.json()[0]["id"] == contact_id


def test_vendor_contact_requires_valid_vendor(client):
    bootstrap_tenant(client, "VendorContactTest2")
    token = login(client)
    h = auth_header(token)

    r = client.post(
        "/api/v1/vendors/99999/contacts",
        headers=h,
        json={"first_name": "Ghost", "last_name": "Contact"},
    )
    assert r.status_code == 404


def test_vendor_contact_requires_auth(client):
    r = client.post(
        "/api/v1/vendors/1/contacts",
        json={"first_name": "No", "last_name": "Auth"},
    )
    assert r.status_code == 401

    r = client.get("/api/v1/vendors/1/contacts")
    assert r.status_code == 401


def test_vendor_contact_update_and_delete_require_matching_vendor_path(client):
    h, vendor_id, client_id = _setup(client)
    vendor_2 = client.post(
        "/api/v1/vendors",
        headers=h,
        json={"name": "Other Vendor", "client_ids": [client_id]},
    ).json()
    contact = client.post(
        f"/api/v1/vendors/{vendor_id}/contacts",
        headers=h,
        json={"first_name": "Mismatch", "last_name": "Case"},
    ).json()

    wrong_update = client.patch(
        f"/api/v1/vendors/{vendor_2['id']}/contacts/{contact['id']}",
        headers=h,
        json={"first_name": "ShouldFail"},
    )
    assert wrong_update.status_code == 404

    wrong_delete = client.delete(
        f"/api/v1/vendors/{vendor_2['id']}/contacts/{contact['id']}",
        headers=h,
    )
    assert wrong_delete.status_code == 405


def test_vendor_contact_permissions_still_apply_when_parent_vendor_deletion_is_disabled(client):
    tenant_id, _ = bootstrap_tenant(client, "VendorPermDeletionDisabled")
    admin_h = auth_header(login(client))
    _create_recruiter_user(tenant_id=tenant_id)
    recruiter_h = auth_header(login(client, "recruiter@example.com"))

    parent_client = client.post("/api/v1/clients", headers=admin_h, json={"name": "Client For Vendor"}).json()
    owner_vendor = client.post(
        "/api/v1/vendors",
        headers=admin_h,
        json={"name": "Owned Vendor", "client_ids": [parent_client["id"]]},
    ).json()
    contact = client.post(
        f"/api/v1/vendors/{owner_vendor['id']}/contacts",
        headers=admin_h,
        json={"first_name": "Protected", "last_name": "Contact"},
    ).json()

    active_update = client.patch(
        f"/api/v1/vendors/{owner_vendor['id']}/contacts/{contact['id']}",
        headers=recruiter_h,
        json={"first_name": "NoAccess"},
    )
    assert active_update.status_code == 403

    delete_vendor = client.delete(f"/api/v1/vendors/{owner_vendor['id']}", headers=admin_h)
    assert delete_vendor.status_code == 405

    after_delete_attempt_update = client.patch(
        f"/api/v1/vendors/{owner_vendor['id']}/contacts/{contact['id']}",
        headers=recruiter_h,
        json={"first_name": "StillNoAccess"},
    )
    assert after_delete_attempt_update.status_code == 403
