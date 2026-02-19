"""Modèle Deal (Opportunité)."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import ARRAY, Date, ForeignKey, Numeric, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin


class Deal(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "deals"

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="EUR", nullable=False)
    probability: Mapped[int] = mapped_column(default=0, nullable=False)  # 0-100 %
    stage: Mapped[str] = mapped_column(String(50), nullable=False, default="Découverte", index=True)
    expected_close: Mapped[date | None] = mapped_column(Date, nullable=True, index=True)
    origin: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)

    # Locked when Won
    is_locked: Mapped[bool] = mapped_column(default=False, nullable=False)

    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True, index=True
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )

    @property
    def weighted_amount(self) -> Decimal:
        return self.amount * self.probability / 100

    def __repr__(self) -> str:
        return f"<Deal id={self.id} title={self.title!r} stage={self.stage!r}>"
