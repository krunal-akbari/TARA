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
    # Vendor creation requires a client_id; auto-creates a link to Client A
    v1 = client.post("/api/v1/vendors", headers=auth_header(token1), json={"name": "Vendor P", "client_id": c1["id"]}).json()

    # Auto-link to c1 already exists, so create a second link to c2
    link2 = client.post(
        "/api/v1/client-vendor-links",
        headers=auth_header(token1),
        json={"client_id": c2["id"], "vendor_id": v1["id"], "priority": 20},
    )
    assert link2.status_code == 201, link2.text

    links = client.get("/api/v1/client-vendor-links", headers=auth_header(token1))
    assert links.status_code == 200
    assert links.json()["total"] == 2

    tenant2_client = client.post("/api/v1/clients", headers=auth_header(token2), json={"name": "Tenant2 Client"}).json()

    forbidden_cross_read = client.get(f"/api/v1/clients/{tenant2_client['id']}", headers=auth_header(token1))
    assert forbidden_cross_read.status_code == 404
