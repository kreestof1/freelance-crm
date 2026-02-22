"""Schémas Pydantic — Projects (Missions) & Milestones (Jalons)."""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

ProjectStatus = Literal["Planifié", "En cours", "Suspendu", "Clôturé"]
MilestoneStatus = Literal["Pending", "Done", "Delayed"]
RateType = Literal["tjm", "forfait"]


# ── Milestone ──────────────────────────────────────────────────────────────────

class MilestoneCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    due_date: date | None = None
    amount: Decimal | None = Field(default=None, ge=0)
    status: MilestoneStatus = "Pending"


class MilestonePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    due_date: date | None = None
    amount: Decimal | None = Field(default=None, ge=0)
    status: MilestoneStatus | None = None


class MilestoneOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    due_date: date | None
    amount: Decimal | None
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Project ────────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    status: ProjectStatus = "Planifié"
    start_date: date | None = None
    end_date: date | None = None
    rate_type: RateType = "tjm"
    rate_value: Decimal = Field(default=Decimal("0"), ge=0)
    budget_days: Decimal | None = Field(default=None, ge=0)
    budget_amount: Decimal | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=10000)
    company_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None
    deal_id: uuid.UUID | None = None


class ProjectPatch(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    status: ProjectStatus | None = None
    start_date: date | None = None
    end_date: date | None = None
    rate_type: RateType | None = None
    rate_value: Decimal | None = Field(default=None, ge=0)
    budget_days: Decimal | None = Field(default=None, ge=0)
    budget_amount: Decimal | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=10000)
    company_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None


class ProjectOut(BaseModel):
    id: uuid.UUID
    title: str
    status: str
    start_date: date | None
    end_date: date | None
    rate_type: str
    rate_value: Decimal
    budget_days: Decimal | None
    budget_amount: Decimal | None
    notes: str | None
    company_id: uuid.UUID | None
    contact_id: uuid.UUID | None
    deal_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    milestones: list[MilestoneOut] = Field(default_factory=list)
    # Enrichis
    company_name: str | None = None
    contact_name: str | None = None
    deal_title: str | None = None
    # Métriques jalons
    milestones_total: int = 0
    milestones_done: int = 0
    upcoming_milestones: list[MilestoneOut] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class ProjectList(BaseModel):
    items: list[ProjectOut]
    total: int
    page: int
    page_size: int
