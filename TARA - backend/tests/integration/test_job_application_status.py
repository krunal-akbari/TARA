from tests.conftest import auth_header, bootstrap_tenant, login


def test_update_candidate_job_application_status(client):
    _tenant_id, email = bootstrap_tenant(client, "tenant-application-status", "app-status-admin@example.com")
    token = login(client, email)
    headers = auth_header(token)

    candidate_create = client.post(
        "/api/v1/candidates",
        headers=headers,
        json={"first_name": "Ava", "last_name": "Stone", "email": "ava.stone@example.com"},
    )
    assert candidate_create.status_code == 201
    candidate_id = candidate_create.json()["id"]

    job_create = client.post(
        "/api/v1/jobs",
        headers=headers,
        json={
            "title": "Backend Engineer",
            "description": "Role for status updates",
            "status": "active",
            "priority": "warm",
            "intake_channel": "direct_client",
        },
    )
    assert job_create.status_code == 201
    job_id = job_create.json()["id"]

    apply_response = client.post(
        f"/api/v1/jobs/{job_id}/applications",
        headers=headers,
        json={"candidate_id": candidate_id},
    )
    assert apply_response.status_code == 201
    application_id = apply_response.json()["id"]
    assert apply_response.json()["status"] == "applied"

    update_response = client.patch(
        f"/api/v1/jobs/{job_id}/applications/{application_id}",
        headers=headers,
        json={"status": "interview"},
    )
    assert update_response.status_code == 200
    assert update_response.json()["status"] == "interview"

    candidate_applications = client.get(
        f"/api/v1/jobs/candidate/{candidate_id}/applications",
        headers=headers,
    )
    assert candidate_applications.status_code == 200
    assert candidate_applications.json()["items"][0]["status"] == "interview"


def test_update_job_application_status_requires_valid_application(client):
    _tenant_id, email = bootstrap_tenant(client, "tenant-application-status-invalid", "app-status-invalid@example.com")
    token = login(client, email)
    headers = auth_header(token)

    job_create = client.post(
        "/api/v1/jobs",
        headers=headers,
        json={
            "title": "Invalid App Test Job",
            "description": "Role for invalid update",
            "status": "active",
            "priority": "warm",
            "intake_channel": "direct_client",
        },
    )
    assert job_create.status_code == 201
    job_id = job_create.json()["id"]

    missing_update = client.patch(
        f"/api/v1/jobs/{job_id}/applications/99999",
        headers=headers,
        json={"status": "interview"},
    )
    assert missing_update.status_code == 400
    assert missing_update.json()["detail"] == "Job application not found"
