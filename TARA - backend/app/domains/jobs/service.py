from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.access.service import can_manage_or_own
from app.domains.audit.service import record_event
from app.domains.candidates.models import Candidate
from app.domains.jobs.models import Job
from app.domains.jobs.models import JobApplication
from app.platform.time import utcnow

ALLOWED_INTAKE_CHANNELS = {"direct_client", "preferred_vendor", "marketplace"}
ALLOWED_PRIORITIES = {"hot", "warm", "cold", "warn"}


def _normalize_priority(priority: str) -> str:
    normalized = priority.strip().lower()
    # Keep backward compatibility for accidental "warn" value.
    if normalized == "warn":
        return "warm"
    if normalized not in ALLOWED_PRIORITIES:
        raise ValueError("Invalid priority")
    return normalized


def create_job(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    title: str,
    description: str,
    status: str,
    priority: str,
    intake_channel: str,
    origin_client_id: int | None,
    origin_vendor_id: int | None,
) -> Job:
    if intake_channel not in ALLOWED_INTAKE_CHANNELS:
        raise ValueError("Invalid intake channel")
    normalized_priority = _normalize_priority(priority)

    job = Job(
        tenant_id=tenant_id,
        title=title,
        description=description,
        status=status,
        priority=normalized_priority,
        intake_channel=intake_channel,
        origin_client_id=origin_client_id,
        origin_vendor_id=origin_vendor_id,
        owner_user_id=actor_user_id,
    )
    db.add(job)
    db.flush()
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="job",
        entity_id=str(job.id),
        event_type="created",
        actor_user_id=actor_user_id,
        payload={"title": title, "status": status, "priority": normalized_priority, "intake_channel": intake_channel},
    )
    db.commit()
    db.refresh(job)
    return job


def list_jobs(
    db: Session,
    *,
    tenant_id: int,
    include_deleted: bool,
    page: int,
    page_size: int,
    search: str | None = None,
) -> tuple[list[Job], int]:
    stmt = select(Job).where(Job.tenant_id == tenant_id)
    count_stmt = select(func.count()).select_from(Job).where(Job.tenant_id == tenant_id)
    if not include_deleted:
        stmt = stmt.where(Job.deleted_at.is_(None))
        count_stmt = count_stmt.where(Job.deleted_at.is_(None))
    if search:
        normalized_search = search.strip().lower()
        if normalized_search:
            pattern = f"%{normalized_search}%"
            stmt = stmt.where(func.lower(Job.title).like(pattern))
            count_stmt = count_stmt.where(func.lower(Job.title).like(pattern))
    stmt = stmt.order_by(Job.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list(db.scalars(stmt).all())
    total = int(db.scalar(count_stmt) or 0)
    return items, total


def get_job(db: Session, *, tenant_id: int, job_id: int, include_deleted: bool = False) -> Job | None:
    stmt = select(Job).where(Job.tenant_id == tenant_id, Job.id == job_id)
    if not include_deleted:
        stmt = stmt.where(Job.deleted_at.is_(None))
    return db.scalar(stmt)


def get_job_application_counts(
    db: Session,
    *,
    tenant_id: int,
    job_ids: list[int],
) -> dict[int, int]:
    normalized_job_ids = [job_id for job_id in job_ids if isinstance(job_id, int)]
    if not normalized_job_ids:
        return {}

    stmt = (
        select(JobApplication.job_id, func.count(JobApplication.id))
        .where(JobApplication.tenant_id == tenant_id, JobApplication.job_id.in_(normalized_job_ids))
        .group_by(JobApplication.job_id)
    )
    rows = list(db.execute(stmt).all())
    return {int(job_id): int(total) for job_id, total in rows}


def update_job(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    roles: list[str],
    job: Job,
    title: str | None,
    description: str | None,
    status: str | None,
    priority: str | None,
    intake_channel: str | None,
) -> Job:
    if not can_manage_or_own(roles=roles, owner_user_id=job.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to update job")

    if intake_channel is not None and intake_channel not in ALLOWED_INTAKE_CHANNELS:
        raise ValueError("Invalid intake channel")
    normalized_priority = _normalize_priority(priority) if priority is not None else None

    if title is not None:
        job.title = title
    if description is not None:
        job.description = description
    if status is not None:
        job.status = status
    if normalized_priority is not None:
        job.priority = normalized_priority
    if intake_channel is not None:
        job.intake_channel = intake_channel

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="job",
        entity_id=str(job.id),
        event_type="updated",
        actor_user_id=actor_user_id,
        payload={"title": job.title, "status": job.status, "priority": job.priority},
    )
    db.commit()
    db.refresh(job)
    return job


def soft_delete_job(db: Session, *, tenant_id: int, actor_user_id: int, roles: list[str], job: Job) -> None:
    if not can_manage_or_own(roles=roles, owner_user_id=job.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to delete job")
    job.deleted_at = utcnow()
    job.deleted_by = actor_user_id
    job.status = "closed"
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="job",
        entity_id=str(job.id),
        event_type="deleted",
        actor_user_id=actor_user_id,
        payload={},
    )
    db.commit()


def restore_job(db: Session, *, tenant_id: int, actor_user_id: int, roles: list[str], job: Job) -> Job:
    if not can_manage_or_own(roles=roles, owner_user_id=job.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to restore job")
    job.deleted_at = None
    job.deleted_by = None
    if job.status == "closed":
        job.status = "draft"
    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="job",
        entity_id=str(job.id),
        event_type="restored",
        actor_user_id=actor_user_id,
        payload={},
    )
    db.commit()
    db.refresh(job)
    return job


def apply_candidate_to_job(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    job_id: int,
    candidate_id: int,
) -> tuple[JobApplication, Candidate]:
    job = db.scalar(select(Job).where(Job.tenant_id == tenant_id, Job.id == job_id, Job.deleted_at.is_(None)))
    if not job:
        raise ValueError("Job not found")

    candidate = db.scalar(
        select(Candidate).where(
            Candidate.tenant_id == tenant_id,
            Candidate.id == candidate_id,
            Candidate.deleted_at.is_(None),
        )
    )
    if not candidate:
        raise ValueError("Candidate not found")

    existing = db.scalar(
        select(JobApplication).where(
            JobApplication.tenant_id == tenant_id,
            JobApplication.job_id == job_id,
            JobApplication.candidate_id == candidate_id,
        )
    )
    if existing:
        return existing, candidate

    application = JobApplication(
        tenant_id=tenant_id,
        job_id=job_id,
        candidate_id=candidate_id,
        status="applied",
        applied_by_user_id=actor_user_id,
    )
    db.add(application)
    db.flush()

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="job_application",
        entity_id=str(application.id),
        event_type="created",
        actor_user_id=actor_user_id,
        payload={"job_id": job_id, "candidate_id": candidate_id, "status": "applied"},
    )
    db.commit()
    db.refresh(application)
    return application, candidate


