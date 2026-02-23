"""Service Leads — CRUD + conversion atomique en Contact + Deal."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact
from app.models.deal import Deal
from app.models.lead import Lead
from app.schemas.leads import LeadConvertRequest, LeadConvertResult, LeadCreate, LeadOut, LeadPatch
from app.utils.audit import write_audit


# ── CRUD ──────────────────────────────────────────────────────────────────────

def _enrich(lead: Lead, company_name: str | None) -> LeadOut:
    out = LeadOut.model_validate(lead)
    out.company_name = company_name
    return out


async def list_leads(
    db: AsyncSession,
    *,
    status: str | None = None,
    source: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[LeadOut], int]:
    from sqlalchemy import or_
    from app.models.company import Company

    base = select(Lead).where(Lead.deleted_at.is_(None))
    if status:
        base = base.where(Lead.status == status)
    if source:
        base = base.where(Lead.source == source)

    total_q = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_q.scalar_one()

    rows = await db.execute(
        base.order_by(Lead.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    )
    leads = list(rows.scalars())

    # Batch-load companies
    cids = {l.company_id for l in leads if l.company_id}
    company_map: dict[uuid.UUID, str] = {}
    if cids:
        comp_rows = await db.execute(
            select(Company.id, Company.name).where(Company.id.in_(cids))
        )
        company_map = {row.id: row.name for row in comp_rows}

    return [_enrich(l, company_map.get(l.company_id)) for l in leads], total  # type: ignore[arg-type]


async def get_lead(db: AsyncSession, lead_id: uuid.UUID) -> Lead | None:
    result = await db.execute(
        select(Lead).where(Lead.id == lead_id, Lead.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def create_lead(
    db: AsyncSession, data: LeadCreate, actor_id: uuid.UUID | None = None
) -> Lead:
    lead = Lead(**data.model_dump())
    db.add(lead)
    await db.flush()
    await write_audit(db, entity_type="lead", entity_id=lead.id, action="create", actor_id=actor_id)
    return lead


async def patch_lead(
    db: AsyncSession, lead: Lead, data: LeadPatch, actor_id: uuid.UUID | None = None
) -> Lead:
    diff: dict = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        old = getattr(lead, field, None)
        if old != value:
            diff[field] = {"from": str(old), "to": str(value)}
            setattr(lead, field, value)
    if diff:
        await write_audit(db, entity_type="lead", entity_id=lead.id, action="update", actor_id=actor_id, diff=diff)
    await db.flush()
    return lead


async def delete_lead(
    db: AsyncSession, lead: Lead, actor_id: uuid.UUID | None = None
) -> Lead:
    lead.deleted_at = datetime.now(timezone.utc)
    await write_audit(db, entity_type="lead", entity_id=lead.id, action="delete", actor_id=actor_id)
    await db.flush()
    return lead


# ── Conversion atomique Lead → Contact + Deal ─────────────────────────────────

async def convert_lead(
    db: AsyncSession,
    lead: Lead,
    data: LeadConvertRequest,
    actor_id: uuid.UUID | None = None,
) -> LeadConvertResult:
    """
    Transaction atomique :
    1. Crée (ou réutilise) un Contact
    2. Crée un Deal lié au Contact
    3. Passe le Lead en status=Converti et le soft-delete
    """
    # 1. Contact
    if data.create_contact:
        # Décomposer le nom du lead
        parts = lead.name.strip().split(" ", 1)
        first_name = parts[0]
        last_name = parts[1] if len(parts) > 1 else ""

        contact = Contact(
            first_name=first_name,
            last_name=last_name,
            email=lead.email or f"contact-{lead.id}@unknown.invalid",
            company_id=data.company_id or lead.company_id,
            notes=lead.notes,
            tags=list(lead.tags or []),
        )
        db.add(contact)
        await db.flush()
        contact_id = contact.id
    else:
        if not data.existing_contact_id:
            raise ValueError("existing_contact_id requis quand create_contact=False")
        contact_id = data.existing_contact_id

    # 2. Deal
    deal = Deal(
        title=data.deal_title,
        amount=data.deal_amount,
        stage=data.deal_stage,
        company_id=data.company_id or lead.company_id,
        contact_id=contact_id,
        notes=lead.notes,
        tags=list(lead.tags or []),
    )
    db.add(deal)
    await db.flush()

    # 3. Lead → Converti
    lead.status = "Converti"
    lead.contact_id = contact_id

    await write_audit(
        db,
        entity_type="lead",
        entity_id=lead.id,
        action="convert",
        actor_id=actor_id,
        diff={"contact_id": str(contact_id), "deal_id": str(deal.id)},
    )
    await db.flush()
    return LeadConvertResult(contact_id=contact_id, deal_id=deal.id, lead_id=lead.id)
