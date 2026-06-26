import subprocess
from io import BytesIO
from zipfile import ZIP_DEFLATED, ZipFile

import pytest

from app.domains.resumes import service as resume_service
from app.platform.rate_limiter import limiter
from app.tasks.resume_tasks import process_resume
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


@pytest.fixture(autouse=True)
def reset_rate_limiter() -> None:
    limiter.reset()


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


def test_extract_preview_accepts_txt_files(client):
    tenant_id, email = bootstrap_tenant(client, "tenant-resume-txt", "resume-txt@example.com")
    headers = _login_headers(client, email=email, tenant_id=tenant_id)

    response = client.post(
        "/api/v1/resumes/extract-preview",
        headers=headers,
        files={
            "file": (
                "resume.txt",
                b"Alex Carter\nalex.carter@example.com\n+1 555 888 9999\nCurrent Company: Northwind\n",
                "text/plain",
            )
        },
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["first_name"] == "Alex"
    assert payload["last_name"] == "Carter"
    assert payload["email"] == "alex.carter@example.com"
    assert payload["phone"] == "+1 555 888 9999"
    assert payload["current_company"] == "Northwind"


def test_extract_preview_parses_text_pdf_with_magic_bytes(client, monkeypatch):
    tenant_id, email = bootstrap_tenant(client, "tenant-resume-pdf", "resume-pdf@example.com")
    headers = _login_headers(client, email=email, tenant_id=tenant_id)

    class FakePage:
        def extract_text(self):
            return "Mina Patel\nmina.patel@example.com\n+1 555 222 4444\nCurrent Company: Contoso\n"

    class FakePdfReader:
        is_encrypted = False
        pages = [FakePage()]

        def __init__(self, _stream):
            pass

    monkeypatch.setattr(resume_service, "PdfReader", FakePdfReader)

    response = client.post(
        "/api/v1/resumes/extract-preview",
        headers=headers,
        files={"file": ("resume.bin", b"%PDF-1.7 fake", "application/octet-stream")},
    )

    assert response.status_code == 200, response.text
    assert response.json()["email"] == "mina.patel@example.com"


def test_scanned_pdf_returns_clear_error(client, monkeypatch):
    tenant_id, email = bootstrap_tenant(client, "tenant-resume-scanned", "resume-scanned@example.com")
    headers = _login_headers(client, email=email, tenant_id=tenant_id)

    class FakePage:
        def extract_text(self):
            return ""

    class FakePdfReader:
        is_encrypted = False
        pages = [FakePage()]

        def __init__(self, _stream):
            pass

    monkeypatch.setattr(resume_service, "PdfReader", FakePdfReader)

    response = client.post(
        "/api/v1/resumes/extract-preview",
        headers=headers,
        files={"file": ("resume.pdf", b"%PDF-1.7 fake", "application/pdf")},
    )

    assert response.status_code == 400
    assert "no extractable text layer" in response.json()["detail"]


def test_pdf_page_cap_returns_clear_error(client, monkeypatch):
    tenant_id, email = bootstrap_tenant(client, "tenant-resume-pdf-cap", "resume-pdf-cap@example.com")
    headers = _login_headers(client, email=email, tenant_id=tenant_id)

    class FakePage:
        def extract_text(self):
            return "Jane Smith"

    class FakePdfReader:
        is_encrypted = False

        def __init__(self, _stream):
            self.pages = [FakePage()] * (resume_service.MAX_PDF_PAGES + 1)

    monkeypatch.setattr(resume_service, "PdfReader", FakePdfReader)

    response = client.post(
        "/api/v1/resumes/extract-preview",
        headers=headers,
        files={"file": ("resume.pdf", b"%PDF-1.7 fake", "application/pdf")},
    )

    assert response.status_code == 400
    assert "max page count" in response.json()["detail"]


def test_binary_upload_is_rejected_not_garbled(client):
    tenant_id, email = bootstrap_tenant(client, "tenant-resume-binary", "resume-binary@example.com")
    headers = _login_headers(client, email=email, tenant_id=tenant_id)

    response = client.post(
        "/api/v1/resumes/extract-preview",
        headers=headers,
        files={"file": ("resume.bin", b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x00\x01\x02", "application/octet-stream")},
    )

    assert response.status_code == 400
    assert "Unsupported" in response.json()["detail"]


def test_rtf_control_words_do_not_leak_into_extracted_fields(client):
    tenant_id, email = bootstrap_tenant(client, "tenant-resume-rtf", "resume-rtf@example.com")
    headers = _login_headers(client, email=email, tenant_id=tenant_id)
    rtf = (
        br"{\rtf1\ansi "
        br"Taylor Green\par "
        br"taylor.green@example.com\par "
        br"+1 555 777 1212\par "
        br"Current Company: Fabrikam\par}"
    )

    response = client.post(
        "/api/v1/resumes/extract-preview",
        headers=headers,
        files={"file": ("resume.rtf", rtf, "application/rtf")},
    )

    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["email"] == "taylor.green@example.com"
    assert payload["phone"] == "+1 555 777 1212"
    assert payload["current_company"] == "Fabrikam"


def test_docx_xml_size_guard_rejects_oversized_document(client, monkeypatch):
    tenant_id, email = bootstrap_tenant(client, "tenant-resume-docx-guard", "resume-docx-guard@example.com")
    headers = _login_headers(client, email=email, tenant_id=tenant_id)
    monkeypatch.setattr(resume_service, "MAX_DOCX_XML_BYTES", 64)

    response = client.post(
        "/api/v1/resumes/extract-preview",
        headers=headers,
        files={
            "file": (
                "resume.docx",
                _build_docx("Jane Smith\njane.smith@example.com\n"),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    )

    assert response.status_code == 400
    assert "exceeds max size" in response.json()["detail"]


def test_docx_xml_entity_bomb_is_rejected(client):
    tenant_id, email = bootstrap_tenant(client, "tenant-resume-docx-entity", "resume-docx-entity@example.com")
    headers = _login_headers(client, email=email, tenant_id=tenant_id)
    document_xml = (
        '<?xml version="1.0"?>'
        '<!DOCTYPE lolz [<!ENTITY lol "lol">]>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        "<w:body><w:p><w:r><w:t>&lol;</w:t></w:r></w:p></w:body>"
        "</w:document>"
    )
    buffer = BytesIO()
    with ZipFile(buffer, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", document_xml)

    response = client.post(
        "/api/v1/resumes/extract-preview",
        headers=headers,
        files={
            "file": (
                "resume.docx",
                buffer.getvalue(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    )

    assert response.status_code == 400
    assert "Invalid DOCX XML" in response.json()["detail"]


def test_resume_process_task_has_time_limits():
    assert process_resume.soft_time_limit == 60
    assert process_resume.time_limit == 90
