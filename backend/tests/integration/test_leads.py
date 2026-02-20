"""Tests d'intégration — /api/v1/leads."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


async def auth_header(client: AsyncClient) -> dict[str, str]:
    resp = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "Password123!",
    })
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


@pytest.mark.asyncio
async def test_list_leads_empty(client: AsyncClient):
    headers = await auth_header(client)
    resp = await client.get("/api/v1/leads", headers=headers)
    assert resp.status_code == 200
    assert "items" in resp.json()


@pytest.mark.asyncio
async def test_create_lead(client: AsyncClient):
    headers = await auth_header(client)
    resp = await client.post("/api/v1/leads", headers=headers, json={
        "name": "Paul Arnaud",
        "email": "paul@arnaud.fr",
        "source": "web",
        "tags": ["inbound"],
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Paul Arnaud"
    assert body["status"] == "Nouveau"


@pytest.mark.asyncio
async def test_get_lead(client: AsyncClient):
    headers = await auth_header(client)
    lid = (await client.post("/api/v1/leads", headers=headers, json={
        "name": "Clara Sion", "source": "referral",
    })).json()["id"]

    resp = await client.get(f"/api/v1/leads/{lid}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == lid


@pytest.mark.asyncio
async def test_patch_lead(client: AsyncClient):
    headers = await auth_header(client)
    lid = (await client.post("/api/v1/leads", headers=headers, json={
        "name": "Marc Orion", "source": "linkedin",
    })).json()["id"]

    resp = await client.patch(f"/api/v1/leads/{lid}", headers=headers, json={"status": "Qualifié", "score": 60})
    assert resp.status_code == 200
    assert resp.json()["status"] == "Qualifié"
    assert resp.json()["score"] == 60


@pytest.mark.asyncio
async def test_delete_lead(client: AsyncClient):
    headers = await auth_header(client)
    lid = (await client.post("/api/v1/leads", headers=headers, json={
        "name": "To Delete", "source": "other",
    })).json()["id"]

    assert (await client.delete(f"/api/v1/leads/{lid}", headers=headers)).status_code == 204
    assert (await client.get(f"/api/v1/leads/{lid}", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_convert_lead(client: AsyncClient):
    headers = await auth_header(client)
    lead_id = (await client.post("/api/v1/leads", headers=headers, json={
        "name": "Sophie Duval", "email": "sophie@duval.fr", "source": "web",
    })).json()["id"]

    resp = await client.post(f"/api/v1/leads/{lead_id}/convert", headers=headers, json={
        "deal_title": "Contrat Sophie",
        "deal_amount": 3000.0,
        "deal_stage": "Proposal",
        "create_contact": True,
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["contact_id"] is not None
    assert body["deal_id"] is not None
    assert body["lead_id"] == lead_id


@pytest.mark.asyncio
async def test_convert_lead_twice_returns_409(client: AsyncClient):
    headers = await auth_header(client)
    lead_id = (await client.post("/api/v1/leads", headers=headers, json={
        "name": "Double Convert", "source": "other",
    })).json()["id"]

    convert_payload = {"deal_title": "Deal1", "deal_amount": 0}
    resp1 = await client.post(f"/api/v1/leads/{lead_id}/convert", headers=headers, json=convert_payload)
    assert resp1.status_code == 201

    resp2 = await client.post(f"/api/v1/leads/{lead_id}/convert", headers=headers, json=convert_payload)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_list_leads_filter_status(client: AsyncClient):
    headers = await auth_header(client)
    await client.post("/api/v1/leads", headers=headers, json={"name": "Filter Lead", "source": "web"})

    resp = await client.get("/api/v1/leads?status=Nouveau", headers=headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(l["status"] == "Nouveau" for l in items)
