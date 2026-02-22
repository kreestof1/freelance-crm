"""Schémas Pydantic v2 — Recherche globale."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

SearchEntityType = Literal["contact", "company", "lead", "deal", "project"]


class SearchHit(BaseModel):
    type: SearchEntityType
    id: str
    title: str
    excerpt: str | None = None  # fragment de texte avec le terme trouvé


class SearchResult(BaseModel):
    hits: list[SearchHit]
    total: int
    query: str
