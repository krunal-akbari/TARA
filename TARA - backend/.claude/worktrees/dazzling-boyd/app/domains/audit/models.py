from sqlalchemy import ForeignKey, Index, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.platform.db import Base
from app.platform.mixins import AuditTimestampMixin, TenantMixin


class ActivityEvent(Base, AuditTimestampMixin, TenantMixin):
    __tablename__ = "activity_events"
    __table_args__ = (
        Index("ix_activity_events_tenant_entity", "tenant_id", "entity_type", "entity_id"),
        Index("ix_activity_events_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    event_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    actor_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
