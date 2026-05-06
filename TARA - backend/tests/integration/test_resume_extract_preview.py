import subprocess
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

from app.domains.resumes import service as resume_service
from app.domains.resumes.mineru_client import MinerUClientError
from tests.conftest import bootstrap_tenant


def _build_docx(text: str) -> bytes:
    paragraphs = "".join(
        f"<w:p><w:r><w:t>{line}</w:t></w:r></w:p>"
        for line in text.splitlines()
        if line.strip()
    )
    document_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f"<w:body>{paragraphs}</w:body>"
        "</w:document>"
    )
    content_types_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
        '<Default Extension="xml" ContentType="application/xml"/>'
        '<Override PartName="/word/document.xml" '
        'ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
        "</Types>"
    )
    rels_xml = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" '
        'Target="word/document.xml"/>'
        "</Relationships>"
    )

    buffer = BytesIO()
    with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml)
        archive.writestr("_rels/.rels", rels_xml)
        archive.writestr("word/document.xml", document_xml)
    return buffer.getvalue()


def _login_headers(client, *, email: str, tenant_id: int) -> dict[str, str]:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    assert response.status_code == 200, response.text
    access_token = response.cookies.get("access_token")
    assert access_token
    return {
        "Cookie": f"access_token={access_token}",
        "X-Tenant-Id": str(tenant_id),
    }


def test_extract_preview_uses_mineru_when_enabled(client, monkeypatch):
    tenant_id, email = bootstrap_tenant(client, "tenant-resume-mineru", "resume-mineru@example.com")
    headers = _login_headers(client, email=email, tenant_id=tenant_id)

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
    tenant_id, email = bootstrap_tenant(client, "tenant-resume-fallback", "resume-fallback@example.com")
    headers = _login_headers(client, email=email, tenant_id=tenant_id)

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
    tenant_id, email = bootstrap_tenant(client, "tenant-resume-strict", "resume-strict@example.com")
    headers = _login_headers(client, email=email, tenant_id=tenant_id)

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


def test_extract_preview_accepts_docx_files(client):
    tenant_id, email = bootstrap_tenant(client, "tenant-resume-docx", "resume-docx@example.com")
    headers = _login_headers(client, email=email, tenant_id=tenant_id)

    content = _build_docx(
        "Jane Smith\n"
        "jane.smith@example.com\n"
        "+1 555 333 4444\n"
        "Current Company: Example Corp\n"
    )
    response = client.post(
        "/api/v1/resumes/extract-preview",
        headers=headers,
        files={
            "file": (
                "resume.docx",
                content,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["first_name"] == "Jane"
    assert payload["last_name"] == "Smith"
    assert payload["email"] == "jane.smith@example.com"
    assert payload["current_company"] == "Example Corp"


def test_extract_preview_accepts_doc_files_when_antiword_is_available(client, monkeypatch):
    tenant_id, email = bootstrap_tenant(client, "tenant-resume-doc", "resume-doc@example.com")
    headers = _login_headers(client, email=email, tenant_id=tenant_id)

    monkeypatch.setattr(
        resume_service.shutil,
        "which",
        lambda name: "/usr/bin/antiword" if name == "antiword" else None,
    )

    def fake_run(command, **kwargs):
        assert command[0] == "/usr/bin/antiword"
        assert command[1].endswith(".doc")
        return subprocess.CompletedProcess(
            args=command,
            returncode=0,
            stdout=(
                "John Doe\n"
                "john.doe@example.com\n"
                "+1 (555) 111-2222\n"
                "Current Company: OpenData Labs\n"
            ),
            stderr="",
        )

    monkeypatch.setattr(resume_service.subprocess, "run", fake_run)

    response = client.post(
        "/api/v1/resumes/extract-preview",
        headers=headers,
        files={"file": ("resume.doc", b"fake-binary-doc", "application/msword")},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["first_name"] == "John"
    assert payload["last_name"] == "Doe"
    assert payload["email"] == "john.doe@example.com"
    assert payload["phone"] == "+1 (555) 111-2222"
    assert payload["current_company"] == "OpenData Labs"
