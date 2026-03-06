from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.domains.audit.models import ActivityEvent


def record_event(
    db: Session,
    *,
    tenant_id: int,
    entity_type: str,
    entity_id: int,
    event_type: str,
    actor_user_id: int,
    payload: dict,
) -> None:
    event = ActivityEvent(
        tenant_id=tenant_id,
        entity_type=entity_type,
        entity_id=entity_id,
        event_type=event_type,
        actor_user_id=actor_user_id,
        payload_json=payload,
    )
    db.add(event)


def list_events(
    db: Session,
    *,
    tenant_id: int,
    entity_type: str | None,
    entity_id: int | None,
    page: int,
    page_size: int,
) -> tuple[list[ActivityEvent], int]:
    stmt = select(ActivityEvent).where(ActivityEvent.tenant_id == tenant_id)
    count_stmt = select(func.count()).select_from(ActivityEvent).where(ActivityEvent.tenant_id == tenant_id)

    if entity_type:
        stmt = stmt.where(ActivityEvent.entity_type == entity_type)
        count_stmt = count_stmt.where(ActivityEvent.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(ActivityEvent.entity_id == entity_id)
        count_stmt = count_stmt.where(ActivityEvent.entity_id == entity_id)

    stmt = stmt.order_by(ActivityEvent.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list(db.scalars(stmt).all())
    total = db.scalar(count_stmt) or 0
    return items, int(total)
