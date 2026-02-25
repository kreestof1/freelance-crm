"""Schémas Pydantic — Deals (Opportunités)."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

DealStage = Literal[
    "Découverte", "Qualification", "Proposition", "Négociation", "Gagné", "Perdu"
]


class DealCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    amount: Decimal = Field(default=Decimal("0"), ge=0)
    currency: str = Field(default="EUR", max_length=3)
    probability: int = Field(default=0, ge=0, le=100)
    stage: str = Field(default="Découverte", max_length=50)
    expected_close: date | None = None
    origin: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=10000)
    tags: list[str] = Field(default_factory=list)
    company_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None


class DealPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    amount: Decimal | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, max_length=3)
    probability: int | None = Field(default=None, ge=0, le=100)
    stage: str | None = Field(default=None, max_length=50)
    expected_close: date | None = None
    origin: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=10000)
    tags: list[str] | None = None
    company_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None


class DealMove(BaseModel):
    """Déplacer un deal vers un nouveau stage (kanban)."""
    stage: str = Field(min_length=1, max_length=50)


class DealOut(BaseModel):
    id: uuid.UUID
    title: str
    amount: Decimal
    currency: str
    probability: int
    stage: str
    expected_close: date | None
    origin: str | None
    notes: str | None
    tags: list[str]
    is_locked: bool
    weighted_amount: Decimal
    company_id: uuid.UUID | None
    contact_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    # Champs enrichis (join)
    company_name: str | None = None
    contact_name: str | None = None
    has_project: bool = False

    model_config = {"from_attributes": True}


class DealList(BaseModel):
    items: list[DealOut]
    total: int
    page: int
    page_size: int
