"""Tests d'intégration — Recherche globale (Sprint 4)."""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.company import Company
from app.models.contact import Contact
from app.models.lead import Lead
from app.models.user import User
from app.utils.security import create_access_token


def _auth(user: User) -> dict[str, str]:
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
async def search_fixtures(db_session: AsyncSession) -> None:
    """Insère des entités de test pour la recherche."""
    company = Company(name="Acme Corp", sector="Technologie")
    db_session.add(company)
    await db_session.flush()

    contact = Contact(
        first_name="Alice",
        last_name="Acme",
        email="alice@acme.test",
        company_id=company.id,
    )
    db_session.add(contact)

    lead = Lead(
        name="Bob Acme",
        email="bob@acme.test",
        status="Nouveau",
        source="réseau",
    )
    db_session.add(lead)
    await db_session.flush()


# ── Tests ─────────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_search_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/search", params={"q": "acme"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_search_empty_query(client: AsyncClient, test_user: User) -> None:
    resp = await client.get("/api/v1/search", params={"q": " "}, headers=_auth(test_user))
    # q has min_length=1, single space should still return empty
    assert resp.status_code in (200, 422)


@pytest.mark.asyncio
async def test_search_no_results(client: AsyncClient, test_user: User) -> None:
    resp = await client.get(
        "/api/v1/search",
        params={"q": "xyznotexistant12345abcdef"},
        headers=_auth(test_user),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 0
    assert body["hits"] == []


@pytest.mark.asyncio
async def test_search_company_by_name(
    client: AsyncClient, test_user: User, search_fixtures: None
) -> None:
    resp = await client.get(
        "/api/v1/search", params={"q": "Acme"}, headers=_auth(test_user)
    )
    assert resp.status_code == 200
    body = resp.json()
    types_found = {h["type"] for h in body["hits"]}
    assert "company" in types_found or "contact" in types_found or "lead" in types_found


@pytest.mark.asyncio
async def test_search_contact_by_email(
    client: AsyncClient, test_user: User, search_fixtures: None
) -> None:
    resp = await client.get(
        "/api/v1/search", params={"q": "alice@acme"}, headers=_auth(test_user)
    )
    assert resp.status_code == 200
    body = resp.json()
    contact_hits = [h for h in body["hits"] if h["type"] == "contact"]
    assert len(contact_hits) >= 1


@pytest.mark.asyncio
async def test_search_filter_by_type(
    client: AsyncClient, test_user: User, search_fixtures: None
) -> None:
    resp = await client.get(
        "/api/v1/search",
        params={"q": "Acme", "types": "company"},
        headers=_auth(test_user),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert all(h["type"] == "company" for h in body["hits"])


@pytest.mark.asyncio
async def test_search_invalid_type_ignored(
    client: AsyncClient, test_user: User
) -> None:
    """Les types invalides sont ignorés, la recherche porte sur tout."""
    resp = await client.get(
        "/api/v1/search",
        params={"q": "test", "types": "invalid,also_bad"},
        headers=_auth(test_user),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "hits" in body


@pytest.mark.asyncio
async def test_search_limit(client: AsyncClient, test_user: User) -> None:
    resp = await client.get(
        "/api/v1/search",
        params={"q": "a", "limit": 3},
        headers=_auth(test_user),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["hits"]) <= 3


@pytest.mark.asyncio
async def test_search_returns_query_echo(
    client: AsyncClient, test_user: User
) -> None:
    resp = await client.get(
        "/api/v1/search", params={"q": "monterme"}, headers=_auth(test_user)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["query"] == "monterme"


@pytest.mark.asyncio
async def test_search_hit_structure(
    client: AsyncClient, test_user: User, search_fixtures: None
) -> None:
    resp = await client.get(
        "/api/v1/search", params={"q": "Alice"}, headers=_auth(test_user)
    )
    assert resp.status_code == 200
    body = resp.json()
    for hit in body["hits"]:
        assert "type" in hit
        assert "id" in hit
        assert "title" in hit
