from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.domains.auth.models import User
from app.domains.resumes.schemas import ResumeExtractResponse, ResumeListResponse, ResumeResponse, ResumeTextPreviewResponse
from app.domains.resumes.service import (
    create_resume,
    enqueue_resume_processing,
    extract_candidate_fields_from_resume,
    get_resume,
    get_resume_content,
    get_resume_preview_text,
    list_resumes,
)
from app.domains.tenancy.service import get_effective_resume_upload_max_bytes_for_tenant
from app.platform.db import get_db
from app.platform.dependencies import get_current_user

router = APIRouter(prefix="/candidates/{candidate_id}/resumes", tags=["Resumes"])
extract_router = APIRouter(prefix="/resumes", tags=["Resumes"])


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
    max_upload_bytes = get_effective_resume_upload_max_bytes_for_tenant(db=db, tenant_id=current_user.tenant_id)
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty upload")
    if len(body) > max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds max upload size ({max_upload_bytes} bytes)",
        )
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
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_response(resume)


@extract_router.post("/extract-preview", response_model=ResumeExtractResponse)
async def extract_resume_preview_endpoint(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResumeExtractResponse:
    max_upload_bytes = get_effective_resume_upload_max_bytes_for_tenant(db=db, tenant_id=current_user.tenant_id)
    body = await file.read()
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty upload")
    if len(body) > max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds max upload size ({max_upload_bytes} bytes)",
        )

    try:
        extracted = extract_candidate_fields_from_resume(
            file_name=file.filename or "resume.bin",
            content_type=file.content_type or "application/octet-stream",
            data=body,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return ResumeExtractResponse(**extracted)


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


@router.get("/{resume_id}/content")
def get_resume_content_endpoint(
    candidate_id: int,
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    try:
        resume, content = get_resume_content(
            db=db,
            tenant_id=current_user.tenant_id,
            candidate_id=candidate_id,
            resume_id=resume_id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    encoded_name = quote(resume.file_name)
    return Response(
        content=content,
        media_type=resume.content_type or "application/octet-stream",
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{encoded_name}"},
    )


@router.get("/{resume_id}/preview-text", response_model=ResumeTextPreviewResponse)
def get_resume_preview_text_endpoint(
    candidate_id: int,
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResumeTextPreviewResponse:
    try:
        _, text = get_resume_preview_text(
            db=db,
            tenant_id=current_user.tenant_id,
            candidate_id=candidate_id,
            resume_id=resume_id,
        )
    except LookupError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    return ResumeTextPreviewResponse(text=text)


@router.post("/{resume_id}/retry-parse", response_model=ResumeResponse)
def retry_resume_parse_endpoint(
    candidate_id: int,
    resume_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ResumeResponse:
    resume = get_resume(
        db=db,
        tenant_id=current_user.tenant_id,
        candidate_id=candidate_id,
        resume_id=resume_id,
    )
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")

    resume.parse_status = "pending"
    db.commit()
    db.refresh(resume)

    if not enqueue_resume_processing(resume.id):
        resume.parse_status = "failed"
        db.commit()
        db.refresh(resume)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Resume parse retry could not be queued",
        )

    return _to_response(resume)
