"""Router /search — recherche globale full-text."""
from __future__ import annotations

from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.search import SearchResult
from app.services.search import global_search

router = APIRouter()
logger = structlog.get_logger(__name__)

DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]

VALID_TYPES = {"contact", "company", "lead", "deal", "project"}


@router.get("", response_model=SearchResult)
async def search_endpoint(
    db: DB,
    current_user: CurrentUser,
    q: str = Query(min_length=1, max_length=200, description="Terme de recherche"),
    types: str | None = Query(
        default=None,
        description="Types à inclure, séparés par virgule : contact,company,lead,deal,project",
    ),
    limit: int = Query(default=20, ge=1, le=50),
) -> SearchResult:
    """Recherche globale full-text sur toutes les entités du CRM."""
    type_list: list[str] | None = None
    if types:
        type_list = [t.strip() for t in types.split(",") if t.strip() in VALID_TYPES]
        if not type_list:
            type_list = None  # invalides → tout chercher

    result = await global_search(db, query=q, types=type_list, limit=limit)
    logger.info("search", query=q, types=type_list, hits=result.total)
    return result
