"""Tests d'intégration — /api/v1/contacts."""
from __future__ import annotations

import io
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
async def test_list_contacts_empty(client: AsyncClient):
    headers = await auth_header(client)
    resp = await client.get("/api/v1/contacts", headers=headers)
    assert resp.status_code == 200
    assert "items" in resp.json()


@pytest.mark.asyncio
async def test_create_contact(client: AsyncClient):
    headers = await auth_header(client)
    resp = await client.post("/api/v1/contacts", headers=headers, json={
        "first_name": "Alice",
        "last_name": "Brun",
        "email": "alice@brun.fr",
        "tags": ["vip"],
    })
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "alice@brun.fr"


@pytest.mark.asyncio
async def test_update_contact(client: AsyncClient):
    headers = await auth_header(client)
    c = await client.post("/api/v1/contacts", headers=headers, json={
        "first_name": "Bob", "last_name": "Roi", "email": "bob@roi.fr",
    })
    cid = c.json()["id"]
    resp = await client.put(f"/api/v1/contacts/{cid}", headers=headers, json={"phone": "0600000000"})
    assert resp.status_code == 200
    assert resp.json()["phone"] == "0600000000"


@pytest.mark.asyncio
async def test_delete_contact(client: AsyncClient):
    headers = await auth_header(client)
    c = await client.post("/api/v1/contacts", headers=headers, json={
        "first_name": "Del", "last_name": "Me", "email": "delme@test.com",
    })
    cid = c.json()["id"]
    assert (await client.delete(f"/api/v1/contacts/{cid}", headers=headers)).status_code == 204
    assert (await client.get(f"/api/v1/contacts/{cid}", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_merge_contacts(client: AsyncClient):
    headers = await auth_header(client)
    src = (await client.post("/api/v1/contacts", headers=headers, json={
        "first_name": "A", "last_name": "Src", "email": "src@test.com", "tags": ["lead"],
    })).json()
    tgt = (await client.post("/api/v1/contacts", headers=headers, json={
        "first_name": "A", "last_name": "Tgt", "email": "tgt@test.com", "tags": ["client"],
    })).json()

    resp = await client.post("/api/v1/contacts/merge", headers=headers, json={
        "source_id": src["id"],
        "target_id": tgt["id"],
    })
    assert resp.status_code == 200
    merged = resp.json()
    assert "lead" in merged["tags"]
    assert "client" in merged["tags"]

    # source must be gone
    assert (await client.get(f"/api/v1/contacts/{src['id']}", headers=headers)).status_code == 404


@pytest.mark.asyncio
async def test_csv_import_detect(client: AsyncClient):
    headers = await auth_header(client)
    csv_bytes = b"prenom,nom,email\nAlice,Nodet,alice@test.com\n"
    resp = await client.post(
        "/api/v1/contacts/import/detect",
        headers=headers,
        files={"file": ("contacts.csv", io.BytesIO(csv_bytes), "text/csv")},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "detected_mapping" in body
    mapping = body["detected_mapping"]
    # prenom → first_name, nom → last_name, email → email
    assert mapping.get("prenom") == "first_name" or mapping.get("first_name") == "first_name"


@pytest.mark.asyncio
async def test_csv_import(client: AsyncClient):
    import json
    headers = await auth_header(client)
    csv_bytes = b"first_name,last_name,email\nLucie,Perrin,lucie@perrin.fr\n"
    column_mapping = json.dumps({"first_name": "first_name", "last_name": "last_name", "email": "email"})
    resp = await client.post(
        "/api/v1/contacts/import",
        headers=headers,
        files={"file": ("contacts.csv", io.BytesIO(csv_bytes), "text/csv")},
        data={"column_mapping": column_mapping},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] >= 1
