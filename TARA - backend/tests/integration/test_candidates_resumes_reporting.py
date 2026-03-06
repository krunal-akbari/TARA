from tests.conftest import auth_header, bootstrap_tenant, login


def test_candidate_dedupe_resume_and_reporting(client):
    _tenant_id, email = bootstrap_tenant(client, "tenant-candidate", "candidate-admin@example.com")
    token = login(client, email)
    headers = auth_header(token)

    candidate_1 = client.post(
        "/api/v1/candidates",
        headers=headers,
        json={
            "first_name": "John",
            "last_name": "Doe",
            "email": "john@example.com",
            "phone": "+1 (555) 100-2000",
        },
    )
    assert candidate_1.status_code == 201
    candidate_1_payload = candidate_1.json()

    candidate_2 = client.post(
        "/api/v1/candidates",
        headers=headers,
        json={
            "first_name": "Jane",
            "last_name": "Smith",
            "email": "jane@example.com",
            "phone": "+1 (555) 300-4000",
        },
    )
    assert candidate_2.status_code == 201
    candidate_2_payload = candidate_2.json()

    dedupe = client.get(
        f"/api/v1/candidates/{candidate_2_payload['id']}/dedupe-check",
        headers=headers,
        params={"email": "john@example.com", "phone": "5551002000"},
    )
    assert dedupe.status_code == 200
    dedupe_payload = dedupe.json()
    assert dedupe_payload["total_matches"] == 1
    assert dedupe_payload["matches"][0]["id"] == candidate_1_payload["id"]

    upload = client.post(
        f"/api/v1/candidates/{candidate_1_payload['id']}/resumes",
        headers=headers,
        files={"file": ("resume.txt", b"Sample resume content", "text/plain")},
    )
    assert upload.status_code == 201, upload.text
    resume = upload.json()
    assert resume["parse_status"] == "pending"

    resumes = client.get(f"/api/v1/candidates/{candidate_1_payload['id']}/resumes", headers=headers)
    assert resumes.status_code == 200
    assert resumes.json()["total"] == 1

    report = client.get("/api/v1/reports/operational", headers=headers)
    assert report.status_code == 200
    body = report.json()
    assert body["candidates_total"] == 2
    assert body["jobs_total"] == 0


def test_resume_upload_same_filename_generates_unique_storage_key(client):
    _tenant_id, email = bootstrap_tenant(client, "tenant-resume-unique", "resume-admin@example.com")
    token = login(client, email)
    headers = auth_header(token)

    candidate = client.post(
        "/api/v1/candidates",
        headers=headers,
        json={"first_name": "File", "last_name": "Collision"},
    )
    assert candidate.status_code == 201
    candidate_id = candidate.json()["id"]

    first = client.post(
        f"/api/v1/candidates/{candidate_id}/resumes",
        headers=headers,
        files={"file": ("resume.txt", b"v1", "text/plain")},
    )
    second = client.post(
        f"/api/v1/candidates/{candidate_id}/resumes",
        headers=headers,
        files={"file": ("resume.txt", b"v2", "text/plain")},
    )
    assert first.status_code == 201, first.text
    assert second.status_code == 201, second.text
    assert first.json()["storage_key"] != second.json()["storage_key"]

    resumes = client.get(f"/api/v1/candidates/{candidate_id}/resumes", headers=headers)
    assert resumes.status_code == 200
    assert resumes.json()["total"] == 2


def test_resume_upload_returns_404_for_missing_candidate(client):
    _tenant_id, email = bootstrap_tenant(client, "tenant-resume-not-found", "resume-missing@example.com")
    token = login(client, email)
    headers = auth_header(token)

    upload = client.post(
        "/api/v1/candidates/999999/resumes",
        headers=headers,
        files={"file": ("resume.txt", b"content", "text/plain")},
    )
    assert upload.status_code == 404
