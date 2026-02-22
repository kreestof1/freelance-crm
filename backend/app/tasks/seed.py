"""Script de seeding — données initiales et de démonstration.

Usage :
    python -m app.tasks.seed               # données initiales seulement
    python -m app.tasks.seed --demo        # + données de démo (contacts, leads, deals)
"""
from __future__ import annotations

import asyncio
import sys
import uuid
from datetime import date, timedelta

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal
from app.models.company import Company
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.lead import Lead
from app.models.pipeline_stage import DEFAULT_STAGES, PipelineStage
from app.models.user import User
from app.utils.security import hash_password

log = structlog.get_logger(__name__)

# ── Données initiales ─────────────────────────────────────────────────────────

ADMIN_EMAIL = "admin@crm.local"
ADMIN_PASSWORD = "admin1234"
ADMIN_NAME = "Administrateur"

# ── Démonstration ─────────────────────────────────────────────────────────────

DEMO_COMPANIES = [
    {"name": "Acme Corp", "sector": "Tech", "website": "https://acme.example.com", "tags": ["client", "prioritaire"]},
    {"name": "Beta Solutions", "sector": "Conseil", "website": "https://beta.example.com", "tags": ["prospect"]},
    {"name": "Gamma Industries", "sector": "Industrie", "tags": []},
]

DEMO_CONTACTS = [
    {"first_name": "Alice", "last_name": "Martin", "email": "alice@acme.example.com", "role": "CTO", "tags": ["décideur"]},
    {"first_name": "Bob", "last_name": "Dupont", "email": "bob@beta.example.com", "role": "DG", "tags": []},
    {"first_name": "Claire", "last_name": "Durand", "email": "claire@gamma.example.com", "role": "DSI", "tags": ["technique"]},
]

DEMO_LEADS = [
    {
        "name": "David Leroy", "email": "david@startup.example.com",
        "status": "Nouveau", "source": "réseau",
        "score": 60, "interest": "Développement IA", "tags": ["ia"],
    },
    {
        "name": "Emma Blanc", "email": "emma@grands.example.com",
        "status": "Qualifié", "source": "recommandation",
        "score": 80, "interest": "Audit infrastructure", "tags": [],
    },
]


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _seed_pipeline_stages(db: AsyncSession) -> None:
    result = await db.execute(select(PipelineStage))
    if result.scalars().first() is not None:
        log.info("seed.pipeline_stages.skip", reason="already_present")
        return
    stages = [PipelineStage(**s) for s in DEFAULT_STAGES]
    db.add_all(stages)
    await db.flush()
    log.info("seed.pipeline_stages.created", count=len(stages))


async def _seed_admin_user(db: AsyncSession) -> User:
    result = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
    user = result.scalar_one_or_none()
    if user:
        log.info("seed.admin_user.skip", reason="already_exists", email=ADMIN_EMAIL)
        return user
    user = User(
        id=uuid.uuid4(),
        email=ADMIN_EMAIL,
        password_hash=hash_password(ADMIN_PASSWORD),
        name=ADMIN_NAME,
        role="owner",
    )
    db.add(user)
    await db.flush()
    log.info("seed.admin_user.created", email=ADMIN_EMAIL)
    return user


async def _seed_demo_data(db: AsyncSession) -> None:
    # -- Entreprises
    company_map: dict[str, Company] = {}
    for item in DEMO_COMPANIES:
        result = await db.execute(select(Company).where(Company.name == item["name"]))
        existing = result.scalar_one_or_none()
        if existing:
            company_map[item["name"]] = existing
            continue
        company = Company(**item)
        db.add(company)
        await db.flush()
        company_map[item["name"]] = company
    log.info("seed.demo.companies", count=len(company_map))

    # -- Contacts
    company_names = list(company_map.keys())
    for i, item in enumerate(DEMO_CONTACTS):
        result = await db.execute(select(Contact).where(Contact.email == item["email"]))
        if result.scalar_one_or_none():
            continue
        company_name = company_names[i % len(company_names)]
        contact = Contact(**item, company_id=company_map[company_name].id)
        db.add(contact)
        await db.flush()
    log.info("seed.demo.contacts", count=len(DEMO_CONTACTS))

    # -- Leads
    for item in DEMO_LEADS:
        result = await db.execute(select(Lead).where(Lead.email == item["email"]))
        if result.scalar_one_or_none():
            continue
        lead = Lead(**item)
        db.add(lead)
        await db.flush()
    log.info("seed.demo.leads", count=len(DEMO_LEADS))

    # -- Deals (1 par entreprise, sur la première étape)
    result = await db.execute(select(PipelineStage).order_by(PipelineStage.order).limit(1))
    first_stage = result.scalar_one_or_none()
    stage_name = first_stage.name if first_stage else "Découverte"
    for name, company in company_map.items():
        result = await db.execute(
            select(Deal).where(Deal.title == f"Mission {name}")
        )
        if result.scalar_one_or_none():
            continue
        deal = Deal(
            title=f"Mission {name}",
            stage=stage_name,
            company_id=company.id,
            amount=20000.0,
            probability=first_stage.default_probability if first_stage else 10,
            expected_close=date.today() + timedelta(days=60),
        )
        db.add(deal)
        await db.flush()
    log.info("seed.demo.deals", count=len(company_map))


# ── Entrypoint ────────────────────────────────────────────────────────────────

async def main(demo: bool = False) -> None:
    log.info("seed.start", demo=demo)

    async with AsyncSessionLocal() as db:
        async with db.begin():
            await _seed_pipeline_stages(db)
            await _seed_admin_user(db)
            if demo:
                await _seed_demo_data(db)

    log.info("seed.done")
    print("\n✅  Seed terminé.")
    if not demo:
        print("   Ajoutez --demo pour insérer des données de démonstration.")
    print(f"   Compte admin : {ADMIN_EMAIL} / {ADMIN_PASSWORD}\n")


if __name__ == "__main__":
    demo_flag = "--demo" in sys.argv
    asyncio.run(main(demo=demo_flag))
