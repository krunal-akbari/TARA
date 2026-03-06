from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.domains.auth.models import User
from app.domains.jobs.schemas import JobCreate, JobListResponse, JobResponse, JobUpdate
from app.domains.jobs.service import (
    create_job,
    get_job,
    list_jobs,
    restore_job,
    soft_delete_job,
    update_job,
)
from app.platform.db import get_db
from app.platform.dependencies import get_current_roles, get_current_user

router = APIRouter(prefix="/jobs", tags=["Jobs"])


def _to_response(job) -> JobResponse:
    return JobResponse(
        id=job.id,
        tenant_id=job.tenant_id,
        title=job.title,
        description=job.description,
        status=job.status,
        intake_channel=job.intake_channel,
        origin_client_id=job.origin_client_id,
        origin_vendor_id=job.origin_vendor_id,
        owner_user_id=job.owner_user_id,
        deleted_at=job.deleted_at.isoformat() if job.deleted_at else None,
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
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobListResponse:
    items, total = list_jobs(
        db=db,
        tenant_id=current_user.tenant_id,
        include_deleted=include_deleted,
        page=page,
        page_size=page_size,
    )
    return JobListResponse(items=[_to_response(item) for item in items], total=total)


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
    return _to_response(job)


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
            intake_channel=payload.intake_channel,
        )
    except (PermissionError, ValueError) as exc:
        code = status.HTTP_403_FORBIDDEN if isinstance(exc, PermissionError) else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=code, detail=str(exc)) from exc
    return _to_response(updated)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_job_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> None:
    job = get_job(db=db, tenant_id=current_user.tenant_id, job_id=job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    try:
        soft_delete_job(db=db, tenant_id=current_user.tenant_id, actor_user_id=current_user.id, roles=roles, job=job)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return None


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
