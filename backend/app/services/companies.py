"""Service Entreprises — CRUD + soft-delete."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.contact import Contact
from app.schemas.companies import CompanyCreate, CompanyOut, CompanyUpdate
from app.utils.audit import write_audit


# ── Helpers ───────────────────────────────────────────────────────────────────

def _to_out(company: Company, contacts_count: int = 0) -> CompanyOut:
    out = CompanyOut.model_validate(company)
    out.contacts_count = contacts_count
    return out


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def list_companies(
    db: AsyncSession,
    *,
    search: str | None = None,
    tag: str | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[CompanyOut], int]:
    base = select(Company).where(Company.deleted_at.is_(None))

    if search:
        pattern = f"%{search}%"
        base = base.where(
            or_(Company.name.ilike(pattern), Company.sector.ilike(pattern))
        )
    if tag:
        base = base.where(Company.tags.any(tag))

    total_q = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_q.scalar_one()

    rows = await db.execute(
        base.order_by(Company.name).offset((page - 1) * page_size).limit(page_size)
    )
    companies = list(rows.scalars())

    # Batch-count contacts
    if companies:
        ids = [c.id for c in companies]
        count_q = await db.execute(
            select(Contact.company_id, func.count().label("cnt"))
            .where(Contact.company_id.in_(ids), Contact.deleted_at.is_(None))
            .group_by(Contact.company_id)
        )
        count_map = {row.company_id: row.cnt for row in count_q}
    else:
        count_map = {}

    items = [_to_out(c, count_map.get(c.id, 0)) for c in companies]
    return items, total


async def get_company(db: AsyncSession, company_id: uuid.UUID) -> Company | None:
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def create_company(
    db: AsyncSession, data: CompanyCreate, actor_id: uuid.UUID | None = None
) -> Company:
    company = Company(**data.model_dump())
    db.add(company)
    await db.flush()
    await write_audit(db, entity_type="company", entity_id=company.id, action="create", actor_id=actor_id)
    return company


async def update_company(
    db: AsyncSession, company: Company, data: CompanyUpdate, actor_id: uuid.UUID | None = None
) -> Company:
    diff: dict = {}
    for field, value in data.model_dump(exclude_none=True).items():
        old = getattr(company, field, None)
        if old != value:
            diff[field] = {"from": old, "to": value}
            setattr(company, field, value)
    if diff:
        await write_audit(db, entity_type="company", entity_id=company.id, action="update", actor_id=actor_id, diff=diff)
    await db.flush()
    return company


async def delete_company(
    db: AsyncSession, company: Company, actor_id: uuid.UUID | None = None
) -> Company:
    company.deleted_at = datetime.now(timezone.utc)
    await write_audit(db, entity_type="company", entity_id=company.id, action="delete", actor_id=actor_id)
    await db.flush()
    return company
