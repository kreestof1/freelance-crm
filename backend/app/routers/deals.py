"""Router /deals — CRUD + déplacement kanban."""
from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.deals import DealCreate, DealList, DealMove, DealOut, DealPatch
from app.services.deals import (
    create_deal,
    delete_deal,
    get_deal,
    list_deals,
    move_deal,
    patch_deal,
)

router = APIRouter()
logger = structlog.get_logger(__name__)
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def _get_or_404(db: DB, deal_id: uuid.UUID):
    deal = await get_deal(db, deal_id)
    if not deal:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Deal introuvable"},
        )
    return deal


@router.get("", response_model=DealList)
async def list_deals_endpoint(
    db: DB,
    current_user: CurrentUser,
    stage: str | None = Query(default=None, max_length=50),
    close_before: str | None = Query(default=None, description="ISO date YYYY-MM-DD"),
    company_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> DealList:
    items, total = await list_deals(
        db,
        stage=stage,
        close_before=close_before,
        company_id=company_id,
        page=page,
        page_size=page_size,
    )
    return DealList(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=DealOut, status_code=status.HTTP_201_CREATED)
async def create_deal_endpoint(db: DB, current_user: CurrentUser, body: DealCreate) -> DealOut:
    from app.services.deals import _enrich

    deal = await create_deal(db, body, actor_id=current_user.id)
    await db.commit()
    await db.refresh(deal)
    logger.info("deal.created", deal_id=str(deal.id))
    return await _enrich(db, deal)


@router.get("/{deal_id}", response_model=DealOut)
async def get_deal_endpoint(db: DB, current_user: CurrentUser, deal_id: uuid.UUID) -> DealOut:
    from app.services.deals import _enrich

    deal = await _get_or_404(db, deal_id)
    return await _enrich(db, deal)


@router.patch("/{deal_id}", response_model=DealOut)
async def patch_deal_endpoint(
    db: DB, current_user: CurrentUser, deal_id: uuid.UUID, body: DealPatch
) -> DealOut:
    from app.services.deals import _enrich

    deal = await _get_or_404(db, deal_id)
    deal = await patch_deal(db, deal, body, actor_id=current_user.id)
    await db.commit()
    await db.refresh(deal)
    return await _enrich(db, deal)


@router.post("/{deal_id}/move", response_model=DealOut)
async def move_deal_endpoint(
    db: DB, current_user: CurrentUser, deal_id: uuid.UUID, body: DealMove
) -> DealOut:
    from app.services.deals import _enrich

    deal = await _get_or_404(db, deal_id)
    deal = await move_deal(db, deal, body, actor_id=current_user.id)
    await db.commit()
    await db.refresh(deal)
    logger.info("deal.moved", deal_id=str(deal.id), stage=deal.stage)
    return await _enrich(db, deal)


@router.delete("/{deal_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_deal_endpoint(
    db: DB, current_user: CurrentUser, deal_id: uuid.UUID
) -> None:
    deal = await _get_or_404(db, deal_id)
    await delete_deal(db, deal, actor_id=current_user.id)
    await db.commit()
    logger.info("deal.deleted", deal_id=str(deal_id))


@router.post("/{deal_id}/create_project", status_code=status.HTTP_201_CREATED)
async def create_project_from_deal_endpoint(
    db: DB, current_user: CurrentUser, deal_id: uuid.UUID
) -> dict:
    """Crée une mission depuis un deal Gagné (verrouillé)."""
    from app.services.projects import _enrich, create_project_from_deal
    project = await create_project_from_deal(db, deal_id, actor_id=current_user.id)
    await db.commit()
    await db.refresh(project)
    logger.info("project.created_from_deal", project_id=str(project.id), deal_id=str(deal_id))
    enriched = await _enrich(db, project)
    return enriched.model_dump()
