"""Tests d'intégration — /api/v1/companies."""
from __future__ import annotations

import pytest
from httpx import AsyncClient


# ── Helpers ───────────────────────────────────────────────────────────────────

async def auth_header(client: AsyncClient) -> dict[str, str]:
    resp = await client.post("/api/v1/auth/login", json={
        "email": "test@example.com",
        "password": "Password123!",
    })
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


# ── Tests CRUD Entreprises ─────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_companies_empty(client: AsyncClient):
    headers = await auth_header(client)
    resp = await client.get("/api/v1/companies", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_create_company(client: AsyncClient):
    headers = await auth_header(client)
    resp = await client.post("/api/v1/companies", headers=headers, json={
        "name": "Acme Corp",
        "sector": "Tech",
        "tags": ["startup"],
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Acme Corp"
    assert body["id"] is not None


@pytest.mark.asyncio
async def test_get_company(client: AsyncClient):
    headers = await auth_header(client)
    create = await client.post("/api/v1/companies", headers=headers, json={"name": "Beta SA"})
    cid = create.json()["id"]

    resp = await client.get(f"/api/v1/companies/{cid}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == cid


@pytest.mark.asyncio
async def test_update_company(client: AsyncClient):
    headers = await auth_header(client)
    create = await client.post("/api/v1/companies", headers=headers, json={"name": "Gamma"})
    cid = create.json()["id"]

    resp = await client.put(f"/api/v1/companies/{cid}", headers=headers, json={"sector": "Finance"})
    assert resp.status_code == 200
    assert resp.json()["sector"] == "Finance"
    assert resp.json()["name"] == "Gamma"


@pytest.mark.asyncio
async def test_delete_company(client: AsyncClient):
    headers = await auth_header(client)
    create = await client.post("/api/v1/companies", headers=headers, json={"name": "ToDelete"})
    cid = create.json()["id"]

    del_resp = await client.delete(f"/api/v1/companies/{cid}", headers=headers)
    assert del_resp.status_code == 204

    get_resp = await client.get(f"/api/v1/companies/{cid}", headers=headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_get_company_not_found(client: AsyncClient):
    headers = await auth_header(client)
    resp = await client.get("/api/v1/companies/00000000-0000-0000-0000-000000000000", headers=headers)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_companies_search(client: AsyncClient):
    headers = await auth_header(client)
    await client.post("/api/v1/companies", headers=headers, json={"name": "UniqueSearchTerm"})
    resp = await client.get("/api/v1/companies?search=UniqueSearch", headers=headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert any("UniqueSearchTerm" in c["name"] for c in items)
