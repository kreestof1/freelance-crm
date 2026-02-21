"""Schémas Pydantic — PipelineStage (étapes configurables du pipeline)."""
from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class PipelineStageBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    order: int = Field(ge=0)
    default_probability: int = Field(default=0, ge=0, le=100)
    is_closed: bool = False
    is_won: bool = False
    color: str | None = Field(default=None, max_length=20)


class PipelineStageCreate(PipelineStageBase):
    pass


class PipelineStagePatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    order: int | None = Field(default=None, ge=0)
    default_probability: int | None = Field(default=None, ge=0, le=100)
    is_closed: bool | None = None
    is_won: bool | None = None
    color: str | None = Field(default=None, max_length=20)


class PipelineStageOut(PipelineStageBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PipelineStagesUpdate(BaseModel):
    """Reconfiguration complète des étapes (PUT /pipeline/stages)."""
    stages: list[PipelineStageCreate]
