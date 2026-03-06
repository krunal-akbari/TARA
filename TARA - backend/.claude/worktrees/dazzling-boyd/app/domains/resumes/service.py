import os
from pathlib import Path

import boto3
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.audit.service import record_event
from app.domains.candidates.models import Candidate
from app.domains.resumes.models import CandidateResume
from app.platform.settings import get_settings
from app.tasks.resume_tasks import process_resume

settings = get_settings()


class StorageAdapter:
    def put(self, *, tenant_id: int, candidate_id: int, file_name: str, data: bytes, content_type: str) -> str:
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


def _storage() -> StorageAdapter:
    if settings.storage_backend.lower() == "s3":
        return S3StorageAdapter()
    return LocalStorageAdapter()


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
        raise ValueError("Candidate not found")

    safe_file_name = os.path.basename(file_name) or "resume.bin"
    storage_key = _storage().put(
        tenant_id=tenant_id,
        candidate_id=candidate_id,
        file_name=safe_file_name,
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
        entity_id=resume.id,
        event_type="uploaded",
        actor_user_id=actor_user_id,
        payload={"candidate_id": candidate_id, "file_name": safe_file_name, "parse_status": "pending"},
    )

    db.commit()
    db.refresh(resume)

    try:
        process_resume.delay(resume.id)
    except Exception:
        # Queue failures should not rollback persisted upload metadata.
        pass

    return resume


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
