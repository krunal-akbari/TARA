import os
import re
import shutil
import subprocess
import tempfile
import xml.etree.ElementTree as ET
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

import boto3
from pypdf import PdfReader
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.audit.service import record_event
from app.domains.candidates.models import Candidate
from app.domains.resumes.mineru_client import MinerUClientError, extract_text_with_mineru
from app.domains.resumes.models import CandidateResume
from app.platform.settings import get_settings

settings = get_settings()

EMAIL_PATTERN = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.IGNORECASE)
PHONE_PATTERN = re.compile(r"(?:\+?\d[\d\s().-]{8,}\d)")
NAME_TOKEN_PATTERN = re.compile(r"^[A-Za-z][A-Za-z'.-]*$")
NAME_STOP_WORDS = {
    "resume",
    "curriculum",
    "vitae",
    "profile",
    "summary",
    "experience",
    "education",
    "skills",
    "objective",
}
COMPANY_PATTERN = re.compile(
    r"(?:current\s+company|current\s+employer|company|employer|organization)\s*[:\-]\s*([^\n\r]+)",
    re.IGNORECASE,
)


class StorageAdapter:
    def put(self, *, tenant_id: int, candidate_id: int, file_name: str, data: bytes, content_type: str) -> str:
        raise NotImplementedError

    def get(self, *, storage_key: str) -> bytes:
        raise NotImplementedError


class LocalStorageAdapter(StorageAdapter):
    def put(self, *, tenant_id: int, candidate_id: int, file_name: str, data: bytes, content_type: str) -> str:
        base = Path(settings.local_storage_path)
        folder = base / str(tenant_id) / str(candidate_id)
        folder.mkdir(parents=True, exist_ok=True)
        target = folder / file_name
        with target.open("wb") as handle:
            handle.write(data)
        return str(target)

    def get(self, *, storage_key: str) -> bytes:
        candidate_paths: list[Path] = []
        raw = Path(storage_key)
        candidate_paths.append(raw)
        if not raw.is_absolute():
            candidate_paths.append(Path(settings.local_storage_path) / raw)

        for path in candidate_paths:
            if path.exists():
                return path.read_bytes()

        raise LookupError("Resume content not found in local storage")


