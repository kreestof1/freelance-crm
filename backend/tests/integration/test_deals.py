"""Tests d'intégration — Deals (Sprint 2)."""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio


async def _get_token(client: AsyncClient, email: str = "deals_user@example.com") -> str:
    await client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Password123!", "name": "Deals User"},
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "Password123!"},
    )
    return resp.json()["access_token"]


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    token = await _get_token(client)
    return {"Authorization": f"Bearer {token}"}


# ── CRUD ──────────────────────────────────────────────────────────────────────

async def test_create_deal(client: AsyncClient, auth_headers: dict) -> None:
    resp = await client.post(
        "/api/v1/deals",
        json={
            "title": "Refonte site e-commerce",
            "amount": "15000.00",
            "probability": 50,
            "stage": "Proposition",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Refonte site e-commerce"
    assert data["stage"] == "Proposition"
    assert float(data["weighted_amount"]) == 7500.0


async def test_list_deals(client: AsyncClient, auth_headers: dict) -> None:
    # Créer 2 deals
    for title in ("Deal A", "Deal B"):
        await client.post(
            "/api/v1/deals",
            json={"title": title, "amount": "1000", "stage": "Découverte"},
            headers=auth_headers,
        )
    resp = await client.get("/api/v1/deals", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 2


async def test_get_deal(client: AsyncClient, auth_headers: dict) -> None:
    create_resp = await client.post(
        "/api/v1/deals",
        json={"title": "Deal Detail Test", "amount": "5000", "stage": "Qualification"},
        headers=auth_headers,
    )
    deal_id = create_resp.json()["id"]
    resp = await client.get(f"/api/v1/deals/{deal_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == deal_id


async def test_patch_deal(client: AsyncClient, auth_headers: dict) -> None:
    create_resp = await client.post(
        "/api/v1/deals",
        json={"title": "Deal Patch", "amount": "2000", "stage": "Découverte"},
        headers=auth_headers,
    )
    deal_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/deals/{deal_id}",
        json={"probability": 75, "notes": "Bon contact"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["probability"] == 75


async def test_delete_deal(client: AsyncClient, auth_headers: dict) -> None:
    create_resp = await client.post(
        "/api/v1/deals",
        json={"title": "Delete Me", "amount": "500", "stage": "Découverte"},
        headers=auth_headers,
    )
    deal_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/v1/deals/{deal_id}", headers=auth_headers)
    assert resp.status_code == 204
    # Vérifier qu'il a disparu
    get_resp = await client.get(f"/api/v1/deals/{deal_id}", headers=auth_headers)
    assert get_resp.status_code == 404


# ── Move (Kanban) ─────────────────────────────────────────────────────────────

async def test_move_deal_changes_stage(client: AsyncClient, auth_headers: dict) -> None:
    create_resp = await client.post(
        "/api/v1/deals",
        json={"title": "Move Test", "amount": "8000", "stage": "Découverte"},
        headers=auth_headers,
    )
    deal_id = create_resp.json()["id"]
    resp = await client.post(
        f"/api/v1/deals/{deal_id}/move",
        json={"stage": "Proposition"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["stage"] == "Proposition"


async def test_move_to_won_locks_deal(client: AsyncClient, auth_headers: dict) -> None:
    create_resp = await client.post(
        "/api/v1/deals",
        json={"title": "Won Deal", "amount": "12000", "stage": "Négociation"},
        headers=auth_headers,
    )
    deal_id = create_resp.json()["id"]
    resp = await client.post(
        f"/api/v1/deals/{deal_id}/move",
        json={"stage": "Gagné"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_locked"] is True
    assert data["probability"] == 100


async def test_patch_locked_deal_amount_raises_422(client: AsyncClient, auth_headers: dict) -> None:
    """Un deal Gagné (verrouillé) ne peut pas voir son montant modifié."""
    create_resp = await client.post(
        "/api/v1/deals",
        json={"title": "Locked Deal", "amount": "5000", "stage": "Négociation"},
        headers=auth_headers,
    )
    deal_id = create_resp.json()["id"]
    await client.post(
        f"/api/v1/deals/{deal_id}/move",
        json={"stage": "Gagné"},
        headers=auth_headers,
    )
    patch_resp = await client.patch(
        f"/api/v1/deals/{deal_id}",
        json={"amount": "9999"},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 422


async def test_move_to_lost_sets_probability_zero(client: AsyncClient, auth_headers: dict) -> None:
    create_resp = await client.post(
        "/api/v1/deals",
        json={"title": "Lost Deal", "amount": "3000", "probability": 60, "stage": "Proposition"},
        headers=auth_headers,
    )
    deal_id = create_resp.json()["id"]
    resp = await client.post(
        f"/api/v1/deals/{deal_id}/move",
        json={"stage": "Perdu"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["probability"] == 0


# ── Weighted amount ───────────────────────────────────────────────────────────

async def test_weighted_amount_computed(client: AsyncClient, auth_headers: dict) -> None:
    """weighted_amount = amount * probability / 100."""
    resp = await client.post(
        "/api/v1/deals",
        json={"title": "Weighted", "amount": "10000", "probability": 25, "stage": "Qualification"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert float(resp.json()["weighted_amount"]) == 2500.0


# ── Pipeline stages ───────────────────────────────────────────────────────────

async def test_get_pipeline_stages(client: AsyncClient, auth_headers: dict) -> None:
    resp = await client.get("/api/v1/pipeline/stages", headers=auth_headers)
    assert resp.status_code == 200
    stages = resp.json()
    assert len(stages) >= 6
    names = [s["name"] for s in stages]
    assert "Gagné" in names
    assert "Perdu" in names


# ── Dashboard ─────────────────────────────────────────────────────────────────

async def test_dashboard_pipeline(client: AsyncClient, auth_headers: dict) -> None:
    resp = await client.get("/api/v1/dashboard/pipeline", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "stages" in data
    assert "total_count" in data


async def test_dashboard_forecast(client: AsyncClient, auth_headers: dict) -> None:
    resp = await client.get("/api/v1/dashboard/forecast", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "current_month" in data
    assert "next_3_months" in data
    assert len(data["next_3_months"]) == 3
