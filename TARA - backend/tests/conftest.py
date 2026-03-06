import os
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Configure test settings before importing app modules.
os.environ["APP_NAME"] = "TARA ATS Backend Test"
os.environ["ENV"] = "test"
os.environ["DEBUG"] = "false"
os.environ["DATABASE_URL"] = "sqlite:///./test_tara.db"
os.environ["BOOTSTRAP_API_KEY"] = "test-bootstrap-key"
os.environ["PUBLIC_ONBOARDING_KEYS"] = "public-key-1,public-key-2"
os.environ["PUBLIC_ONBOARDING_ALLOWED_EMAILS"] = "public-admin@example.com,admin@example.com"
os.environ["AUTO_CREATE_TABLES"] = "true"
os.environ["STORAGE_BACKEND"] = "local"
os.environ["LOCAL_STORAGE_PATH"] = "./test_storage"
os.environ["JWT_SECRET_KEY"] = "test-secret"

from app.main import app  # noqa: E402
from app.platform.db import Base, SessionLocal, engine  # noqa: E402
from app.platform.models_registry import *  # noqa: F403,E402


@pytest.fixture(autouse=True)
def reset_db_and_storage() -> None:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    storage = Path("./test_storage")
    if storage.exists():
        shutil.rmtree(storage, ignore_errors=True)
    storage.mkdir(parents=True, exist_ok=True)

    from app.domains.super_admin.service import seed_initial_super_admin

    db = SessionLocal()
    try:
        seed_initial_super_admin(db)
    finally:
        db.close()


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def bootstrap_tenant(client: TestClient, tenant_name: str, email: str = "admin@example.com") -> tuple[int, str]:
    response = client.post(
        "/api/v1/admin/tenants/bootstrap",
        headers={"X-Bootstrap-Key": "test-bootstrap-key"},
        json={
            "tenant_name": tenant_name,
            "admin_email": email,
            "admin_password": "Password123!",
            "currency_code": "USD",
            "timezone": "UTC",
            "resume_retention_days": 365,
            "audit_retention_days": 730,
        },
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    return payload["tenant_id"], email


def login(client: TestClient, email: str = "admin@example.com") -> str:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return token


def public_onboarding(client: TestClient, tenant_name: str, email: str = "public-admin@example.com") -> tuple[int, str]:
    response = client.post(
        "/api/v1/public/onboarding",
        headers={"X-Onboarding-Key": "public-key-1"},
        json={
            "tenant_name": tenant_name,
            "admin_email": email,
            "admin_password": "Password123!",
            "currency_code": "USD",
            "timezone": "UTC",
            "resume_retention_days": 365,
            "audit_retention_days": 730,
        },
    )
    assert response.status_code == 201, response.text
    payload = response.json()
    return payload["tenant_id"], email


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
