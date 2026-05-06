from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.domains.auth.models import User
from app.domains.jobs.schemas import (
    CandidateJobApplicationListResponse,
    CandidateJobApplicationResponse,
    JobApplicationCreate,
    JobApplicationListResponse,
    JobApplicationResponse,
    JobApplicationUpdate,
    JobCreate,
    JobListResponse,
    JobResponse,
    JobUpdate,
)
from app.domains.jobs.service import (
    apply_candidate_to_job,
    create_job,
    get_job,
    get_job_application_counts,
    list_candidate_job_applications,
    list_job_applications,
    list_jobs,
    restore_job,
    update_job,
    update_job_application_status,
)
from app.platform.db import get_db
from app.platform.dependencies import get_current_roles, get_current_user

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def _to_response(job, *, applications_count: int = 0) -> JobResponse:
    return JobResponse(
        id=job.id,
        tenant_id=job.tenant_id,
        title=job.title,
        description=job.description,
        status=job.status,
        priority=job.priority,
        intake_channel=job.intake_channel,
        origin_client_id=job.origin_client_id,
        origin_vendor_id=job.origin_vendor_id,
        owner_user_id=job.owner_user_id,
        applications_count=applications_count,
        deleted_at=job.deleted_at.isoformat() if job.deleted_at else None,
    )


def _to_application_response(application, candidate) -> JobApplicationResponse:
    full_name = f"{candidate.first_name} {candidate.last_name}".strip()
    candidate_name = full_name if full_name else f"Candidate {candidate.id}"
    return JobApplicationResponse(
        id=application.id,
        tenant_id=application.tenant_id,
        job_id=application.job_id,
        candidate_id=application.candidate_id,
        candidate_name=candidate_name,
        status=application.status,
        applied_by_user_id=application.applied_by_user_id,
        created_at=application.created_at,
    )


def _to_candidate_application_response(application, job) -> CandidateJobApplicationResponse:
    return CandidateJobApplicationResponse(
        id=application.id,
        tenant_id=application.tenant_id,
        job_id=application.job_id,
        job_title=job.title,
        candidate_id=application.candidate_id,
        status=application.status,
        applied_by_user_id=application.applied_by_user_id,
        created_at=application.created_at,
    )


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
def create_job_endpoint(
    payload: JobCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobResponse:
    try:
        job = create_job(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            title=payload.title,
            description=payload.description,
            status=payload.status,
            priority=payload.priority,
            intake_channel=payload.intake_channel,
            origin_client_id=payload.origin_client_id,
            origin_vendor_id=payload.origin_vendor_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_response(job)


@router.get("", response_model=JobListResponse)
def list_jobs_endpoint(
    include_deleted: bool = Query(default=False),
    search: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobListResponse:
    items, total = list_jobs(
        db=db,
        tenant_id=current_user.tenant_id,
        include_deleted=include_deleted,
        search=search,
        page=page,
        page_size=page_size,
    )
    counts = get_job_application_counts(
        db=db,
        tenant_id=current_user.tenant_id,
        job_ids=[item.id for item in items],
    )
    return JobListResponse(items=[_to_response(item, applications_count=counts.get(item.id, 0)) for item in items], total=total)


@router.post("/{job_id}/applications", response_model=JobApplicationResponse, status_code=status.HTTP_201_CREATED)
def apply_candidate_to_job_endpoint(
    job_id: int,
    payload: JobApplicationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobApplicationResponse:
    try:
        application, candidate = apply_candidate_to_job(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            job_id=job_id,
            candidate_id=payload.candidate_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_application_response(application, candidate)


@router.get("/{job_id}/applications", response_model=JobApplicationListResponse)
def list_job_applications_endpoint(
    job_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobApplicationListResponse:
    rows, total = list_job_applications(
        db=db,
        tenant_id=current_user.tenant_id,
        job_id=job_id,
        page=page,
        page_size=page_size,
    )
    return JobApplicationListResponse(
        items=[_to_application_response(application, candidate) for application, candidate in rows],
        total=total,
    )


@router.patch("/{job_id}/applications/{application_id}", response_model=JobApplicationResponse)
def update_job_application_endpoint(
    job_id: int,
    application_id: int,
    payload: JobApplicationUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobApplicationResponse:
    try:
        application, candidate = update_job_application_status(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            job_id=job_id,
            application_id=application_id,
            status=payload.status,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_application_response(application, candidate)


@router.get("/candidate/{candidate_id}/applications", response_model=CandidateJobApplicationListResponse)
def list_candidate_job_applications_endpoint(
    candidate_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CandidateJobApplicationListResponse:
    rows, total = list_candidate_job_applications(
        db=db,
        tenant_id=current_user.tenant_id,
        candidate_id=candidate_id,
        page=page,
        page_size=page_size,
    )
    return CandidateJobApplicationListResponse(
        items=[_to_candidate_application_response(application, job) for application, job in rows],
        total=total,
    )


@router.get("/{job_id}", response_model=JobResponse)
def get_job_endpoint(
    job_id: int,
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobResponse:
    job = get_job(db=db, tenant_id=current_user.tenant_id, job_id=job_id, include_deleted=include_deleted)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    counts = get_job_application_counts(db=db, tenant_id=current_user.tenant_id, job_ids=[job.id])
    return _to_response(job, applications_count=counts.get(job.id, 0))


@router.patch("/{job_id}", response_model=JobResponse)
def update_job_endpoint(
    job_id: int,
    payload: JobUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> JobResponse:
    job = get_job(db=db, tenant_id=current_user.tenant_id, job_id=job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    try:
        updated = update_job(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            roles=roles,
            job=job,
            title=payload.title,
            description=payload.description,
            status=payload.status,
            priority=payload.priority,
            intake_channel=payload.intake_channel,
        )
    except (PermissionError, ValueError) as exc:
        code = status.HTTP_403_FORBIDDEN if isinstance(exc, PermissionError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(exc)) from exc
    return _to_response(updated)


@router.delete("/{job_id}", status_code=status.HTTP_405_METHOD_NOT_ALLOWED)
def delete_job_endpoint(
    job_id: int,
    _: User = Depends(get_current_user),
) -> None:
    _ = job_id
    raise HTTPException(status_code=status.HTTP_405_METHOD_NOT_ALLOWED, detail="Deletion is disabled")


@router.post("/{job_id}/restore", response_model=JobResponse)
def restore_job_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> JobResponse:
    job = get_job(db=db, tenant_id=current_user.tenant_id, job_id=job_id, include_deleted=True)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    try:
        restored = restore_job(db=db, tenant_id=current_user.tenant_id, actor_user_id=current_user.id, roles=roles, job=job)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return _to_response(restored)
