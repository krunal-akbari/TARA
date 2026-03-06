from tests.conftest import auth_header, login, public_onboarding


def test_public_onboarding_allows_selected_key_and_email(client):
    tenant_id, email = public_onboarding(client, "tenant-public")

    token = login(client, email)
    me = client.get("/api/v1/auth/me", headers=auth_header(token))
    assert me.status_code == 200
    assert me.json()["tenant_id"] == tenant_id


def test_public_onboarding_rejects_invalid_key(client):
    response = client.post(
        "/api/v1/public/onboarding",
        headers={"X-Onboarding-Key": "wrong-key"},
        json={
            "tenant_name": "tenant-invalid-key",
            "admin_email": "public-admin@example.com",
            "admin_password": "Password123!",
            "currency_code": "USD",
            "timezone": "UTC",
            "resume_retention_days": 365,
            "audit_retention_days": 730,
        },
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid onboarding key"


def test_public_onboarding_rejects_non_allowlisted_email(client):
    response = client.post(
        "/api/v1/public/onboarding",
        headers={"X-Onboarding-Key": "public-key-1"},
        json={
            "tenant_name": "tenant-invalid-email",
            "admin_email": "not-allowed@example.com",
            "admin_password": "Password123!",
            "currency_code": "USD",
            "timezone": "UTC",
            "resume_retention_days": 365,
            "audit_retention_days": 730,
        },
    )
    assert response.status_code == 403
    assert response.json()["detail"] == "Admin email is not allowed for public onboarding"
