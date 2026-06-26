from celery.exceptions import SoftTimeLimitExceeded
from sqlalchemy import select

from app.domains.audit.service import record_event
from app.domains.candidates.models import Candidate
from app.domains.candidates.service import build_fingerprint, normalize_email, normalize_phone
from app.domains.resumes.models import CandidateResume
from app.domains.resumes.service import (
    ResumeParseError,
    ResumeParseTimeoutError,
    _storage,
    extract_candidate_fields_from_resume,
)
from app.platform.db import SessionLocal
from app.tasks.celery_app import celery_app


@celery_app.task(name="resume.process", soft_time_limit=60, time_limit=90)
def process_resume(candidate_resume_id: int) -> dict:
    db = SessionLocal()
    try:
        resume = db.scalar(select(CandidateResume).where(CandidateResume.id == candidate_resume_id))
        if not resume:
            return {"candidate_resume_id": candidate_resume_id, "status": "missing"}

        resume.parse_status = "processing"
        db.commit()

        content = _storage().get(storage_key=resume.storage_key)
        extracted = extract_candidate_fields_from_resume(
            file_name=resume.file_name,
            content_type=resume.content_type,
            data=content,
        )

        candidate = db.scalar(
            select(Candidate).where(
                Candidate.id == resume.candidate_id,
                Candidate.tenant_id == resume.tenant_id,
            )
        )
        candidate_updated = False
        if candidate:
            if not candidate.email and extracted.get("email"):
                candidate.email = extracted["email"]
                candidate.normalized_email = normalize_email(candidate.email)
                candidate_updated = True
            if not candidate.phone and extracted.get("phone"):
                candidate.phone = extracted["phone"]
                candidate.normalized_phone = normalize_phone(candidate.phone)
                candidate_updated = True
            if not candidate.current_company and extracted.get("current_company"):
                candidate.current_company = extracted["current_company"]
                candidate_updated = True
            if candidate_updated:
                candidate.dedupe_fingerprint = build_fingerprint(email=candidate.email, phone=candidate.phone)

        resume.parse_status = "completed"
        record_event(
            db,
            tenant_id=resume.tenant_id,
            entity_type="resume",
            entity_id=str(resume.id),
            event_type="parsed",
            actor_user_id=resume.uploaded_by,
            payload={
                "candidate_id": resume.candidate_id,
                "candidate_updated": candidate_updated,
                "extracted_fields": extracted,
            },
        )
        db.commit()
        return {
            "candidate_resume_id": candidate_resume_id,
            "status": "completed",
            "candidate_updated": candidate_updated,
        }
    except SoftTimeLimitExceeded:
        db.rollback()
        resume = db.scalar(select(CandidateResume).where(CandidateResume.id == candidate_resume_id))
        timeout_error = ResumeParseTimeoutError("Resume parsing timed out")
        if resume:
            resume.parse_status = "failed"
            record_event(
                db,
                tenant_id=resume.tenant_id,
                entity_type="resume",
                entity_id=str(resume.id),
                event_type="parse_failed",
                actor_user_id=resume.uploaded_by,
                payload={"candidate_id": resume.candidate_id, "error": str(timeout_error), "reason": "timeout"},
            )
            db.commit()
        return {"candidate_resume_id": candidate_resume_id, "status": "failed", "error": str(timeout_error)}
    except ResumeParseError as exc:
        db.rollback()
        resume = db.scalar(select(CandidateResume).where(CandidateResume.id == candidate_resume_id))
        if resume:
            resume.parse_status = "failed"
            record_event(
                db,
                tenant_id=resume.tenant_id,
                entity_type="resume",
                entity_id=str(resume.id),
                event_type="parse_failed",
                actor_user_id=resume.uploaded_by,
                payload={"candidate_id": resume.candidate_id, "error": str(exc), "reason": "input"},
            )
            db.commit()
        return {"candidate_resume_id": candidate_resume_id, "status": "failed", "error": str(exc)}
    except Exception as exc:
        db.rollback()
        resume = db.scalar(select(CandidateResume).where(CandidateResume.id == candidate_resume_id))
        if resume:
            resume.parse_status = "failed"
            record_event(
                db,
                tenant_id=resume.tenant_id,
                entity_type="resume",
                entity_id=str(resume.id),
                event_type="parse_failed",
                actor_user_id=resume.uploaded_by,
                payload={"candidate_id": resume.candidate_id, "error": str(exc)},
            )
            db.commit()
        return {"candidate_resume_id": candidate_resume_id, "status": "failed", "error": str(exc)}
    finally:
        db.close()
