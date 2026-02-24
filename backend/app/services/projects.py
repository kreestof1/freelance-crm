"""Service Projects (Missions) — CRUD + jalons + création depuis deal."""
from __future__ import annotations

import uuid
from datetime import date, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.milestone import Milestone
from app.models.project import Project
from app.schemas.projects import (
    MilestoneCreate,
    MilestonePatch,
    MilestoneOut,
    ProjectCreate,
    ProjectOut,
    ProjectPatch,
)
from app.utils.audit import write_audit


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _enrich(db: AsyncSession, project: Project) -> ProjectOut:
    """Charge les relations + métriques jalons."""
    company_name: str | None = None
    contact_name: str | None = None
    deal_title: str | None = None

    if project.company_id:
        row = await db.execute(select(Company.name).where(Company.id == project.company_id))
        company_name = row.scalar_one_or_none()
    if project.contact_id:
        row = await db.execute(
            select(Contact.first_name, Contact.last_name).where(Contact.id == project.contact_id)
        )
        c = row.one_or_none()
        if c:
            contact_name = f"{c.first_name} {c.last_name}".strip()
    if project.deal_id:
        row = await db.execute(select(Deal.title).where(Deal.id == project.deal_id))
        deal_title = row.scalar_one_or_none()

    # Charger les jalons (refresh garantit que la relation est disponible en mémoire)
    await db.refresh(project, attribute_names=["milestones"])
    milestones = sorted(
        project.milestones,
        key=lambda m: (m.due_date is None, m.due_date),
    )

    milestones_done = sum(1 for m in milestones if m.status == "Done")
    today = date.today()
    week_from_now = today + timedelta(days=7)
    upcoming = [m for m in milestones if m.due_date and today <= m.due_date <= week_from_now and m.status != "Done"]

    out = ProjectOut.model_validate(project)
    out.company_name = company_name
    out.contact_name = contact_name
    out.deal_title = deal_title
    out.milestones = [MilestoneOut.model_validate(m) for m in milestones]
    out.milestones_total = len(milestones)
    out.milestones_done = milestones_done
    out.upcoming_milestones = [MilestoneOut.model_validate(m) for m in upcoming]
    return out


# ── Project CRUD ──────────────────────────────────────────────────────────────

async def list_projects(
    db: AsyncSession,
    *,
    project_status: str | None = None,
    company_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[ProjectOut], int]:
    base = select(Project).where(Project.deleted_at.is_(None))
    if project_status:
        base = base.where(Project.status == project_status)
    if company_id:
        base = base.where(Project.company_id == company_id)

    total_q = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_q.scalar_one()

    rows = await db.execute(
        base.order_by(Project.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    projects = list(rows.scalars())
    return [await _enrich(db, p) for p in projects], total


async def get_project(db: AsyncSession, project_id: uuid.UUID) -> Project | None:
    result = await db.execute(
        select(Project).where(Project.id == project_id, Project.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def create_project(
    db: AsyncSession, data: ProjectCreate, actor_id: uuid.UUID | None = None
) -> Project:
    project = Project(**data.model_dump())
    db.add(project)
    await db.flush()
    await write_audit(db, entity_type="project", entity_id=project.id, action="create", actor_id=actor_id)
    return project


async def patch_project(
    db: AsyncSession, project: Project, data: ProjectPatch, actor_id: uuid.UUID | None = None
) -> Project:
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        return project
    for key, val in changes.items():
        setattr(project, key, val)
    await db.flush()
    await write_audit(
        db, entity_type="project", entity_id=project.id, action="update",
        actor_id=actor_id, diff=changes
    )
    return project


async def delete_project(
    db: AsyncSession, project: Project, actor_id: uuid.UUID | None = None
) -> None:
    from datetime import datetime, timezone
    project.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    await write_audit(db, entity_type="project", entity_id=project.id, action="delete", actor_id=actor_id)


async def create_project_from_deal(
    db: AsyncSession, deal_id: uuid.UUID, actor_id: uuid.UUID | None = None
) -> Project:
    """Crée une mission à partir d'un deal Gagné."""
    deal = await db.execute(select(Deal).where(Deal.id == deal_id, Deal.deleted_at.is_(None)))
    deal_obj = deal.scalar_one_or_none()
    if not deal_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Deal introuvable"},
        )
    if not deal_obj.is_locked:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "DEAL_NOT_WON", "message": "Le deal doit être à l'étape 'Gagné' pour créer une mission"},
        )
    # Vérifier qu'une mission n'existe pas déjà pour ce deal
    existing = await db.execute(
        select(Project).where(Project.deal_id == deal_id, Project.deleted_at.is_(None))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "PROJECT_EXISTS", "message": "Une mission existe déjà pour ce deal"},
        )
    data = ProjectCreate(
        title=deal_obj.title,
        status="Planifié",
        budget_amount=deal_obj.amount,
        company_id=deal_obj.company_id,
        contact_id=deal_obj.contact_id,
        deal_id=deal_obj.id,
    )
    return await create_project(db, data, actor_id=actor_id)


# ── Milestone CRUD ─────────────────────────────────────────────────────────────

async def get_milestone(
    db: AsyncSession, project_id: uuid.UUID, milestone_id: uuid.UUID
) -> Milestone | None:
    result = await db.execute(
        select(Milestone).where(
            Milestone.id == milestone_id,
            Milestone.project_id == project_id,
        )
    )
    return result.scalar_one_or_none()


async def create_milestone(
    db: AsyncSession,
    project_id: uuid.UUID,
    data: MilestoneCreate,
    actor_id: uuid.UUID | None = None,
) -> Milestone:
    milestone = Milestone(project_id=project_id, **data.model_dump())
    db.add(milestone)
    await db.flush()
    await write_audit(
        db, entity_type="milestone", entity_id=milestone.id, action="create",
        actor_id=actor_id, diff={"project_id": str(project_id)}
    )
    return milestone


async def patch_milestone(
    db: AsyncSession,
    milestone: Milestone,
    data: MilestonePatch,
    actor_id: uuid.UUID | None = None,
) -> Milestone:
    old_status = milestone.status
    changes = data.model_dump(exclude_none=True)
    if not changes:
        return milestone
    for key, val in changes.items():
        setattr(milestone, key, val)
    await db.flush()
    if "status" in changes and changes["status"] != old_status:
        await write_audit(
            db, entity_type="milestone", entity_id=milestone.id, action="status_change",
            actor_id=actor_id,
            diff={"old_status": old_status, "new_status": changes["status"]},
        )
    else:
        await write_audit(
            db, entity_type="milestone", entity_id=milestone.id, action="update",
            actor_id=actor_id, diff=changes,
        )
    return milestone


async def delete_milestone(
    db: AsyncSession, milestone: Milestone, actor_id: uuid.UUID | None = None
) -> None:
    await write_audit(
        db, entity_type="milestone", entity_id=milestone.id, action="delete", actor_id=actor_id
    )
    await db.delete(milestone)
    await db.flush()