class S3StorageAdapter(StorageAdapter):
    def __init__(self) -> None:
        self.client = boto3.client("s3", region_name=settings.aws_region)

    def put(self, *, tenant_id: int, candidate_id: int, file_name: str, data: bytes, content_type: str) -> str:
        key = f"{tenant_id}/{candidate_id}/{file_name}"
        self.client.put_object(
            Bucket=settings.aws_s3_bucket,
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        return key

    def get(self, *, storage_key: str) -> bytes:
        response = self.client.get_object(Bucket=settings.aws_s3_bucket, Key=storage_key)
        return response["Body"].read()


def _storage() -> StorageAdapter:
    if settings.storage_backend.lower() == "s3":
        return S3StorageAdapter()
    return LocalStorageAdapter()


def _collapse_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _extract_pdf_text(data: bytes) -> str:
    reader = PdfReader(BytesIO(data))
    pages: list[str] = []
    for page in reader.pages:
        page_text = page.extract_text() or ""
        if page_text.strip():
            pages.append(page_text)
    return "\n".join(pages).strip()


def _extract_docx_text(data: bytes) -> str:
    try:
        with ZipFile(BytesIO(data)) as archive:
            xml_bytes = archive.read("word/document.xml")
    except (KeyError, BadZipFile) as exc:
        raise ValueError("Invalid DOCX file") from exc

    root = ET.fromstring(xml_bytes)
    ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    lines: list[str] = []

    for paragraph in root.findall(".//w:p", ns):
        parts = [node.text for node in paragraph.findall(".//w:t", ns) if node.text]
        merged = _collapse_spaces("".join(parts))
        if merged:
            lines.append(merged)

    return "\n".join(lines).strip()


def _extract_doc_text(data: bytes) -> str:
    antiword_path = shutil.which("antiword")
    if not antiword_path:
        raise ValueError(
            "Legacy .doc parsing requires antiword on the backend. Install antiword or convert the file to PDF or DOCX."
        )

    temp_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".doc", delete=False) as handle:
            handle.write(data)
            temp_path = Path(handle.name)

        result = subprocess.run(
            [antiword_path, str(temp_path)],
            capture_output=True,
            check=False,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=30,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise ValueError(f"Could not extract readable text from DOC file: {exc}") from exc
    finally:
        if temp_path is not None:
            temp_path.unlink(missing_ok=True)

    if result.returncode != 0:
        detail = _collapse_spaces(result.stderr or result.stdout)
        if detail:
            raise ValueError(f"Could not extract readable text from DOC file: {detail}")
        raise ValueError("Could not extract readable text from DOC file")

    text = result.stdout.strip()
    if not text:
        raise ValueError("Could not extract readable text from DOC file")
    return text


def _extract_text_native(file_name: str, content_type: str, data: bytes) -> str:
    suffix = Path(file_name).suffix.lower()
    content = content_type.lower()

    if suffix == ".pdf" or "pdf" in content:
        text = _extract_pdf_text(data)
    elif suffix == ".docx" or "wordprocessingml.document" in content:
        text = _extract_docx_text(data)
    elif suffix == ".doc" or content == "application/msword":
        text = _extract_doc_text(data)
    elif suffix in {".txt", ".md", ".rtf"} or content.startswith("text/"):
        text = data.decode("utf-8", errors="ignore").strip()
    else:
        # Best-effort plain text fallback for unknown formats.
        text = data.decode("utf-8", errors="ignore").strip()

    if not text:
        raise ValueError("Could not extract readable text from resume")
    return text


def _prefers_native_parser(file_name: str, content_type: str) -> bool:
    suffix = Path(file_name).suffix.lower()
    content = content_type.lower()

    return (
        suffix in {".doc", ".docx", ".txt", ".md", ".rtf"}
        or content == "application/msword"
        or "wordprocessingml.document" in content
        or content.startswith("text/")
    )


def _extract_text(file_name: str, content_type: str, data: bytes) -> str:
    backend = settings.resume_parser_backend.strip().lower()

    if _prefers_native_parser(file_name=file_name, content_type=content_type):
        return _extract_text_native(file_name=file_name, content_type=content_type, data=data)

    if backend in {"mineru", "auto"}:
        try:
            text = extract_text_with_mineru(file_name=file_name, content_type=content_type, data=data)
            if text:
                return text
        except MinerUClientError as exc:
            if backend == "mineru" and not settings.resume_parser_allow_fallback:
                raise ValueError(str(exc)) from exc
        except Exception as exc:
            if backend == "mineru" and not settings.resume_parser_allow_fallback:
                raise ValueError(f"MinerU parse failed: {exc}") from exc

    if backend == "mineru" and not settings.resume_parser_allow_fallback:
        raise ValueError("MinerU parse failed and fallback parser is disabled")
    return _extract_text_native(file_name=file_name, content_type=content_type, data=data)


def _extract_name(lines: list[str]) -> tuple[str | None, str | None]:
    for raw_line in lines[:25]:
        line = _collapse_spaces(raw_line)
        if not line or "@" in line:
            continue
        if any(ch.isdigit() for ch in line):
            continue

        tokens = [piece for piece in line.replace(",", " ").split(" ") if piece]
        lowered = {token.lower() for token in tokens}
        if lowered & NAME_STOP_WORDS:
            continue
        if len(tokens) < 2 or len(tokens) > 4:
            continue
        if not all(NAME_TOKEN_PATTERN.match(token) for token in tokens):
            continue

        first_name = tokens[0]
        last_name = " ".join(tokens[1:])
        return first_name, last_name

    return None, None


def _extract_company(lines: list[str], full_text: str) -> str | None:
    match = COMPANY_PATTERN.search(full_text)
    if match:
        company = _collapse_spaces(match.group(1))
        return company[:255] if company else None

    for idx, line in enumerate(lines):
        if line.strip().lower() in {"experience", "work experience", "professional experience"}:
            for candidate_line in lines[idx + 1 : idx + 6]:
                if not candidate_line.strip():
                    continue
                if "@" in candidate_line:
                    continue
                if any(word in candidate_line.lower() for word in {"responsible", "worked", "developed"}):
                    continue
                return _collapse_spaces(candidate_line)[:255]
    return None


def extract_candidate_fields_from_resume(
    *,
    file_name: str,
    content_type: str,
    data: bytes,
) -> dict[str, str | None]:
    text = _extract_text(file_name=file_name, content_type=content_type, data=data)
    lines = [_collapse_spaces(line) for line in text.splitlines() if _collapse_spaces(line)]

    first_name, last_name = _extract_name(lines)
    email_match = EMAIL_PATTERN.search(text)
    phone_match = PHONE_PATTERN.search(text)
    company = _extract_company(lines, text)

    return {
        "first_name": first_name,
        "last_name": last_name,
        "email": email_match.group(0) if email_match else None,
        "phone": _collapse_spaces(phone_match.group(0)) if phone_match else None,
        "current_company": company,
    }


def create_resume(
    db: Session,
    *,
    tenant_id: int,
    candidate_id: int,
    actor_user_id: int,
    file_name: str,
    content_type: str,
    data: bytes,
) -> CandidateResume:
    candidate = db.scalar(
        select(Candidate).where(
            Candidate.tenant_id == tenant_id,
            Candidate.id == candidate_id,
            Candidate.deleted_at.is_(None),
        )
    )
    if not candidate:
        raise LookupError("Candidate not found")

    safe_file_name = os.path.basename(file_name) or "resume.bin"
    storage_file_name = f"{uuid4().hex}_{safe_file_name}"
    storage_key = _storage().put(
        tenant_id=tenant_id,
        candidate_id=candidate_id,
        file_name=storage_file_name,
        data=data,
        content_type=content_type,
    )

    resume = CandidateResume(
        tenant_id=tenant_id,
        candidate_id=candidate_id,
        storage_key=storage_key,
        file_name=safe_file_name,
        content_type=content_type or "application/octet-stream",
        size_bytes=len(data),
        parse_status="pending",
        uploaded_by=actor_user_id,
    )
    db.add(resume)
    db.flush()

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="resume",
        entity_id=str(resume.id),
        event_type="uploaded",
        actor_user_id=actor_user_id,
        payload={"candidate_id": candidate_id, "file_name": safe_file_name, "parse_status": "pending"},
    )

    db.commit()
    db.refresh(resume)

    enqueue_resume_processing(resume.id)

    return resume


