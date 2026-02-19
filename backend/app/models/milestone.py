"""Modèle Milestone (Jalon de mission)."""
from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import TimestampMixin, UUIDMixin


class Milestone(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "milestones"

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="Pending"
    )  # Pending | Done | Delayed

    project: Mapped["Project"] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Project", back_populates="milestones"
    )

    def __repr__(self) -> str:
        return f"<Milestone id={self.id} name={self.name!r} status={self.status!r}>"
