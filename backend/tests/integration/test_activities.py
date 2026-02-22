"""Tests d'intégration — Activités (Sprint 4)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.utils.security import create_access_token


def _auth(user: User) -> dict[str, str]:
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _create_activity(
    client: AsyncClient,
    user: User,
    *,
    type: str = "Tâche",
    when: datetime | None = None,
    notes: str = "test note",
    reminder_at: datetime | None = None,
) -> dict:
    payload: dict = {
        "type": type,
        "when": (when or datetime.now(timezone.utc)).isoformat(),
        "notes": notes,
    }
    if reminder_at:
        payload["reminder_at"] = reminder_at.isoformat()
    resp = await client.post("/api/v1/activities", json=payload, headers=_auth(user))
    assert resp.status_code == 201, resp.text
    return resp.json()


# ── Tests CRUD ────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_activity(client: AsyncClient, test_user: User) -> None:
    data = await _create_activity(client, test_user, type="Appel", notes="Premier appel")
    assert data["type"] == "Appel"
    assert data["notes"] == "Premier appel"
    assert data["reminder_sent"] is False


@pytest.mark.asyncio
async def test_create_activity_all_types(client: AsyncClient, test_user: User) -> None:
    for t in ["Appel", "Email", "Tâche", "RDV"]:
        data = await _create_activity(client, test_user, type=t)
        assert data["type"] == t


@pytest.mark.asyncio
async def test_create_activity_invalid_type(client: AsyncClient, test_user: User) -> None:
    now = datetime.now(timezone.utc)
    resp = await client.post(
        "/api/v1/activities",
        json={"type": "SMS", "when": now.isoformat()},
        headers=_auth(test_user),
    )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_list_activities_empty(client: AsyncClient, test_user: User) -> None:
    resp = await client.get("/api/v1/activities", headers=_auth(test_user))
    assert resp.status_code == 200
    body = resp.json()
    assert "items" in body
    assert "total" in body


@pytest.mark.asyncio
async def test_list_activities_filter_by_type(
    client: AsyncClient, test_user: User
) -> None:
    await _create_activity(client, test_user, type="Appel")
    await _create_activity(client, test_user, type="Email")
    resp = await client.get(
        "/api/v1/activities", params={"type": "Appel"}, headers=_auth(test_user)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert all(item["type"] == "Appel" for item in body["items"])


@pytest.mark.asyncio
async def test_get_activity(client: AsyncClient, test_user: User) -> None:
    created = await _create_activity(client, test_user, notes="get me")
    resp = await client.get(
        f"/api/v1/activities/{created['id']}", headers=_auth(test_user)
    )
    assert resp.status_code == 200
    assert resp.json()["notes"] == "get me"


@pytest.mark.asyncio
async def test_get_activity_not_found(client: AsyncClient, test_user: User) -> None:
    import uuid
    resp = await client.get(
        f"/api/v1/activities/{uuid.uuid4()}", headers=_auth(test_user)
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_patch_activity(client: AsyncClient, test_user: User) -> None:
    created = await _create_activity(client, test_user, notes="original")
    resp = await client.patch(
        f"/api/v1/activities/{created['id']}",
        json={"notes": "modifié", "outcome": "RAS"},
        headers=_auth(test_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["notes"] == "modifié"
    assert data["outcome"] == "RAS"


@pytest.mark.asyncio
async def test_delete_activity(client: AsyncClient, test_user: User) -> None:
    created = await _create_activity(client, test_user)
    resp = await client.delete(
        f"/api/v1/activities/{created['id']}", headers=_auth(test_user)
    )
    assert resp.status_code == 204
    # Vérifier que c'est introuvable
    resp2 = await client.get(
        f"/api/v1/activities/{created['id']}", headers=_auth(test_user)
    )
    assert resp2.status_code == 404


@pytest.mark.asyncio
async def test_activity_with_reminder(
    client: AsyncClient, test_user: User
) -> None:
    future = datetime.now(timezone.utc) + timedelta(hours=2)
    created = await _create_activity(client, test_user, reminder_at=future)
    assert created["reminder_at"] is not None
    assert created["reminder_sent"] is False


@pytest.mark.asyncio
async def test_upcoming_activities(
    client: AsyncClient, test_user: User
) -> None:
    # Créer un rappel dans 1h (dans la fenêtre de 48h)
    soon = datetime.now(timezone.utc) + timedelta(hours=1)
    await _create_activity(client, test_user, reminder_at=soon)

    resp = await client.get(
        "/api/v1/activities/upcoming", headers=_auth(test_user)
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] >= 1
    assert all(item["reminder_at"] is not None for item in body["items"])


@pytest.mark.asyncio
async def test_activity_related_type(
    client: AsyncClient, test_user: User, db_session: AsyncSession
) -> None:
    """Une activité peut être liée à un deal via related_type/related_id."""
    import uuid
    fake_deal_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    resp = await client.post(
        "/api/v1/activities",
        json={
            "type": "RDV",
            "when": now.isoformat(),
            "related_type": "deal",
            "related_id": fake_deal_id,
        },
        headers=_auth(test_user),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["related_type"] == "deal"
    assert data["related_id"] == fake_deal_id


@pytest.mark.asyncio
async def test_list_filter_by_related(
    client: AsyncClient, test_user: User
) -> None:
    import uuid
    rid = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    # Créer une activité liée
    await client.post(
        "/api/v1/activities",
        json={"type": "Email", "when": now.isoformat(), "related_type": "project", "related_id": rid},
        headers=_auth(test_user),
    )
    # Créer une activité non liée
    await _create_activity(client, test_user)

    resp = await client.get(
        "/api/v1/activities",
        params={"related_type": "project", "related_id": rid},
        headers=_auth(test_user),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert all(item["related_id"] == rid for item in body["items"])


@pytest.mark.asyncio
async def test_activity_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/activities")
    assert resp.status_code == 401
