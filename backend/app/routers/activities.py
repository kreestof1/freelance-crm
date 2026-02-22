"""Router /activities — CRUD + activités à venir."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.activities import ActivityCreate, ActivityList, ActivityOut, ActivityPatch
from app.services.activities import (
    create_activity,
    delete_activity,
    get_activity,
    list_activities,
    list_upcoming_activities,
    patch_activity,
)

router = APIRouter()
logger = structlog.get_logger(__name__)

DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def _get_or_404(db: AsyncSession, activity_id: uuid.UUID) -> object:
    activity = await get_activity(db, activity_id)
    if not activity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Activité introuvable"},
        )
    return activity


@router.post("", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
async def create_activity_endpoint(
    db: DB,
    current_user: CurrentUser,
    data: ActivityCreate,
) -> ActivityOut:
    """Créer une activité (appel, email, tâche, RDV)."""
    from app.models.activity import Activity
    activity = await create_activity(db, data, actor_id=current_user.id)
    await db.commit()
    # Récupérer l'objet DB pour refresh
    db_obj = await get_activity(db, activity.id)
    logger.info("activity.created", activity_id=str(activity.id), type=data.type)
    return activity


@router.get("", response_model=ActivityList)
async def list_activities_endpoint(
    db: DB,
    current_user: CurrentUser,
    related_type: str | None = Query(default=None),
    related_id: uuid.UUID | None = Query(default=None),
    type: str | None = Query(default=None, alias="type"),
    date_from: datetime | None = Query(default=None),
    date_to: datetime | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> ActivityList:
    """Liste les activités, avec filtres optionnels."""
    items, total = await list_activities(
        db,
        related_type=related_type,
        related_id=related_id,
        activity_type=type,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return ActivityList(items=items, total=total)


@router.get("/upcoming", response_model=ActivityList)
async def upcoming_activities_endpoint(
    db: DB,
    current_user: CurrentUser,
    hours: int = Query(default=48, ge=1, le=168),
) -> ActivityList:
    """Activités avec rappel dans les prochaines `hours` heures (défaut : 48h)."""
    items = await list_upcoming_activities(db, hours=hours)
    return ActivityList(items=items, total=len(items))


@router.get("/{activity_id}", response_model=ActivityOut)
async def get_activity_endpoint(
    db: DB,
    current_user: CurrentUser,
    activity_id: uuid.UUID,
) -> ActivityOut:
    from app.models.activity import Activity
    activity = await _get_or_404(db, activity_id)
    from app.services.activities import _enrich
    return await _enrich(db, activity)  # type: ignore[arg-type]


@router.patch("/{activity_id}", response_model=ActivityOut)
async def patch_activity_endpoint(
    db: DB,
    current_user: CurrentUser,
    activity_id: uuid.UUID,
    data: ActivityPatch,
) -> ActivityOut:
    activity = await _get_or_404(db, activity_id)
    result = await patch_activity(db, activity, data, actor_id=current_user.id)  # type: ignore[arg-type]
    await db.commit()
    logger.info("activity.updated", activity_id=str(activity_id))
    return result


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_activity_endpoint(
    db: DB,
    current_user: CurrentUser,
    activity_id: uuid.UUID,
) -> None:
    activity = await _get_or_404(db, activity_id)
    await delete_activity(db, activity, actor_id=current_user.id)  # type: ignore[arg-type]
    await db.commit()
    logger.info("activity.deleted", activity_id=str(activity_id))
