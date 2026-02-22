"""Router /projects — CRUD missions + jalons + création depuis deal."""
from __future__ import annotations

import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.projects import (
    MilestoneCreate,
    MilestonePatch,
    MilestoneOut,
    ProjectCreate,
    ProjectList,
    ProjectOut,
    ProjectPatch,
)
from app.services.projects import (
    create_milestone,
    create_project,
    create_project_from_deal,
    delete_milestone,
    delete_project,
    get_milestone,
    get_project,
    list_projects,
    patch_milestone,
    patch_project,
)

router = APIRouter()
logger = structlog.get_logger(__name__)
DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]


async def _get_or_404(db: DB, project_id: uuid.UUID):
    project = await get_project(db, project_id)
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Mission introuvable"},
        )
    return project


async def _get_milestone_or_404(db: DB, project_id: uuid.UUID, milestone_id: uuid.UUID):
    milestone = await get_milestone(db, project_id, milestone_id)
    if not milestone:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Jalon introuvable"},
        )
    return milestone


# ── Projects ──────────────────────────────────────────────────────────────────

@router.get("", response_model=ProjectList)
async def list_projects_endpoint(
    db: DB,
    current_user: CurrentUser,
    project_status: str | None = Query(default=None, alias="status", max_length=30),
    company_id: uuid.UUID | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=200),
) -> ProjectList:
    items, total = await list_projects(
        db,
        project_status=project_status,
        company_id=company_id,
        page=page,
        page_size=page_size,
    )
    return ProjectList(items=items, total=total, page=page, page_size=page_size)


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project_endpoint(db: DB, current_user: CurrentUser, body: ProjectCreate) -> ProjectOut:
    from app.services.projects import _enrich
    project = await create_project(db, body, actor_id=current_user.id)
    await db.commit()
    await db.refresh(project)
    logger.info("project.created", project_id=str(project.id))
    return await _enrich(db, project)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project_endpoint(db: DB, current_user: CurrentUser, project_id: uuid.UUID) -> ProjectOut:
    from app.services.projects import _enrich
    project = await _get_or_404(db, project_id)
    return await _enrich(db, project)


@router.patch("/{project_id}", response_model=ProjectOut)
async def patch_project_endpoint(
    db: DB, current_user: CurrentUser, project_id: uuid.UUID, body: ProjectPatch
) -> ProjectOut:
    from app.services.projects import _enrich
    project = await _get_or_404(db, project_id)
    project = await patch_project(db, project, body, actor_id=current_user.id)
    await db.commit()
    await db.refresh(project)
    return await _enrich(db, project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_project_endpoint(db: DB, current_user: CurrentUser, project_id: uuid.UUID) -> None:
    project = await _get_or_404(db, project_id)
    await delete_project(db, project, actor_id=current_user.id)
    await db.commit()
    logger.info("project.deleted", project_id=str(project_id))


# ── Milestones ────────────────────────────────────────────────────────────────

@router.post("/{project_id}/milestones", response_model=MilestoneOut, status_code=status.HTTP_201_CREATED)
async def add_milestone(
    db: DB, current_user: CurrentUser, project_id: uuid.UUID, body: MilestoneCreate
) -> MilestoneOut:
    await _get_or_404(db, project_id)
    milestone = await create_milestone(db, project_id, body, actor_id=current_user.id)
    await db.commit()
    await db.refresh(milestone)
    logger.info("milestone.created", milestone_id=str(milestone.id))
    return MilestoneOut.model_validate(milestone)


@router.patch("/{project_id}/milestones/{milestone_id}", response_model=MilestoneOut)
async def update_milestone(
    db: DB,
    current_user: CurrentUser,
    project_id: uuid.UUID,
    milestone_id: uuid.UUID,
    body: MilestonePatch,
) -> MilestoneOut:
    milestone = await _get_milestone_or_404(db, project_id, milestone_id)
    milestone = await patch_milestone(db, milestone, body, actor_id=current_user.id)
    await db.commit()
    await db.refresh(milestone)
    return MilestoneOut.model_validate(milestone)


@router.delete(
    "/{project_id}/milestones/{milestone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
)
async def remove_milestone(
    db: DB, current_user: CurrentUser, project_id: uuid.UUID, milestone_id: uuid.UUID
) -> None:
    milestone = await _get_milestone_or_404(db, project_id, milestone_id)
    await delete_milestone(db, milestone, actor_id=current_user.id)
    await db.commit()
    logger.info("milestone.deleted", milestone_id=str(milestone_id))