def list_job_applications(
    db: Session,
    *,
    tenant_id: int,
    job_id: int,
    page: int,
    page_size: int,
) -> tuple[list[tuple[JobApplication, Candidate]], int]:
    base_where = [
        JobApplication.tenant_id == tenant_id,
        JobApplication.job_id == job_id,
        Candidate.tenant_id == tenant_id,
        Candidate.id == JobApplication.candidate_id,
        Candidate.deleted_at.is_(None),
    ]

    count_stmt = (
        select(func.count())
        .select_from(JobApplication)
        .join(Candidate, Candidate.id == JobApplication.candidate_id)
        .where(*base_where)
    )
    total = int(db.scalar(count_stmt) or 0)

    stmt = (
        select(JobApplication, Candidate)
        .join(Candidate, Candidate.id == JobApplication.candidate_id)
        .where(*base_where)
        .order_by(JobApplication.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = list(db.execute(stmt).all())
    return rows, total


def update_job_application_status(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    job_id: int,
    application_id: int,
    status: str,
) -> tuple[JobApplication, Candidate]:
    normalized_status = status.strip().lower()
    if not normalized_status:
        raise ValueError("Status is required")

    row = db.execute(
        select(JobApplication, Candidate)
        .join(Candidate, Candidate.id == JobApplication.candidate_id)
        .where(
            JobApplication.tenant_id == tenant_id,
            JobApplication.id == application_id,
            JobApplication.job_id == job_id,
            Candidate.tenant_id == tenant_id,
            Candidate.deleted_at.is_(None),
        )
    ).first()
    if not row:
        raise ValueError("Job application not found")

    application, candidate = row
    application.status = normalized_status

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="job_application",
        entity_id=str(application.id),
        event_type="updated",
        actor_user_id=actor_user_id,
        payload={"job_id": application.job_id, "candidate_id": application.candidate_id, "status": normalized_status},
    )
    db.commit()
    db.refresh(application)
    return application, candidate


def list_candidate_job_applications(
    db: Session,
    *,
    tenant_id: int,
    candidate_id: int,
    page: int,
    page_size: int,
) -> tuple[list[tuple[JobApplication, Job]], int]:
    base_where = [
        JobApplication.tenant_id == tenant_id,
        JobApplication.candidate_id == candidate_id,
        Job.tenant_id == tenant_id,
        Job.id == JobApplication.job_id,
        Job.deleted_at.is_(None),
    ]

    count_stmt = (
        select(func.count())
        .select_from(JobApplication)
        .join(Job, Job.id == JobApplication.job_id)
        .where(*base_where)
    )
    total = int(db.scalar(count_stmt) or 0)

    stmt = (
        select(JobApplication, Job)
        .join(Job, Job.id == JobApplication.job_id)
        .where(*base_where)
        .order_by(JobApplication.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = list(db.execute(stmt).all())
    return rows, total
