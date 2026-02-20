"""Tests unitaires — Conversion Lead + Fusion Contacts."""
from __future__ import annotations

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.contact import Contact
from app.models.lead import Lead
from app.models.user import User
from app.schemas.leads import LeadConvertRequest
from app.services.contacts import merge_contacts
from app.services.leads import convert_lead, create_lead, patch_lead
from app.schemas.leads import LeadCreate, LeadPatch


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def company(db_session: AsyncSession) -> Company:
    c = Company(name="Acme Corp", tags=[])
    db_session.add(c)
    await db_session.flush()
    return c


@pytest_asyncio.fixture
async def lead(db_session: AsyncSession, company: Company) -> Lead:
    l = Lead(
        name="Jean Dupont",
        email="jean@acme.com",
        source="web",
        status="Nouveau",
        notes="Prospect chaud",
        tags=["startup", "tech"],
        company_id=company.id,
    )
    db_session.add(l)
    await db_session.flush()
    return l


@pytest_asyncio.fixture
async def contact_a(db_session: AsyncSession) -> Contact:
    c = Contact(
        first_name="Marie", last_name="Martin",
        email="marie@test.com", tags=["client"],
    )
    db_session.add(c)
    await db_session.flush()
    return c


@pytest_asyncio.fixture
async def contact_b(db_session: AsyncSession) -> Contact:
    c = Contact(
        first_name="Marie", last_name="Martin",
        email="marie.martin@test.com", tags=["vip"],
    )
    db_session.add(c)
    await db_session.flush()
    return c


# ── Tests Conversion Lead ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_convert_lead_creates_contact_and_deal(db_session: AsyncSession, lead: Lead):
    """La conversion doit créer un Contact, un Deal, et passer le lead en Converti."""
    result = await convert_lead(
        db_session,
        lead,
        LeadConvertRequest(
            deal_title="Contrat Acme",
            deal_amount=5000.0,
            deal_stage="Qualification",
        ),
    )
    assert result.contact_id is not None
    assert result.deal_id is not None
    assert lead.status == "Converti"
    assert lead.contact_id == result.contact_id


@pytest.mark.asyncio
async def test_convert_lead_transfers_notes(db_session: AsyncSession, lead: Lead):
    """Les notes et tags du lead doivent être copiés dans le Deal créé."""
    from sqlalchemy import select
    from app.models.deal import Deal

    await convert_lead(db_session, lead, LeadConvertRequest(deal_title="Test", deal_amount=0))
    deal_row = await db_session.execute(select(Deal).where(Deal.notes == lead.notes))
    deal = deal_row.scalar_one_or_none()
    assert deal is not None
    assert "startup" in deal.tags


@pytest.mark.asyncio
async def test_convert_lead_normalizes_name(db_session: AsyncSession):
    """Un lead avec un seul mot dans le nom ne doit pas planter."""
    lead = Lead(name="Horizon", email="contact@horizon.io", source="other", tags=[])
    db_session.add(lead)
    await db_session.flush()
    result = await convert_lead(db_session, lead, LeadConvertRequest(deal_title="Projet Horizon", deal_amount=0))
    assert result.contact_id is not None


@pytest.mark.asyncio
async def test_patch_lead_status(db_session: AsyncSession, lead: Lead):
    """PATCH statut doit mettre à jour uniquement le champ demandé."""
    updated = await patch_lead(db_session, lead, LeadPatch(status="Qualifié", score=75))
    assert updated.status == "Qualifié"
    assert updated.score == 75
    assert updated.name == "Jean Dupont"  # inchangé


# ── Tests Fusion Contacts ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_merge_contacts_soft_deletes_source(
    db_session: AsyncSession, contact_a: Contact, contact_b: Contact
):
    """La source doit être soft-deleted après fusion."""
    await merge_contacts(db_session, source=contact_a, target=contact_b)
    assert contact_a.deleted_at is not None
    assert contact_b.deleted_at is None


@pytest.mark.asyncio
async def test_merge_contacts_merges_tags(
    db_session: AsyncSession, contact_a: Contact, contact_b: Contact
):
    """Les tags des deux contacts doivent être fusionnés sur la cible."""
    merged = await merge_contacts(db_session, source=contact_a, target=contact_b)
    assert "client" in merged.tags
    assert "vip" in merged.tags


@pytest.mark.asyncio
async def test_merge_contacts_reassigns_activities(
    db_session: AsyncSession, contact_a: Contact, contact_b: Contact
):
    """Les activités du contact source doivent être réattribuées à la cible."""
    from app.models.activity import Activity

    act = Activity(
        type="call",
        related_type="contact",
        related_id=contact_a.id,
        tags=[],
    )
    db_session.add(act)
    await db_session.flush()

    await merge_contacts(db_session, source=contact_a, target=contact_b)
    await db_session.refresh(act)
    assert act.related_id == contact_b.id