def enqueue_resume_processing(candidate_resume_id: int) -> bool:
    if settings.env == "test":
        return False

    try:
        from app.tasks.resume_tasks import process_resume

        process_resume.apply_async(args=[candidate_resume_id], retry=False, queue="resume_ingest")
        return True
    except Exception:
        # Queue failures should not rollback persisted upload metadata.
        return False


def get_resume(
    db: Session,
    *,
    tenant_id: int,
    candidate_id: int,
    resume_id: int,
) -> CandidateResume | None:
    return db.scalar(
        select(CandidateResume).where(
            CandidateResume.tenant_id == tenant_id,
            CandidateResume.candidate_id == candidate_id,
            CandidateResume.id == resume_id,
        )
    )


def list_resumes(
    db: Session,
    *,
    tenant_id: int,
    candidate_id: int,
    page: int,
    page_size: int,
) -> tuple[list[CandidateResume], int]:
    stmt = select(CandidateResume).where(
        CandidateResume.tenant_id == tenant_id,
        CandidateResume.candidate_id == candidate_id,
    )
    count_stmt = select(func.count()).select_from(CandidateResume).where(
        CandidateResume.tenant_id == tenant_id,
        CandidateResume.candidate_id == candidate_id,
    )
    stmt = stmt.order_by(CandidateResume.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list(db.scalars(stmt).all())
    total = int(db.scalar(count_stmt) or 0)
    return items, total


def get_resume_content(
    db: Session,
    *,
    tenant_id: int,
    candidate_id: int,
    resume_id: int,
) -> tuple[CandidateResume, bytes]:
    resume = db.scalar(
        select(CandidateResume).where(
            CandidateResume.tenant_id == tenant_id,
            CandidateResume.candidate_id == candidate_id,
            CandidateResume.id == resume_id,
        )
    )
    if not resume:
        raise LookupError("Resume not found")

    try:
        data = _storage().get(storage_key=resume.storage_key)
    except Exception as exc:
        raise LookupError("Resume content not found") from exc
    if not data:
        raise LookupError("Resume content is empty")

    return resume, data


def get_resume_preview_text(
    db: Session,
    *,
    tenant_id: int,
    candidate_id: int,
    resume_id: int,
) -> tuple[CandidateResume, str]:
    resume, data = get_resume_content(
        db,
        tenant_id=tenant_id,
        candidate_id=candidate_id,
        resume_id=resume_id,
    )
    text = _extract_text(file_name=resume.file_name, content_type=resume.content_type, data=data)
    return resume, text
