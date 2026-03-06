from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.platform.db import Base
from app.platform.mixins import SoftDeleteMixin, TenantMixin, TimestampMixin


class Candidate(Base, TimestampMixin, SoftDeleteMixin, TenantMixin):
    __tablename__ = "candidates"
    __table_args__ = (
        Index("ix_candidates_deleted_at", "deleted_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    first_name: Mapped[str] = mapped_column(String(128), nullable=False)
    last_name: Mapped[str] = mapped_column(String(128), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    normalized_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    normalized_phone: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    dedupe_fingerprint: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)
    current_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    owner_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
