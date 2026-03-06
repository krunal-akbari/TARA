from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.domains.auth.models import User
from app.domains.candidates.schemas import (
    CandidateCreate,
    CandidateListResponse,
    CandidateResponse,
    CandidateUpdate,
    DedupeCheckResponse,
)
from app.domains.candidates.service import (
    create_candidate,
    dedupe_matches,
    get_candidate,
    list_candidates,
    restore_candidate,
    soft_delete_candidate,
    update_candidate,
)
from app.platform.db import get_db
from app.platform.dependencies import get_current_roles, get_current_user

router = APIRouter(prefix="/candidates", tags=["Candidates"])


def _to_response(candidate) -> CandidateResponse:
    return CandidateResponse(
        id=candidate.id,
        tenant_id=candidate.tenant_id,
        first_name=candidate.first_name,
        last_name=candidate.last_name,
        email=candidate.email,
        phone=candidate.phone,
        current_company=candidate.current_company,
        status=candidate.status,
        owner_user_id=candidate.owner_user_id,
        dedupe_fingerprint=candidate.dedupe_fingerprint,
        deleted_at=candidate.deleted_at.isoformat() if candidate.deleted_at else None,
    )


@router.post("", response_model=CandidateResponse, status_code=status.HTTP_201_CREATED)
def create_candidate_endpoint(
    payload: CandidateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CandidateResponse:
    candidate = create_candidate(
        db=db,
        tenant_id=current_user.tenant_id,
        actor_user_id=current_user.id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=str(payload.email) if payload.email else None,
        phone=payload.phone,
        current_company=payload.current_company,
    )
    return _to_response(candidate)


@router.get("", response_model=CandidateListResponse)
def list_candidates_endpoint(
    include_deleted: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CandidateListResponse:
    items, total = list_candidates(
        db=db,
        tenant_id=current_user.tenant_id,
        include_deleted=include_deleted,
        page=page,
        page_size=page_size,
    )
    return CandidateListResponse(items=[_to_response(item) for item in items], total=total)


@router.get("/{candidate_id}", response_model=CandidateResponse)
def get_candidate_endpoint(
    candidate_id: int,
    include_deleted: bool = Query(default=False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CandidateResponse:
    candidate = get_candidate(
        db=db,
        tenant_id=current_user.tenant_id,
        candidate_id=candidate_id,
        include_deleted=include_deleted,
    )
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    return _to_response(candidate)


@router.patch("/{candidate_id}", response_model=CandidateResponse)
def update_candidate_endpoint(
    candidate_id: int,
    payload: CandidateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> CandidateResponse:
    candidate = get_candidate(db=db, tenant_id=current_user.tenant_id, candidate_id=candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    try:
        updated = update_candidate(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            roles=roles,
            candidate=candidate,
            first_name=payload.first_name,
            last_name=payload.last_name,
            email=str(payload.email) if payload.email else None,
            phone=payload.phone,
            current_company=payload.current_company,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return _to_response(updated)


@router.delete("/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_candidate_endpoint(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> None:
    candidate = get_candidate(db=db, tenant_id=current_user.tenant_id, candidate_id=candidate_id)
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    try:
        soft_delete_candidate(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            roles=roles,
            candidate=candidate,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return None


@router.post("/{candidate_id}/restore", response_model=CandidateResponse)
def restore_candidate_endpoint(
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    roles: list[str] = Depends(get_current_roles),
) -> CandidateResponse:
    candidate = get_candidate(
        db=db,
        tenant_id=current_user.tenant_id,
        candidate_id=candidate_id,
        include_deleted=True,
    )
    if not candidate:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
    try:
        restored = restore_candidate(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            roles=roles,
            candidate=candidate,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return _to_response(restored)


@router.get("/{candidate_id}/dedupe-check", response_model=DedupeCheckResponse)
def dedupe_check_endpoint(
    candidate_id: int,
    email: str | None = Query(default=None),
    phone: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DedupeCheckResponse:
    matches = dedupe_matches(
        db=db,
        tenant_id=current_user.tenant_id,
        email=email,
        phone=phone,
        exclude_candidate_id=candidate_id,
    )
    return DedupeCheckResponse(matches=[_to_response(match) for match in matches], total_matches=len(matches))
