from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.platform.db import Base
from app.platform.mixins import TenantMixin, TimestampMixin, SoftDeleteMixin


class Job(Base, TimestampMixin, SoftDeleteMixin, TenantMixin):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(4000), default="", nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False, index=True)
    priority: Mapped[str] = mapped_column(String(16), default="warm", nullable=False, index=True)
    intake_channel: Mapped[str] = mapped_column(String(32), default="direct_client", nullable=False)
    group_bu: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    origin_client_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("clients.id"), nullable=True)
    origin_vendor_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("vendors.id"), nullable=True)
    owner_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)


class JobApplication(Base, TimestampMixin, TenantMixin):
    __tablename__ = "job_applications"
    __table_args__ = (
        UniqueConstraint("tenant_id", "job_id", "candidate_id", name="uq_job_applications_unique"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    candidate_id: Mapped[int] = mapped_column(Integer, ForeignKey("candidates.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="applied", nullable=False, index=True)
    applied_by_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
