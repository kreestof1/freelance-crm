"""Modèle Lead (Prospect)."""
from __future__ import annotations

import uuid

from sqlalchemy import ARRAY, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin


class Lead(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "leads"

    # Champs requis (création rapide)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True, index=True)
    source: Mapped[str] = mapped_column(
        String(50), nullable=False, default="other"
    )  # web, recommandation, evenement, other

    # Qualification
    status: Mapped[str] = mapped_column(
        String(30), nullable=False, default="Nouveau"
    )  # Nouveau | Qualifié | Converti | Perdu
    interest: Mapped[str | None] = mapped_column(Text, nullable=True)
    score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)

    # Liens optionnels
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Lead id={self.id} name={self.name!r} status={self.status!r}>"
