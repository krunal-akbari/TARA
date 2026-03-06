from tests.conftest import auth_header, bootstrap_tenant, login


def test_bootstrap_login_and_me(client):
    tenant_id, email = bootstrap_tenant(client, "tenant-auth")
    token = login(client, email)

    me = client.get("/api/v1/auth/me", headers=auth_header(token))
    assert me.status_code == 200
    payload = me.json()
    assert payload["tenant_id"] == tenant_id
    assert payload["email"] == email
    assert "admin" in payload["roles"]


def test_client_vendor_many_to_many_and_tenant_isolation(client):
    tenant1_id, tenant1_email = bootstrap_tenant(client, "tenant-one", "admin1@example.com")
    tenant2_id, tenant2_email = bootstrap_tenant(client, "tenant-two", "admin2@example.com")

    token1 = login(client, tenant1_email)
    token2 = login(client, tenant2_email)

    c1 = client.post("/api/v1/clients", headers=auth_header(token1), json={"name": "Client A"}).json()
    c2 = client.post("/api/v1/clients", headers=auth_header(token1), json={"name": "Client B"}).json()
    # Vendor creation requires client_ids; auto-creates links to specified clients
    v1 = client.post("/api/v1/vendors", headers=auth_header(token1), json={"name": "Vendor P", "client_ids": [c1["id"]]}).json()

    # Auto-link to c1 already exists, so create a second link to c2
    link2 = client.post(
        "/api/v1/client-vendor-links",
        headers=auth_header(token1),
        json={"client_id": c2["id"], "vendor_id": v1["id"], "priority": "warm"},
    )
    assert link2.status_code == 201, link2.text

    links = client.get("/api/v1/client-vendor-links", headers=auth_header(token1))
    assert links.status_code == 200
    assert links.json()["total"] == 2

    tenant2_client = client.post("/api/v1/clients", headers=auth_header(token2), json={"name": "Tenant2 Client"}).json()

    forbidden_cross_read = client.get(f"/api/v1/clients/{tenant2_client['id']}", headers=auth_header(token1))
    assert forbidden_cross_read.status_code == 404


def test_client_vendor_link_rejects_invalid_effective_date_range(client):
    _tenant_id, email = bootstrap_tenant(client, "tenant-link-dates", "dates-admin@example.com")
    token = login(client, email)
    headers = auth_header(token)

    c1 = client.post("/api/v1/clients", headers=headers, json={"name": "Client One"}).json()
    c2 = client.post("/api/v1/clients", headers=headers, json={"name": "Client Two"}).json()
    v1 = client.post("/api/v1/vendors", headers=headers, json={"name": "Vendor One", "client_ids": [c1["id"]]}).json()

    created = client.post(
        "/api/v1/client-vendor-links",
        headers=headers,
        json={
            "client_id": c2["id"],
            "vendor_id": v1["id"],
            "effective_from": "2026-02-10T00:00:00Z",
            "effective_to": "2026-02-20T00:00:00Z",
        },
    )
    assert created.status_code == 201, created.text
    link_id = created.json()["id"]

    invalid_update = client.patch(
        f"/api/v1/client-vendor-links/{link_id}",
        headers=headers,
        json={"effective_to": "2026-02-01T00:00:00Z"},
    )
    assert invalid_update.status_code == 400


def test_client_vendor_link_rejects_numeric_priority(client):
    _tenant_id, email = bootstrap_tenant(client, "tenant-link-priority", "priority-admin@example.com")
    token = login(client, email)
    headers = auth_header(token)

    c1 = client.post("/api/v1/clients", headers=headers, json={"name": "Client One"}).json()
    c2 = client.post("/api/v1/clients", headers=headers, json={"name": "Client Two"}).json()
    v1 = client.post("/api/v1/vendors", headers=headers, json={"name": "Vendor One", "client_ids": [c1["id"]]}).json()

    created = client.post(
        "/api/v1/client-vendor-links",
        headers=headers,
        json={"client_id": c2["id"], "vendor_id": v1["id"], "priority": 10},
    )
    assert created.status_code == 422
