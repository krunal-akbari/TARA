from tests.conftest import auth_header, bootstrap_tenant


def test_admin_can_create_and_list_users(client):
    _tenant_id, admin_email = bootstrap_tenant(client, "tenant-users", "users-admin@example.com")

    admin_login = client.post(
        "/api/v1/auth/login",
        json={"email": admin_email, "password": "Password123!"},
    )
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["access_token"]
    headers = auth_header(admin_token)

    create_response = client.post(
        "/api/v1/users",
        headers=headers,
        json={
            "email": "hr-user@example.com",
            "password": "TempPass123!",
            "first_name": "Hr",
            "last_name": "User",
            "role": "hr",
        },
    )
    assert create_response.status_code == 201, create_response.text
    created = create_response.json()
    assert created["email"] == "hr-user@example.com"
    assert "hr" in created["roles"]

    list_response = client.get("/api/v1/users", headers=headers)
    assert list_response.status_code == 200
    payload = list_response.json()
    assert payload["total"] >= 2  # tenant admin + created hr user
    assert any(item["email"] == "hr-user@example.com" for item in payload["items"])

    hr_login = client.post(
        "/api/v1/auth/login",
        json={"email": "hr-user@example.com", "password": "TempPass123!"},
    )
    assert hr_login.status_code == 200


def test_recruiter_cannot_create_users(client):
    _tenant_id, admin_email = bootstrap_tenant(client, "tenant-users-roles", "roles-admin@example.com")
    admin_token = client.post(
        "/api/v1/auth/login",
        json={"email": admin_email, "password": "Password123!"},
    ).json()["access_token"]
    admin_headers = auth_header(admin_token)

    create_recruiter = client.post(
        "/api/v1/users",
        headers=admin_headers,
        json={
            "email": "recruiter-user@example.com",
            "password": "Recruit123!",
            "first_name": "Rec",
            "last_name": "Ruiter",
            "role": "recruiter",
        },
    )
    assert create_recruiter.status_code == 201, create_recruiter.text

    recruiter_login = client.post(
        "/api/v1/auth/login",
        json={"email": "recruiter-user@example.com", "password": "Recruit123!"},
    )
    assert recruiter_login.status_code == 200
    recruiter_headers = auth_header(recruiter_login.json()["access_token"])

    denied = client.post(
        "/api/v1/users",
        headers=recruiter_headers,
        json={
            "email": "blocked@example.com",
            "password": "Blocked123!",
            "first_name": "No",
            "last_name": "Access",
            "role": "hr",
        },
    )
    assert denied.status_code == 403

    denied_list = client.get("/api/v1/users", headers=recruiter_headers)
    assert denied_list.status_code == 403
