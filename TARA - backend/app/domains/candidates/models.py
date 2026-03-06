from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.platform.db import Base
from app.platform.mixins import SoftDeleteMixin, TenantMixin, TimestampMixin


class Candidate(Base, TimestampMixin, SoftDeleteMixin, TenantMixin):
    __tablename__ = "candidates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    first_name: Mapped[str] = mapped_column(String(120), nullable=False)
    last_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    normalized_email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    normalized_phone: Mapped[str | None] = mapped_column(String(32), nullable=True, index=True)
    dedupe_fingerprint: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)
    group_bu: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    current_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    hr_notes_general: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    hr_notes_status: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    hr_notes_pay: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    hr_notes_notes: Mapped[str | None] = mapped_column(String(4000), nullable=True)
    owner_user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
