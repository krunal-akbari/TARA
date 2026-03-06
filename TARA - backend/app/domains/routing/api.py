from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.domains.auth.models import User
from app.domains.routing.schemas import (
    CurrentRouteResponse,
    RouteTransitionCreate,
    RouteTransitionListResponse,
    RouteTransitionResponse,
)
from app.domains.routing.service import create_route_transition, get_current_route, list_transitions
from app.platform.db import get_db
from app.platform.dependencies import get_current_user

router = APIRouter(prefix="/jobs/{job_id}", tags=["Routing"])


def _to_transition_response(item) -> RouteTransitionResponse:
    return RouteTransitionResponse(
        id=item.id,
        tenant_id=item.tenant_id,
        job_id=item.job_id,
        sequence_no=item.sequence_no,
        from_node_type=item.from_node_type,
        from_node_id=item.from_node_id,
        to_node_type=item.to_node_type,
        to_node_id=item.to_node_id,
        reason=item.reason,
        notes=item.notes,
        actor_user_id=item.actor_user_id,
        occurred_at=item.occurred_at,
    )


@router.post("/route-transitions", response_model=RouteTransitionResponse, status_code=status.HTTP_201_CREATED)
def create_route_transition_endpoint(
    job_id: int,
    payload: RouteTransitionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
) -> RouteTransitionResponse:
    try:
        transition = create_route_transition(
            db=db,
            tenant_id=current_user.tenant_id,
            actor_user_id=current_user.id,
            job_id=job_id,
            to_node_type=payload.to_node_type,
            to_node_id=payload.to_node_id,
            reason=payload.reason,
            notes=payload.notes,
            idempotency_key=idempotency_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return _to_transition_response(transition)


@router.get("/route-transitions", response_model=RouteTransitionListResponse)
def list_route_transitions_endpoint(
    job_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RouteTransitionListResponse:
    items, total = list_transitions(
        db=db,
        tenant_id=current_user.tenant_id,
        job_id=job_id,
        page=page,
        page_size=page_size,
    )
    return RouteTransitionListResponse(items=[_to_transition_response(item) for item in items], total=total)


@router.get("/current-route", response_model=CurrentRouteResponse)
def current_route_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CurrentRouteResponse:
    route = get_current_route(db=db, tenant_id=current_user.tenant_id, job_id=job_id)
    if not route:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")
    return CurrentRouteResponse(
        job_id=route.job_id,
        current_node_type=route.current_node_type,
        current_node_id=route.current_node_id,
        status=route.status,
        last_transition_seq=route.last_transition_seq,
        updated_at=route.updated_at,
    )
