"""Modèle Document."""
from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin


class Document(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "documents"

    type: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # Brief | Proposition | Contrat | Autre
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_uri: Mapped[str | None] = mapped_column(String(2000), nullable=True)  # Blob path
    external_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)  # GDrive/OneDrive
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Entité liée
    related_type: Mapped[str | None] = mapped_column(String(30), nullable=True)  # deal | project
    related_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<Document id={self.id} filename={self.filename!r}>"
