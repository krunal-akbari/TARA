from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.platform.db import Base
from app.platform.mixins import TenantMixin, TimestampMixin


class CandidateResume(Base, TimestampMixin, TenantMixin):
    __tablename__ = "candidate_resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(Integer, ForeignKey("candidates.id"), nullable=False, index=True)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(nullable=False)
    parse_status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    uploaded_by: Mapped[int] = mapped_column(Integer, nullable=False)
