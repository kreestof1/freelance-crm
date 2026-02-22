"""Schémas Pydantic — Contacts."""
import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, EmailStr, Field


class ContactBase(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    phone: str | None = Field(default=None, max_length=30)
    role: str | None = Field(default=None, max_length=100)
    linkedin_url: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=10000)
    tags: list[str] = Field(default_factory=list)
    company_id: uuid.UUID | None = None
    consent_rgpd: bool = False
    consent_date: datetime | None = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    first_name: str | None = Field(default=None, min_length=1, max_length=100)
    last_name: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, max_length=30)
    role: str | None = Field(default=None, max_length=100)
    linkedin_url: str | None = Field(default=None, max_length=500)
    notes: str | None = Field(default=None, max_length=10000)
    tags: list[str] | None = None
    company_id: uuid.UUID | None = None
    consent_rgpd: bool | None = None
    consent_date: datetime | None = None


class ContactOut(ContactBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    company_name: str | None = None
    anonymized_at: datetime | None = None
    anonymized_stats: dict[str, Any] | None = None
    # Override: anonymized contacts store a non-routable address — skip email validation on output
    email: str | None = None  # type: ignore[assignment]

    model_config = {"from_attributes": True}


class ContactList(BaseModel):
    items: list[ContactOut]
    total: int
    page: int
    page_size: int


class ContactMergeRequest(BaseModel):
    """Fusionne source_id → target_id et soft-delete la source."""
    source_id: uuid.UUID
    target_id: uuid.UUID


# ── Import CSV ──────────────────────────────────────────────────────────────────

class CsvImportError(BaseModel):
    line: int
    message: str


class CsvImportResult(BaseModel):
    success: int
    errors: list[CsvImportError]


class CsvColumnMapping(BaseModel):
    """Retourné lors de la phase de détection automatique du mapping CSV."""
    detected_mapping: dict[str, str]  # csv_column → model_field
    sample_rows: list[dict[str, str]]  # 3 premières lignes


# Champs CSV acceptés → champs modèle
CSV_FIELD_MAP: dict[str, str] = {
    "prenom": "first_name",
    "nom": "last_name",
    "email": "email",
    "telephone": "phone",
    "tel": "phone",
    "poste": "role",
    "fonction": "role",
    "linkedin": "linkedin_url",
    "notes": "notes",
    "tags": "tags",
    "entreprise": "company_name",
    "first_name": "first_name",
    "last_name": "last_name",
    "phone": "phone",
    "role": "role",
    "company": "company_name",
}
