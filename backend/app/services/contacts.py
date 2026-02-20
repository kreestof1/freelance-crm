"""Service Contacts — CRUD + soft-delete + fusion."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.company import Company
from app.models.contact import Contact
from app.models.deal import Deal
from app.schemas.contacts import ContactCreate, ContactOut, ContactUpdate
from app.utils.audit import write_audit


# ── Helpers ────────────────────────────────────────────────────────────────────

def _enrich(contact: Contact, company: Company | None) -> ContactOut:
    out = ContactOut.model_validate(contact)
    out.company_name = company.name if company else None
    return out


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def list_contacts(
    db: AsyncSession,
    *,
    search: str | None = None,
    tag: str | None = None,
    company_id: uuid.UUID | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[ContactOut], int]:
    base = select(Contact).where(Contact.deleted_at.is_(None))

    if search:
        pattern = f"%{search}%"
        base = base.where(
            or_(
                (Contact.first_name + " " + Contact.last_name).ilike(pattern),
                Contact.email.ilike(pattern),
            )
        )
    if tag:
        base = base.where(Contact.tags.any(tag))
    if company_id:
        base = base.where(Contact.company_id == company_id)

    total_q = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_q.scalar_one()

    rows = await db.execute(
        base.order_by(Contact.last_name, Contact.first_name)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    contacts = list(rows.scalars())

    # Batch-load companies
    cids = {c.company_id for c in contacts if c.company_id}
    company_map: dict[uuid.UUID, Company] = {}
    if cids:
        comp_rows = await db.execute(select(Company).where(Company.id.in_(cids)))
        company_map = {c.id: c for c in comp_rows.scalars()}

    return [_enrich(c, company_map.get(c.company_id)) for c in contacts], total  # type: ignore[arg-type]


async def get_contact(db: AsyncSession, contact_id: uuid.UUID) -> Contact | None:
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id, Contact.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def create_contact(
    db: AsyncSession, data: ContactCreate, actor_id: uuid.UUID | None = None
) -> Contact:
    contact = Contact(**data.model_dump())
    db.add(contact)
    await db.flush()
    await write_audit(db, entity_type="contact", entity_id=contact.id, action="create", actor_id=actor_id)
    return contact


async def update_contact(
    db: AsyncSession, contact: Contact, data: ContactUpdate, actor_id: uuid.UUID | None = None
) -> Contact:
    diff: dict = {}
    for field, value in data.model_dump(exclude_none=True).items():
        old = getattr(contact, field, None)
        if old != value:
            diff[field] = {"from": str(old), "to": str(value)}
            setattr(contact, field, value)
    if diff:
        await write_audit(db, entity_type="contact", entity_id=contact.id, action="update", actor_id=actor_id, diff=diff)
    await db.flush()
    return contact


async def delete_contact(
    db: AsyncSession, contact: Contact, actor_id: uuid.UUID | None = None
) -> Contact:
    contact.deleted_at = datetime.now(timezone.utc)
    await write_audit(db, entity_type="contact", entity_id=contact.id, action="delete", actor_id=actor_id)
    await db.flush()
    return contact


# ── Fusion doublons ────────────────────────────────────────────────────────────

async def merge_contacts(
    db: AsyncSession,
    *,
    source: Contact,
    target: Contact,
    actor_id: uuid.UUID | None = None,
) -> Contact:
    """
    Rattache les activités et les deals du contact source vers le contact cible,
    puis soft-delete la source. Opération dans la transaction courante.
    """
    # Réattribuer les activités
    activity_rows = await db.execute(
        select(Activity).where(
            Activity.related_type == "contact",
            Activity.related_id == source.id,
            Activity.deleted_at.is_(None),
        )
    )
    for act in activity_rows.scalars():
        act.related_id = target.id  # type: ignore[assignment]

    # Réattribuer les deals liés
    deal_rows = await db.execute(
        select(Deal).where(Deal.contact_id == source.id, Deal.deleted_at.is_(None))
    )
    for deal in deal_rows.scalars():
        deal.contact_id = target.id  # type: ignore[assignment]

    # Fusionner les tags
    merged_tags = list(set((target.tags or []) + (source.tags or [])))
    target.tags = merged_tags

    # Soft-delete source
    source.deleted_at = datetime.now(timezone.utc)

    await write_audit(
        db,
        entity_type="contact",
        entity_id=target.id,
        action="merge",
        actor_id=actor_id,
        diff={"merged_from": str(source.id)},
    )
    await db.flush()
    return target
