"""Router /export — CSV streaming pour deals, projects, contacts."""
from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.database import get_db
from app.dependencies import get_current_user
from app.models.company import Company
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.project import Project
from app.models.user import User

router = APIRouter()

DB = Annotated[AsyncSession, Depends(get_db)]
CurrentUser = Annotated[User, Depends(get_current_user)]

# UTF-8 BOM + point-virgule → compatibilité Excel FR
CSV_BOM = "\ufeff"
CSV_DELIMITER = ";"


def _csv_response(rows: list[list[str]], headers: list[str], filename: str) -> StreamingResponse:
    """Génère une StreamingResponse CSV avec BOM UTF-8."""
    buf = io.StringIO()
    buf.write(CSV_BOM)
    writer = csv.writer(buf, delimiter=CSV_DELIMITER, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(headers)
    writer.writerows(rows)
    buf.seek(0)

    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


def _fmt_date(v: date | datetime | None) -> str:
    if v is None:
        return ""
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d %H:%M")
    return v.strftime("%Y-%m-%d")


def _today() -> str:
    return datetime.utcnow().strftime("%Y%m%d")


# ── GET /export/deals ─────────────────────────────────────────────────────────

@router.get("/deals")
async def export_deals(
    db: DB,
    current_user: CurrentUser,
    stage: str | None = Query(default=None),
    close_before: date | None = Query(default=None),
) -> StreamingResponse:
    """Export CSV des opportunités (deals)."""
    q = select(Deal).where(Deal.deleted_at.is_(None))
    if stage:
        q = q.where(Deal.stage == stage)
    if close_before:
        q = q.where(Deal.expected_close <= close_before)
    q = q.order_by(Deal.created_at.desc())

    result = await db.execute(q)
    deals = result.scalars().all()

    headers = [
        "id", "titre", "montant_eur", "devise", "probabilite_%", "étape",
        "origine", "date_clôture_prévue", "tags", "notes", "date_création",
    ]
    rows = [
        [
            str(d.id), d.title, str(d.amount), d.currency,
            str(d.probability), d.stage, d.origin or "",
            _fmt_date(d.expected_close), ",".join(d.tags or []),
            d.notes or "", _fmt_date(d.created_at),
        ]
        for d in deals
    ]
    return _csv_response(rows, headers, f"deals_{_today()}.csv")


# ── GET /export/projects ──────────────────────────────────────────────────────

@router.get("/projects")
async def export_projects(
    db: DB,
    current_user: CurrentUser,
    status: str | None = Query(default=None),
) -> StreamingResponse:
    """Export CSV des missions (projects)."""
    q = select(Project).where(Project.deleted_at.is_(None))
    if status:
        q = q.where(Project.status == status)
    q = q.order_by(Project.created_at.desc())

    result = await db.execute(q)
    projects = result.scalars().all()

    headers = [
        "id", "titre", "statut", "type_tarif", "valeur_tarif",
        "budget_montant", "date_début", "date_fin", "notes", "date_création",
    ]
    rows = [
        [
            str(p.id), p.title, p.status, p.rate_type,
            str(p.rate_value), str(p.budget_amount or ""),
            _fmt_date(p.start_date), _fmt_date(p.end_date),
            p.notes or "", _fmt_date(p.created_at),
        ]
        for p in projects
    ]
    return _csv_response(rows, headers, f"projects_{_today()}.csv")


# ── GET /export/contacts ──────────────────────────────────────────────────────

@router.get("/contacts")
async def export_contacts(
    db: DB,
    current_user: CurrentUser,
    tag: str | None = Query(default=None),
) -> StreamingResponse:
    """Export CSV des contacts, inclut le champ consentement RGPD."""
    q = select(Contact).where(Contact.deleted_at.is_(None))
    if tag:
        q = q.where(Contact.tags.any(tag))
    q = q.order_by(Contact.last_name, Contact.first_name)

    result = await db.execute(q)
    contacts = result.scalars().all()

    # Batch-load companies
    cids = {c.company_id for c in contacts if c.company_id}
    company_map: dict[uuid.UUID, str] = {}
    if cids:
        comp_rows = await db.execute(select(Company.id, Company.name).where(Company.id.in_(cids)))
        company_map = {row.id: row.name for row in comp_rows}

    headers = [
        "id", "prénom", "nom", "email", "téléphone", "rôle",
        "entreprise", "tags", "consentement_rgpd", "date_consentement",
        "anonymisé", "date_création",
    ]
    rows = [
        [
            str(c.id), c.first_name, c.last_name, c.email,
            c.phone or "", c.role or "",
            company_map.get(c.company_id, "") if c.company_id else "",  # type: ignore[arg-type]
            ",".join(c.tags or []),
            "oui" if c.consent_rgpd else "non",
            _fmt_date(c.consent_date),
            "oui" if c.anonymized_at else "non",
            _fmt_date(c.created_at),
        ]
        for c in contacts
    ]
    return _csv_response(rows, headers, f"contacts_{_today()}.csv")
