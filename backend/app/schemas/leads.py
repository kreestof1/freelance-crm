"""Schémas Pydantic — Leads (Prospects)."""
import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

LeadStatus = Literal["Nouveau", "Qualifié", "Converti", "Perdu"]
LeadSource = Literal["web", "recommandation", "evenement", "réseau", "publicité", "other"]


class LeadBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr | None = None
    source: LeadSource = "other"
    status: LeadStatus = "Nouveau"
    score: int = Field(default=0, ge=0, le=100)
    interest: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=5000)
    notes: str | None = Field(default=None, max_length=10000)
    tags: list[str] = Field(default_factory=list)
    company_id: uuid.UUID | None = None
    contact_id: uuid.UUID | None = None


class LeadCreate(BaseModel):
    """Création rapide — 3 champs minimum."""
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr | None = None
    source: LeadSource = "other"
    # champs optionnels enrichissables
    status: LeadStatus = "Nouveau"
    score: int = Field(default=0, ge=0, le=100)
    interest: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=5000)
    notes: str | None = Field(default=None, max_length=10000)
    tags: list[str] = Field(default_factory=list)
    company_id: uuid.UUID | None = None


class LeadPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: EmailStr | None = None
    source: LeadSource | None = None
    status: LeadStatus | None = None
    score: int | None = Field(default=None, ge=0, le=100)
    interest: str | None = Field(default=None, max_length=500)
    description: str | None = Field(default=None, max_length=5000)
    notes: str | None = Field(default=None, max_length=10000)
    tags: list[str] | None = None
    company_id: uuid.UUID | None = None


class LeadOut(LeadBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    company_name: str | None = None

    model_config = {"from_attributes": True}


class LeadList(BaseModel):
    items: list[LeadOut]
    total: int
    page: int
    page_size: int


class LeadConvertRequest(BaseModel):
    """Convertit un lead en Contact + Deal (transaction atomique)."""
    deal_title: str = Field(min_length=1, max_length=300)
    deal_amount: float = Field(default=0.0, ge=0)
    deal_stage: str = "Découverte"
    company_id: uuid.UUID | None = None
    # Si True, crée un nouveau Contact ; si False, utilise contact_id existant
    create_contact: bool = True
    existing_contact_id: uuid.UUID | None = None


class LeadConvertResult(BaseModel):
    contact_id: uuid.UUID
    deal_id: uuid.UUID
    lead_id: uuid.UUID
