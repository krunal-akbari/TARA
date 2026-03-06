from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.platform.db import Base
from app.platform.mixins import SoftDeleteMixin, TenantMixin, TimestampMixin


class Client(Base, TimestampMixin, SoftDeleteMixin, TenantMixin):
    __tablename__ = "clients"
    __table_args__ = (
        Index("ix_clients_tenant_status", "tenant_id", "status"),
        Index("ix_clients_deleted_at", "deleted_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    owner_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
