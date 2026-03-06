from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.platform.db import Base
from app.platform.mixins import TenantMixin, TimestampMixin


class JobRoute(Base, TimestampMixin, TenantMixin):
    __tablename__ = "job_routes"
    __table_args__ = (UniqueConstraint("tenant_id", "job_id", name="uq_job_routes_tenant_job"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    current_node_type: Mapped[str] = mapped_column(String(32), nullable=False)
    current_node_id: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    last_transition_seq: Mapped[int] = mapped_column(default=0, nullable=False)


class JobRouteTransition(Base, TenantMixin):
    __tablename__ = "job_route_transitions"
    __table_args__ = (
        UniqueConstraint("tenant_id", "job_id", "sequence_no", name="uq_route_transition_seq"),
        UniqueConstraint("tenant_id", "job_id", "idempotency_key", name="uq_route_transition_idempotency"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    sequence_no: Mapped[int] = mapped_column(nullable=False)

    from_node_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    from_node_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    to_node_type: Mapped[str] = mapped_column(String(32), nullable=False)
    to_node_id: Mapped[int] = mapped_column(Integer, nullable=False)

    reason: Mapped[str] = mapped_column(String(64), nullable=False)
    notes: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    actor_user_id: Mapped[int] = mapped_column(Integer, nullable=False)
    idempotency_key: Mapped[str | None] = mapped_column(String(128), nullable=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
