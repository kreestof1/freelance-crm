"""Service Activités — CRUD + activités à venir (rappels)."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import Activity
from app.models.company import Company
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.project import Project
from app.schemas.activities import ActivityCreate, ActivityOut, ActivityPatch
from app.utils.audit import write_audit


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _enrich(db: AsyncSession, activity: Activity) -> ActivityOut:
    """Résout le label de l'entité liée."""
    related_label: str | None = None
    if activity.related_type and activity.related_id:
        eid = activity.related_id
        if activity.related_type == "contact":
            row = await db.execute(
                select(Contact.first_name, Contact.last_name).where(Contact.id == eid)
            )
            c = row.one_or_none()
            if c:
                related_label = f"{c.first_name} {c.last_name}".strip()
        elif activity.related_type == "deal":
            row = await db.execute(select(Deal.title).where(Deal.id == eid))
            related_label = row.scalar_one_or_none()
        elif activity.related_type == "project":
            row = await db.execute(select(Project.title).where(Project.id == eid))
            related_label = row.scalar_one_or_none()
        elif activity.related_type == "lead":
            from app.models.lead import Lead
            row = await db.execute(select(Lead.name).where(Lead.id == eid))
            related_label = row.scalar_one_or_none()

    out = ActivityOut.model_validate(activity)
    out.related_label = related_label
    return out


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def get_activity(db: AsyncSession, activity_id: uuid.UUID) -> Activity | None:
    result = await db.execute(
        select(Activity).where(Activity.id == activity_id, Activity.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def list_activities(
    db: AsyncSession,
    *,
    related_type: str | None = None,
    related_id: uuid.UUID | None = None,
    activity_type: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[ActivityOut], int]:
    from sqlalchemy import and_

    conditions = [Activity.deleted_at.is_(None)]
    if related_type:
        conditions.append(Activity.related_type == related_type)
    if related_id:
        conditions.append(Activity.related_id == related_id)
    if activity_type:
        conditions.append(Activity.type == activity_type)
    if date_from:
        conditions.append(Activity.when >= date_from)
    if date_to:
        conditions.append(Activity.when <= date_to)

    count_q = await db.execute(
        select(func.count()).select_from(Activity).where(and_(*conditions))
    )
    total = count_q.scalar_one()

    rows = await db.execute(
        select(Activity)
        .where(and_(*conditions))
        .order_by(Activity.when.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [await _enrich(db, a) for a in rows.scalars()]
    return items, total


async def list_upcoming_activities(
    db: AsyncSession,
    *,
    hours: int = 48,
) -> list[ActivityOut]:
    """Activités avec rappel dans les prochaines `hours` heures et non encore envoyé."""
    now = datetime.now(timezone.utc)
    deadline = now + timedelta(hours=hours)
    rows = await db.execute(
        select(Activity)
        .where(
            Activity.deleted_at.is_(None),
            Activity.reminder_at.is_not(None),
            Activity.reminder_at <= deadline,
            Activity.reminder_at >= now,
            Activity.reminder_sent.is_(False),
        )
        .order_by(Activity.reminder_at.asc())
    )
    return [await _enrich(db, a) for a in rows.scalars()]


async def create_activity(
    db: AsyncSession,
    data: ActivityCreate,
    actor_id: uuid.UUID | None = None,
) -> ActivityOut:
    activity = Activity(**data.model_dump())
    db.add(activity)
    await db.flush()
    await db.refresh(activity)  # reload server-computed cols (created_at, updated_at)
    await write_audit(
        db, entity_type="activity", entity_id=activity.id, action="create", actor_id=actor_id
    )
    return await _enrich(db, activity)


async def patch_activity(
    db: AsyncSession,
    activity: Activity,
    data: ActivityPatch,
    actor_id: uuid.UUID | None = None,
) -> ActivityOut:
    changes: dict[str, object] = {}
    for field, value in data.model_dump(exclude_unset=True).items():
        old = getattr(activity, field)
        if old != value:
            setattr(activity, field, value)
            changes[field] = {"old": old, "new": value}

    await db.flush()
    await db.refresh(activity)  # reload server-computed cols (updated_at)
    if changes:
        await write_audit(
            db,
            entity_type="activity",
            entity_id=activity.id,
            action="update",
            actor_id=actor_id,
            diff=changes,
        )
    return await _enrich(db, activity)


async def delete_activity(
    db: AsyncSession,
    activity: Activity,
    actor_id: uuid.UUID | None = None,
) -> None:
    activity.deleted_at = datetime.now(timezone.utc)
    await db.flush()
    await write_audit(
        db, entity_type="activity", entity_id=activity.id, action="delete", actor_id=actor_id
    )
