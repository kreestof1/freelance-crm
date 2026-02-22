"""Schémas Pydantic — Documents."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

DocumentType = Literal["Brief", "Proposition", "Contrat", "Autre"]
RelatedType = Literal["deal", "project"]


class DocumentCreate(BaseModel):
    """Métadonnées à fournir lors d'un upload ou ajout de lien externe."""
    type: DocumentType = "Autre"
    filename: str = Field(min_length=1, max_length=500)
    external_url: str | None = Field(default=None, max_length=2000)
    related_type: RelatedType | None = None
    related_id: uuid.UUID | None = None


class DocumentOut(BaseModel):
    id: uuid.UUID
    type: str
    filename: str
    file_uri: str | None
    external_url: str | None
    version: int
    mime_type: str | None
    size_bytes: int | None
    related_type: str | None
    related_id: uuid.UUID | None
    created_at: datetime
    # URL signée (1h), fournie uniquement sur GET /documents/{id}
    signed_url: str | None = None

    model_config = {"from_attributes": True}


class DocumentList(BaseModel):
    items: list[DocumentOut]
    total: int
