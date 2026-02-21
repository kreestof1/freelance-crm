"""Service Pipeline — gestion des étapes configurables."""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.pipeline_stage import DEFAULT_STAGES, PipelineStage
from app.schemas.pipeline import PipelineStageCreate, PipelineStageOut, PipelineStagesUpdate


async def get_stages(db: AsyncSession) -> list[PipelineStageOut]:
    """Retourne les étapes triées par `order`."""
    rows = await db.execute(select(PipelineStage).order_by(PipelineStage.order))
    stages = list(rows.scalars())
    if not stages:
        stages = await seed_default_stages(db)
    return [PipelineStageOut.model_validate(s) for s in stages]


async def seed_default_stages(db: AsyncSession) -> list[PipelineStage]:
    """Insère les étapes par défaut si la table est vide."""
    stages = [PipelineStage(**s) for s in DEFAULT_STAGES]
    db.add_all(stages)
    await db.flush()
    return stages


async def replace_all_stages(
    db: AsyncSession, data: PipelineStagesUpdate
) -> list[PipelineStageOut]:
    """Remplace toutes les étapes (PUT /pipeline/stages).
    - Supprime les étapes existantes
    - Recrée depuis le payload
    """
    # Supprimer toutes les étapes existantes
    existing = await db.execute(select(PipelineStage))
    for stage in existing.scalars():
        await db.delete(stage)
    await db.flush()

    new_stages = []
    for s in data.stages:
        stage = PipelineStage(**s.model_dump())
        db.add(stage)
        new_stages.append(stage)
    await db.flush()

    # Rafraîchir
    for s in new_stages:
        await db.refresh(s)

    return [PipelineStageOut.model_validate(s) for s in new_stages]
