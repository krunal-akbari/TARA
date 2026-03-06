from app.domains.resumes import service as resume_service
from app.domains.resumes.mineru_client import MinerUClientError
from tests.conftest import auth_header, bootstrap_tenant, login


def test_extract_preview_uses_mineru_when_enabled(client, monkeypatch):
    _tenant_id, email = bootstrap_tenant(client, "tenant-resume-mineru", "resume-mineru@example.com")
    token = login(client, email)
    headers = auth_header(token)

    monkeypatch.setattr(resume_service.settings, "resume_parser_backend", "mineru")
    monkeypatch.setattr(resume_service.settings, "resume_parser_allow_fallback", True)

    called = {"count": 0}

    def fake_mineru_extract(*, file_name: str, content_type: str, data: bytes) -> str:
        _ = (file_name, content_type, data)
        called["count"] += 1
        return (
            "John Doe\n"
            "john.doe@example.com\n"
            "+1 (555) 111-2222\n"
            "Current Company: OpenData Labs\n"
        )

    monkeypatch.setattr(resume_service, "extract_text_with_mineru", fake_mineru_extract)

    response = client.post(
        "/api/v1/resumes/extract-preview",
        headers=headers,
        files={"file": ("resume.pdf", b"%PDF-1.4 dummy", "application/pdf")},
    )
    assert response.status_code == 200, response.text
    payload = response.json()

    assert called["count"] == 1
    assert payload["first_name"] == "John"
    assert payload["last_name"] == "Doe"
    assert payload["email"] == "john.doe@example.com"
    assert payload["phone"] == "+1 (555) 111-2222"
    assert payload["current_company"] == "OpenData Labs"


def test_extract_preview_falls_back_to_native_when_mineru_fails(client, monkeypatch):
    _tenant_id, email = bootstrap_tenant(client, "tenant-resume-fallback", "resume-fallback@example.com")
    token = login(client, email)
    headers = auth_header(token)

    monkeypatch.setattr(resume_service.settings, "resume_parser_backend", "auto")
    monkeypatch.setattr(resume_service.settings, "resume_parser_allow_fallback", True)

    def fake_mineru_extract(*, file_name: str, content_type: str, data: bytes) -> str:
        _ = (file_name, content_type, data)
        raise MinerUClientError("simulated mineru outage")

    monkeypatch.setattr(resume_service, "extract_text_with_mineru", fake_mineru_extract)

    content = (
        b"Jane Smith\n"
        b"jane.smith@example.com\n"
        b"+1 555 333 4444\n"
        b"Current Company: Example Corp\n"
    )
    response = client.post(
        "/api/v1/resumes/extract-preview",
        headers=headers,
        files={"file": ("resume.txt", content, "text/plain")},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["first_name"] == "Jane"
    assert payload["last_name"] == "Smith"
    assert payload["email"] == "jane.smith@example.com"
    assert payload["current_company"] == "Example Corp"


def test_extract_preview_errors_when_mineru_required_and_unavailable(client, monkeypatch):
    _tenant_id, email = bootstrap_tenant(client, "tenant-resume-strict", "resume-strict@example.com")
    token = login(client, email)
    headers = auth_header(token)

    monkeypatch.setattr(resume_service.settings, "resume_parser_backend", "mineru")
    monkeypatch.setattr(resume_service.settings, "resume_parser_allow_fallback", False)

    def fake_mineru_extract(*, file_name: str, content_type: str, data: bytes) -> str:
        _ = (file_name, content_type, data)
        raise MinerUClientError("simulated mineru outage")

    monkeypatch.setattr(resume_service, "extract_text_with_mineru", fake_mineru_extract)

    response = client.post(
        "/api/v1/resumes/extract-preview",
        headers=headers,
        files={"file": ("resume.txt", b"Resume data", "text/plain")},
    )
    assert response.status_code == 400
    assert "mineru outage" in response.json()["detail"].lower()
