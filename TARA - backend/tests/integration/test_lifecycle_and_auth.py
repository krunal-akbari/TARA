from tests.conftest import auth_header, bootstrap_tenant


def test_auth_refresh_logout_and_entity_lifecycle(client):
    tenant_id, email = bootstrap_tenant(client, "tenant-lifecycle", "life-admin@example.com")

    login = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert login.status_code == 200
    tokens = login.json()
    access_token = tokens["access_token"]
    refresh_token = tokens["refresh_token"]
    headers = auth_header(access_token)

    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh.status_code == 200
    refreshed_tokens = refresh.json()

    logout = client.post("/api/v1/auth/logout", json={"refresh_token": refreshed_tokens["refresh_token"]})
    assert logout.status_code == 204

    refresh_after_logout = client.post("/api/v1/auth/refresh", json={"refresh_token": refreshed_tokens["refresh_token"]})
    assert refresh_after_logout.status_code == 401

    client_create = client.post("/api/v1/clients", headers=headers, json={"name": "Lifecycle Client"})
    assert client_create.status_code == 201
    vendor_create = client.post("/api/v1/vendors", headers=headers, json={"name": "Lifecycle Vendor", "client_ids": [client_create.json()["id"]]})
    candidate_create = client.post(
        "/api/v1/candidates",
        headers=headers,
        json={"first_name": "Alex", "last_name": "Lane", "email": "alex@lane.com", "phone": "12345"},
    )
    job_create = client.post(
        "/api/v1/jobs",
        headers=headers,
        json={
            "title": "Lifecycle Job",
            "description": "desc",
            "status": "open",
            "priority": "cold",
            "intake_channel": "marketplace",
        },
    )

    assert vendor_create.status_code == 201
    assert candidate_create.status_code == 201
    assert job_create.status_code == 201
    assert job_create.json()["priority"] == "cold"

    client_id = client_create.json()["id"]
    vendor_id = vendor_create.json()["id"]
    candidate_id = candidate_create.json()["id"]
    job_id = job_create.json()["id"]

    contact_create = client.post(
        f"/api/v1/clients/{client_id}/contacts",
        headers=headers,
        json={"first_name": "Priya", "last_name": "Shah", "email": "priya@client.com", "phone": "11111"},
    )
    assert contact_create.status_code == 201

    # Vendor creation auto-created a link to the client; retrieve it
    links_resp = client.get("/api/v1/client-vendor-links", headers=headers)
    assert links_resp.status_code == 200
    link_id = links_resp.json()["items"][0]["id"]

    # Create a second client and link it to the same vendor
    client2_create = client.post("/api/v1/clients", headers=headers, json={"name": "Second Client"})
    assert client2_create.status_code == 201
    client2_id = client2_create.json()["id"]
    link_create = client.post(
        "/api/v1/client-vendor-links",
        headers=headers,
        json={"client_id": client2_id, "vendor_id": vendor_id, "priority": "warm", "status": "active"},
    )
    assert link_create.status_code == 201

    link_update = client.patch(
        f"/api/v1/client-vendor-links/{link_id}",
        headers=headers,
        json={"priority": "hot", "status": "inactive"},
    )
    assert link_update.status_code == 200

    client_update = client.patch(f"/api/v1/clients/{client_id}", headers=headers, json={"name": "Updated Client"})
    vendor_update = client.patch(f"/api/v1/vendors/{vendor_id}", headers=headers, json={"name": "Updated Vendor"})
    candidate_update = client.patch(
        f"/api/v1/candidates/{candidate_id}",
        headers=headers,
        json={"first_name": "Avery", "phone": "98765"},
    )
    job_update = client.patch(
        f"/api/v1/jobs/{job_id}",
        headers=headers,
        json={"title": "Updated Job", "intake_channel": "preferred_vendor", "priority": "warn"},
    )

    assert client_update.status_code == 200
    assert vendor_update.status_code == 200
    assert candidate_update.status_code == 200
    assert job_update.status_code == 200
    assert job_update.json()["priority"] == "warm"

    assert client.delete(f"/api/v1/client-vendor-links/{link_id}", headers=headers).status_code == 405
    assert client.delete(f"/api/v1/clients/{client_id}", headers=headers).status_code == 405
    assert client.delete(f"/api/v1/vendors/{vendor_id}", headers=headers).status_code == 405
    assert client.delete(f"/api/v1/candidates/{candidate_id}", headers=headers).status_code == 405
    assert client.delete(f"/api/v1/jobs/{job_id}", headers=headers).status_code == 405

    contacts_after_delete = client.get(f"/api/v1/clients/{client_id}/contacts", headers=headers)
    assert contacts_after_delete.status_code == 200
    assert len(contacts_after_delete.json()) == 1

    assert client.post(f"/api/v1/client-vendor-links/{link_id}/restore", headers=headers).status_code == 200
    assert client.post(f"/api/v1/clients/{client_id}/restore", headers=headers).status_code == 200
    assert client.post(f"/api/v1/vendors/{vendor_id}/restore", headers=headers).status_code == 200
    assert client.post(f"/api/v1/candidates/{candidate_id}/restore", headers=headers).status_code == 200
    assert client.post(f"/api/v1/jobs/{job_id}/restore", headers=headers).status_code == 200

    events = client.get("/api/v1/activity-events", headers=headers)
    assert events.status_code == 200
    assert events.json()["total"] >= 10
