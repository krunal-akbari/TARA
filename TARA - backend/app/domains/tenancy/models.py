from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.platform.db import Base
from app.platform.mixins import SoftDeleteMixin, TimestampMixin


class Tenant(Base, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)

    currency_code: Mapped[str] = mapped_column(String(8), default="USD", nullable=False)
    timezone: Mapped[str] = mapped_column(String(64), default="UTC", nullable=False)

    resume_retention_days: Mapped[int] = mapped_column(default=365, nullable=False)
    audit_retention_days: Mapped[int] = mapped_column(default=730, nullable=False)
    resume_upload_max_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)
