"""Schémas Pydantic v2 — Activités."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

ActivityType = Literal["Appel", "Email", "Tâche", "RDV"]
RelatedType = Literal["contact", "deal", "project"]


class ActivityCreate(BaseModel):
    type: ActivityType
    when: datetime
    duration_min: int | None = Field(default=None, ge=1, le=1440)
    outcome: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=10000)
    related_type: RelatedType | None = None
    related_id: uuid.UUID | None = None
    reminder_at: datetime | None = None


class ActivityPatch(BaseModel):
    type: ActivityType | None = None
    when: datetime | None = None
    duration_min: int | None = Field(default=None, ge=1, le=1440)
    outcome: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=10000)
    related_type: RelatedType | None = None
    related_id: uuid.UUID | None = None
    reminder_at: datetime | None = None
    reminder_sent: bool | None = None


class ActivityOut(BaseModel):
    id: uuid.UUID
    type: ActivityType
    when: datetime
    duration_min: int | None
    outcome: str | None
    notes: str | None
    related_type: str | None
    related_id: uuid.UUID | None
    reminder_at: datetime | None
    reminder_sent: bool
    user_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
    # Champs enrichis
    related_label: str | None = None  # ex. "Alice Martin" pour un contact

    model_config = {"from_attributes": True}


class ActivityList(BaseModel):
    items: list[ActivityOut]
    total: int
