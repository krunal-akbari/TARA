from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.domains.audit.schemas import ActivityEventListResponse, ActivityEventResponse
from app.domains.audit.service import list_events
from app.domains.auth.models import User
from app.platform.db import get_db
from app.platform.dependencies import get_current_user

router = APIRouter(prefix="/activity-events", tags=["Audit"])


@router.get("", response_model=ActivityEventListResponse)
def get_activity_events(
    entity_type: str | None = Query(default=None),
    entity_id: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ActivityEventListResponse:
    items, total = list_events(
        db=db,
        tenant_id=current_user.tenant_id,
        entity_type=entity_type,
        entity_id=entity_id,
        page=page,
        page_size=page_size,
    )
    return ActivityEventListResponse(
        items=[
            ActivityEventResponse(
                id=item.id,
                tenant_id=item.tenant_id,
                entity_type=item.entity_type,
                entity_id=item.entity_id,
                event_type=item.event_type,
                actor_user_id=item.actor_user_id,
                payload_json=item.payload_json,
            )
            for item in items
        ],
        total=total,
    )
