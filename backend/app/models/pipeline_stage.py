"""Modèle PipelineStage — étapes configurables du pipeline commercial."""
from __future__ import annotations

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.models.mixins import TimestampMixin, UUIDMixin

# Étapes par défaut (seed)
DEFAULT_STAGES = [
    {"name": "Découverte",   "order": 1, "default_probability": 10,  "is_closed": False, "is_won": False, "color": "#90CAF9"},
    {"name": "Qualification","order": 2, "default_probability": 25,  "is_closed": False, "is_won": False, "color": "#81D4FA"},
    {"name": "Proposition",  "order": 3, "default_probability": 50,  "is_closed": False, "is_won": False, "color": "#FFE082"},
    {"name": "Négociation",  "order": 4, "default_probability": 75,  "is_closed": False, "is_won": False, "color": "#FFCC02"},
    {"name": "Gagné",        "order": 5, "default_probability": 100, "is_closed": True,  "is_won": True,  "color": "#A5D6A7"},
    {"name": "Perdu",        "order": 6, "default_probability": 0,   "is_closed": True,  "is_won": False, "color": "#EF9A9A"},
]


class PipelineStage(Base, UUIDMixin, TimestampMixin):
    """Étape configurable du pipeline commercial."""

    __tablename__ = "pipeline_stages"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    order: Mapped[int] = mapped_column(nullable=False, default=0)
    default_probability: Mapped[int] = mapped_column(nullable=False, default=0)  # 0–100
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_won: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    def __repr__(self) -> str:
        return f"<PipelineStage order={self.order} name={self.name!r}>"
