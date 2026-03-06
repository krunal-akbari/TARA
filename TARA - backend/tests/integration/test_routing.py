from tests.conftest import auth_header, bootstrap_tenant, login


def test_routing_revisits_sequence_and_current_route(client):
    tenant_id, email = bootstrap_tenant(client, "tenant-routing", "route-admin@example.com")
    token = login(client, email)
    headers = auth_header(token)

    client_a = client.post("/api/v1/clients", headers=headers, json={"name": "Client A"}).json()
    client_b = client.post("/api/v1/clients", headers=headers, json={"name": "Client B"}).json()
    # Vendor creation requires client_ids; auto-creates links to specified clients
    vendor = client.post("/api/v1/vendors", headers=headers, json={"name": "Vendor 1", "client_ids": [client_a["id"]]}).json()

    # Auto-link to client_a already exists; create link to client_b
    response = client.post(
        "/api/v1/client-vendor-links",
        headers=headers,
        json={"client_id": client_b["id"], "vendor_id": vendor["id"], "priority": "hot"},
    )
    assert response.status_code == 201, response.text

    job = client.post(
        "/api/v1/jobs",
        headers=headers,
        json={"title": "Python Developer", "description": "Role", "status": "open"},
    ).json()

    job_id = job["id"]

    transitions = [
        {"to_node_type": "client", "to_node_id": client_a["id"], "reason": "submitted"},
        {"to_node_type": "vendor", "to_node_id": vendor["id"], "reason": "forwarded"},
        {"to_node_type": "client", "to_node_id": client_b["id"], "reason": "returned"},
        {"to_node_type": "vendor", "to_node_id": vendor["id"], "reason": "reopened"},
        {"to_node_type": "client", "to_node_id": client_a["id"], "reason": "manual_override"},
    ]

    for idx, payload in enumerate(transitions, start=1):
        response = client.post(
            f"/api/v1/jobs/{job_id}/route-transitions",
            headers={**headers, "Idempotency-Key": f"route-{idx}"},
            json=payload,
        )
        assert response.status_code == 201, response.text
        assert response.json()["sequence_no"] == idx

    # Idempotent replay should return the same stored transition.
    replay = client.post(
        f"/api/v1/jobs/{job_id}/route-transitions",
        headers={**headers, "Idempotency-Key": "route-1"},
        json=transitions[0],
    )
    assert replay.status_code == 201
    assert replay.json()["sequence_no"] == 1

    list_response = client.get(f"/api/v1/jobs/{job_id}/route-transitions", headers=headers)
    assert list_response.status_code == 200
    items = list_response.json()["items"]
    assert len(items) == 5
    assert [item["sequence_no"] for item in items] == [1, 2, 3, 4, 5]

    current = client.get(f"/api/v1/jobs/{job_id}/current-route", headers=headers)
    assert current.status_code == 200
    assert current.json()["current_node_type"] == "client"
    assert current.json()["current_node_id"] == client_a["id"]
    assert current.json()["last_transition_seq"] == 5

    # Moving from client to an unlinked vendor should be rejected.
    # Create a new client to satisfy vendor creation's required client_ids, but vendor_2 won't be linked to client_a or client_b.
    client_c = client.post("/api/v1/clients", headers=headers, json={"name": "Client C"}).json()
    vendor_2 = client.post("/api/v1/vendors", headers=headers, json={"name": "Vendor 2", "client_ids": [client_c["id"]]}).json()
    bad_transition = client.post(
        f"/api/v1/jobs/{job_id}/route-transitions",
        headers=headers,
        json={"to_node_type": "vendor", "to_node_id": vendor_2["id"], "reason": "forwarded"},
    )
    assert bad_transition.status_code == 400
