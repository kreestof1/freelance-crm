"""Service Deals — CRUD + déplacement kanban + logique métier (verrouillage, pondéré)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.project import Project
from app.schemas.deals import DealCreate, DealMove, DealOut, DealPatch
from app.utils.audit import write_audit


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _enrich(db: AsyncSession, deal: Deal) -> DealOut:
    """Charge company_name et contact_name sans N+1."""
    company_name: str | None = None
    contact_name: str | None = None
    if deal.company_id:
        row = await db.execute(select(Company.name).where(Company.id == deal.company_id))
        company_name = row.scalar_one_or_none()
    if deal.contact_id:
        row = await db.execute(
            select(Contact.first_name, Contact.last_name).where(Contact.id == deal.contact_id)
        )
        c = row.one_or_none()
        if c:
            contact_name = f"{c.first_name} {c.last_name}".strip()
    has_project_row = await db.execute(
        select(Project.id).where(Project.deal_id == deal.id, Project.deleted_at.is_(None)).limit(1)
    )
    out = DealOut.model_validate(deal)
    out.company_name = company_name
    out.contact_name = contact_name
    out.has_project = has_project_row.scalar_one_or_none() is not None
    return out


async def _enrich_batch(db: AsyncSession, deals: list[Deal]) -> list[DealOut]:
    """Batch-load companies + contacts pour éviter N+1."""
    company_ids = {d.company_id for d in deals if d.company_id}
    contact_ids = {d.contact_id for d in deals if d.contact_id}

    company_map: dict[uuid.UUID, str] = {}
    contact_map: dict[uuid.UUID, str] = {}

    if company_ids:
        rows = await db.execute(select(Company.id, Company.name).where(Company.id.in_(company_ids)))
        company_map = {r.id: r.name for r in rows}

    if contact_ids:
        rows = await db.execute(
            select(Contact.id, Contact.first_name, Contact.last_name).where(Contact.id.in_(contact_ids))
        )
        contact_map = {r.id: f"{r.first_name} {r.last_name}".strip() for r in rows}

    # Batch-load has_project
    deal_ids = {d.id for d in deals}
    project_deal_ids: set[uuid.UUID] = set()
    if deal_ids:
        proj_rows = await db.execute(
            select(Project.deal_id).where(
                Project.deal_id.in_(deal_ids), Project.deleted_at.is_(None)
            )
        )
        project_deal_ids = {r for r in proj_rows.scalars()}

    results = []
    for deal in deals:
        out = DealOut.model_validate(deal)
        out.company_name = company_map.get(deal.company_id) if deal.company_id else None  # type: ignore[arg-type]
        out.contact_name = contact_map.get(deal.contact_id) if deal.contact_id else None  # type: ignore[arg-type]
        out.has_project = deal.id in project_deal_ids
        results.append(out)
    return results


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def list_deals(
    db: AsyncSession,
    *,
    stage: str | None = None,
    close_before: str | None = None,
    company_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[DealOut], int]:
    from datetime import date

    base = select(Deal).where(Deal.deleted_at.is_(None))
    if stage:
        base = base.where(Deal.stage == stage)
    if close_before:
        d = date.fromisoformat(close_before)
        base = base.where(Deal.expected_close <= d)
    if company_id:
        base = base.where(Deal.company_id == company_id)

    total_q = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_q.scalar_one()

    rows = await db.execute(
        base.order_by(Deal.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    deals = list(rows.scalars())
    return await _enrich_batch(db, deals), total


async def get_deal(db: AsyncSession, deal_id: uuid.UUID) -> Deal | None:
    result = await db.execute(select(Deal).where(Deal.id == deal_id, Deal.deleted_at.is_(None)))
    return result.scalar_one_or_none()


async def create_deal(
    db: AsyncSession, data: DealCreate, actor_id: uuid.UUID | None = None
) -> Deal:
    deal = Deal(**data.model_dump())
    db.add(deal)
    await db.flush()
    await write_audit(db, entity_type="deal", entity_id=deal.id, action="create", actor_id=actor_id)
    return deal


async def patch_deal(
    db: AsyncSession, deal: Deal, data: DealPatch, actor_id: uuid.UUID | None = None
) -> Deal:
    if deal.is_locked:
        # Seuls les champs non-verrouillés peuvent être modifiés
        locked_fields = {"amount", "expected_close"}
        attempted = {k for k, v in data.model_dump(exclude_unset=True).items() if k in locked_fields}
        if attempted:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "DEAL_LOCKED", "message": "Opportunité Gagnée : montant et date de clôture sont verrouillés."},
            )

    diff: dict = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        old = getattr(deal, field, None)
        if old != value:
            diff[field] = {"from": str(old), "to": str(value)}
            setattr(deal, field, value)
    if diff:
        await write_audit(db, entity_type="deal", entity_id=deal.id, action="update", actor_id=actor_id, diff=diff)
    await db.flush()
    return deal


async def delete_deal(
    db: AsyncSession, deal: Deal, actor_id: uuid.UUID | None = None
) -> Deal:
    deal.deleted_at = datetime.now(timezone.utc)
    await write_audit(db, entity_type="deal", entity_id=deal.id, action="delete", actor_id=actor_id)
    await db.flush()
    return deal


# ── Déplacement kanban ────────────────────────────────────────────────────────

async def move_deal(
    db: AsyncSession, deal: Deal, data: DealMove, actor_id: uuid.UUID | None = None
) -> Deal:
    """Déplace un deal vers un nouveau stage.
    - Enregistre la transition dans AuditLog
    - Si le nouveau stage est 'Gagné', verrouille le deal
    - Si le deal quitte 'Gagné', déverrouille
    """
    old_stage = deal.stage
    new_stage = data.stage

    if old_stage == new_stage:
        return deal

    deal.stage = new_stage

    # Verrouillage automatique sur Gagné
    if new_stage == "Gagné":
        deal.is_locked = True
        # Met la probabilité à 100%
        deal.probability = 100
    elif old_stage == "Gagné":
        # On quitte Gagné → déverrouiller
        deal.is_locked = False

    if new_stage == "Perdu":
        deal.probability = 0

    await write_audit(
        db,
        entity_type="deal",
        entity_id=deal.id,
        action="move",
        actor_id=actor_id,
        diff={"stage": {"from": old_stage, "to": new_stage}},
    )
    await db.flush()
    return deal
