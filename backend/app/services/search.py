"""Service Recherche globale — PostgreSQL full-text search."""
from __future__ import annotations

from sqlalchemy import cast, func, literal, or_, select, text, union_all
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.lead import Lead
from app.models.project import Project
from app.schemas.search import SearchHit, SearchResult

# Nombre maximum de résultats par type et au total
MAX_RESULTS = 50
MAX_PER_TYPE = 15


async def global_search(
    db: AsyncSession,
    query: str,
    types: list[str] | None = None,
    limit: int = 20,
) -> SearchResult:
    """Recherche full-text sur contacts, entreprises, leads, deals, missions.

    Utilise `to_tsvector` / `plainto_tsquery` PostgreSQL (config 'french').
    """
    q = query.strip()
    if not q:
        return SearchResult(hits=[], total=0, query=query)

    limit = min(limit, MAX_RESULTS)
    allowed = types or ["contact", "company", "lead", "deal", "project"]

    hits: list[SearchHit] = []

    # ── Contacts ──────────────────────────────────────────────────────────────
    if "contact" in allowed:
        rows = await db.execute(
            select(
                Contact.id,
                Contact.first_name,
                Contact.last_name,
                Contact.email,
            )
            .where(
                Contact.deleted_at.is_(None),
                or_(
                    func.to_tsvector("french",
                        func.coalesce(Contact.first_name, "") + " " +
                        func.coalesce(Contact.last_name, "") + " " +
                        func.coalesce(Contact.email, "") + " " +
                        func.coalesce(Contact.notes, "")
                    ).op("@@")(func.plainto_tsquery("french", q)),
                    (Contact.first_name + " " + Contact.last_name).ilike(f"%{q}%"),
                    Contact.email.ilike(f"%{q}%"),
                ),
            )
            .order_by(
                func.ts_rank(
                    func.to_tsvector("french",
                        func.coalesce(Contact.first_name, "") + " " +
                        func.coalesce(Contact.last_name, "")
                    ),
                    func.plainto_tsquery("french", q),
                ).desc()
            )
            .limit(MAX_PER_TYPE)
        )
        for row in rows:
            hits.append(SearchHit(
                type="contact",
                id=str(row.id),
                title=f"{row.first_name} {row.last_name}".strip(),
                excerpt=row.email,
            ))

    # ── Entreprises ───────────────────────────────────────────────────────────
    if "company" in allowed:
        rows = await db.execute(
            select(Company.id, Company.name, Company.sector)
            .where(
                Company.deleted_at.is_(None),
                or_(
                    func.to_tsvector("french",
                        func.coalesce(Company.name, "") + " " +
                        func.coalesce(Company.sector, "") + " " +
                        func.coalesce(Company.notes, "")
                    ).op("@@")(func.plainto_tsquery("french", q)),
                    Company.name.ilike(f"%{q}%"),
                ),
            )
            .order_by(
                func.ts_rank(
                    func.to_tsvector("french", func.coalesce(Company.name, "")),
                    func.plainto_tsquery("french", q),
                ).desc()
            )
            .limit(MAX_PER_TYPE)
        )
        for row in rows:
            hits.append(SearchHit(
                type="company",
                id=str(row.id),
                title=row.name,
                excerpt=row.sector,
            ))

    # ── Leads ─────────────────────────────────────────────────────────────────
    if "lead" in allowed:
        rows = await db.execute(
            select(Lead.id, Lead.name, Lead.email, Lead.status)
            .where(
                Lead.deleted_at.is_(None),
                or_(
                    func.to_tsvector("french",
                        func.coalesce(Lead.name, "") + " " +
                        func.coalesce(Lead.email, "") + " " +
                        func.coalesce(Lead.interest, "") + " " +
                        func.coalesce(Lead.notes, "")
                    ).op("@@")(func.plainto_tsquery("french", q)),
                    Lead.name.ilike(f"%{q}%"),
                    Lead.email.ilike(f"%{q}%"),
                ),
            )
            .limit(MAX_PER_TYPE)
        )
        for row in rows:
            hits.append(SearchHit(
                type="lead",
                id=str(row.id),
                title=row.name,
                excerpt=row.email,
            ))

    # ── Deals ─────────────────────────────────────────────────────────────────
    if "deal" in allowed:
        rows = await db.execute(
            select(Deal.id, Deal.title, Deal.stage, Deal.notes)
            .where(
                Deal.deleted_at.is_(None),
                or_(
                    func.to_tsvector("french",
                        func.coalesce(Deal.title, "") + " " +
                        func.coalesce(Deal.notes, "") + " " +
                        func.coalesce(Deal.origin, "")
                    ).op("@@")(func.plainto_tsquery("french", q)),
                    Deal.title.ilike(f"%{q}%"),
                ),
            )
            .limit(MAX_PER_TYPE)
        )
        for row in rows:
            hits.append(SearchHit(
                type="deal",
                id=str(row.id),
                title=row.title,
                excerpt=row.stage,
            ))

    # ── Missions ──────────────────────────────────────────────────────────────
    if "project" in allowed:
        rows = await db.execute(
            select(Project.id, Project.title, Project.status, Project.notes)
            .where(
                Project.deleted_at.is_(None),
                or_(
                    func.to_tsvector("french",
                        func.coalesce(Project.title, "") + " " +
                        func.coalesce(Project.notes, "")
                    ).op("@@")(func.plainto_tsquery("french", q)),
                    Project.title.ilike(f"%{q}%"),
                ),
            )
            .limit(MAX_PER_TYPE)
        )
        for row in rows:
            hits.append(SearchHit(
                type="project",
                id=str(row.id),
                title=row.title,
                excerpt=row.status,
            ))

    # Limiter au total demandé
    hits = hits[:limit]
    return SearchResult(hits=hits, total=len(hits), query=query)
