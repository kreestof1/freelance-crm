"""Modèle Company (Account)."""
from __future__ import annotations

from sqlalchemy import ARRAY, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.mixins import SoftDeleteMixin, TimestampMixin, UUIDMixin


class Company(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "companies"

    name: Mapped[str] = mapped_column(String(200), nullable=False)
    vat_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    siren: Mapped[str | None] = mapped_column(String(20), nullable=True)
    sector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size: Mapped[str | None] = mapped_column(String(50), nullable=True)  # ex. "1-10", "50-200"
    website: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    addresses: Mapped[list[dict]] = mapped_column(JSON, default=list, nullable=False)

    # Relations
    contacts: Mapped[list["Contact"]] = relationship(  # type: ignore[name-defined]  # noqa: F821
        "Contact", back_populates="company", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Company id={self.id} name={self.name!r}>"
