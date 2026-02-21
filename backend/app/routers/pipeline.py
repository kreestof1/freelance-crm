"""Router /pipeline — configuration des étapes du pipeline."""
from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.pipeline import PipelineStageOut, PipelineStagesUpdate
from app.services.pipeline import get_stages, replace_all_stages

router = APIRouter()
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


@router.get("/stages", response_model=list[PipelineStageOut])
async def get_pipeline_stages(db: DB, current_user: CurrentUser) -> list[PipelineStageOut]:
    """Retourne les étapes configurées du pipeline (triées par `order`)."""
    return await get_stages(db)


@router.put("/stages", response_model=list[PipelineStageOut])
async def update_pipeline_stages(
    db: DB, current_user: CurrentUser, body: PipelineStagesUpdate
) -> list[PipelineStageOut]:
    """Remplace toutes les étapes du pipeline (reconfiguration complète)."""
    stages = await replace_all_stages(db, body)
    await db.commit()
    return stages
