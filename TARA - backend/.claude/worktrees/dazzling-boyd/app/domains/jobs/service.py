from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.access.service import can_manage_or_own
from app.domains.audit.service import record_event
from app.domains.jobs.models import Job
from app.platform.time import utcnow

ALLOWED_INTAKE_CHANNELS = {"direct_client", "preferred_vendor", "marketplace"}


def create_job(
    db: Session,
    *,
    tenant_id: int,
    actor_user_id: int,
    title: str,
    description: str,
    status: str,
    intake_channel: str,
    origin_client_id: int | None,
    origin_vendor_id: int | None,
) -> Job:
    if intake_channel not in ALLOWED_INTAKE_CHANNELS:
        raise ValueError("Invalid intake channel")

    job = Job(
        tenant_id=tenant_id,
        title=title,
        description=description,
        status=status,
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
        entity_id=job.id,
        event_type="created",
        actor_user_id=actor_user_id,
        payload={"title": title, "status": status, "intake_channel": intake_channel},
    )
    db.commit()
    db.refresh(job)
    return job


def list_jobs(db: Session, *, tenant_id: int, include_deleted: bool, page: int, page_size: int) -> tuple[list[Job], int]:
    stmt = select(Job).where(Job.tenant_id == tenant_id)
    count_stmt = select(func.count()).select_from(Job).where(Job.tenant_id == tenant_id)
    if not include_deleted:
        stmt = stmt.where(Job.deleted_at.is_(None))
        count_stmt = count_stmt.where(Job.deleted_at.is_(None))
    stmt = stmt.order_by(Job.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list(db.scalars(stmt).all())
    total = int(db.scalar(count_stmt) or 0)
    return items, total


def get_job(db: Session, *, tenant_id: int, job_id: int, include_deleted: bool = False) -> Job | None:
    stmt = select(Job).where(Job.tenant_id == tenant_id, Job.id == job_id)
    if not include_deleted:
        stmt = stmt.where(Job.deleted_at.is_(None))
    return db.scalar(stmt)


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
    intake_channel: str | None,
) -> Job:
    if not can_manage_or_own(roles=roles, owner_user_id=job.owner_user_id, actor_user_id=actor_user_id):
        raise PermissionError("Not allowed to update job")

    if intake_channel is not None and intake_channel not in ALLOWED_INTAKE_CHANNELS:
        raise ValueError("Invalid intake channel")

    if title is not None:
        job.title = title
    if description is not None:
        job.description = description
    if status is not None:
        job.status = status
    if intake_channel is not None:
        job.intake_channel = intake_channel

    record_event(
        db,
        tenant_id=tenant_id,
        entity_type="job",
        entity_id=job.id,
        event_type="updated",
        actor_user_id=actor_user_id,
        payload={"title": job.title, "status": job.status},
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
        entity_id=job.id,
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
        entity_id=job.id,
        event_type="restored",
        actor_user_id=actor_user_id,
        payload={},
    )
    db.commit()
    db.refresh(job)
    return job
