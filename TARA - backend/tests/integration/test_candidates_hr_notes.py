from sqlalchemy import text

from app.platform.db import _ensure_candidate_hr_notes_columns, engine
from tests.conftest import auth_header, bootstrap_tenant


def test_candidate_hr_notes_sections_persist(client):
    _tenant_id, admin_email = bootstrap_tenant(client, "tenant-candidate-hr-notes", "hr-notes-admin@example.com")

    login = client.post("/api/v1/auth/login", json={"email": admin_email, "password": "Password123!"})
    assert login.status_code == 200, login.text
    headers = auth_header(login.json()["access_token"])

    created = client.post(
        "/api/v1/candidates",
        headers=headers,
        json={"first_name": "Ava", "last_name": "Stone", "email": "ava@example.com"},
    )
    assert created.status_code == 201, created.text
    candidate_id = created.json()["id"]

    updated = client.patch(
        f"/api/v1/candidates/{candidate_id}",
        headers=headers,
        json={
            "hr_notes_general": "General text",
            "hr_notes_status": "Status text",
            "hr_notes_pay": "Pay text",
            "hr_notes_notes": "Notes text",
        },
    )
    assert updated.status_code == 200, updated.text
    payload = updated.json()
    assert payload["hr_notes_general"] == "General text"
    assert payload["hr_notes_status"] == "Status text"
    assert payload["hr_notes_pay"] == "Pay text"
    assert payload["hr_notes_notes"] == "Notes text"

    fetched = client.get(f"/api/v1/candidates/{candidate_id}", headers=headers)
    assert fetched.status_code == 200, fetched.text
    read_back = fetched.json()
    assert read_back["hr_notes_general"] == "General text"
    assert read_back["hr_notes_status"] == "Status text"
    assert read_back["hr_notes_pay"] == "Pay text"
    assert read_back["hr_notes_notes"] == "Notes text"


def test_legacy_hr_notes_migrates_to_general(client):
    _tenant_id, admin_email = bootstrap_tenant(client, "tenant-candidate-legacy-notes", "legacy-notes-admin@example.com")

    login = client.post("/api/v1/auth/login", json={"email": admin_email, "password": "Password123!"})
    assert login.status_code == 200, login.text
    headers = auth_header(login.json()["access_token"])

    created = client.post(
        "/api/v1/candidates",
        headers=headers,
        json={"first_name": "Mia", "last_name": "Lane", "email": "mia@example.com"},
    )
    assert created.status_code == 201, created.text
    candidate_id = created.json()["id"]

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE candidates ADD COLUMN hr_notes TEXT"))
        connection.execute(
            text("UPDATE candidates SET hr_notes = :legacy_value, hr_notes_general = NULL WHERE id = :candidate_id"),
            {"legacy_value": "Legacy single-note value", "candidate_id": candidate_id},
        )

    _ensure_candidate_hr_notes_columns()

    fetched = client.get(f"/api/v1/candidates/{candidate_id}", headers=headers)
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["hr_notes_general"] == "Legacy single-note value"
