from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.domains.auth.models import User
from app.domains.resumes.schemas import ResumeListResponse, ResumeResponse
from app.domains.resumes.service import create_resume, list_resumes
from app.platform.db import get_db
from app.platform.dependencies import get_current_user

router = APIRouter(prefix="/candidates/{candidate_id}/resumes", tags=["Resumes"])


def _to_response(resume) -> ResumeResponse:
    return ResumeResponse(
        id=resume.id,
        tenant_id=resume.tenant_id,
        candidate_id=resume.candidate_id,
        storage_key=resume.storage_key,
        file_name=resume.file_name,
        content_type=resume.content_type,
        size_bytes=resume.size_bytes,
        parse_status=resume.parse_status,
        uploaded_by=resume.uploaded_by,
        created_at=resume.created_at,
    )


@router.post("", response_model=ResumeResponse, status_code=status.HTTP_201_CREATED)
async def upload_resume_endpoint(
    candidate_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResumeResponse:
    body = await file.read()
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty upload")
    try:
        resume = create_resume(
            db=db,
            tenant_id=current_user.tenant_id,
            candidate_id=candidate_id,
            actor_user_id=current_user.id,
            file_name=file.filename or "resume.bin",
            content_type=file.content_type or "application/octet-stream",
            data=body,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_response(resume)


@router.get("", response_model=ResumeListResponse)
def list_resumes_endpoint(
    candidate_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResumeListResponse:
    items, total = list_resumes(
        db=db,
        tenant_id=current_user.tenant_id,
        candidate_id=candidate_id,
        page=page,
        page_size=page_size,
    )
    return ResumeListResponse(items=[_to_response(item) for item in items], total=total)
