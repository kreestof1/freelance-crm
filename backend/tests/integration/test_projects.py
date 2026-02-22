"""Tests d'intégration — Projects & Milestones (Sprint 3)."""
from __future__ import annotations

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

pytestmark = pytest.mark.asyncio

_EMAIL = "projects_user@example.com"


async def _get_token(client: AsyncClient) -> str:
    await client.post(
        "/api/v1/auth/register",
        json={"email": _EMAIL, "password": "Password123!", "name": "Projects User"},
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": _EMAIL, "password": "Password123!"},
    )
    return resp.json()["access_token"]


@pytest.fixture
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    token = await _get_token(client)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def won_deal_id(client: AsyncClient, auth_headers: dict) -> str:
    """Crée un deal et le passe à Gagné (verrouillé) pour tester create_project."""
    r = await client.post(
        "/api/v1/deals",
        json={"title": "Mission Dev Web", "amount": "12000", "stage": "Proposition", "probability": 50},
        headers=auth_headers,
    )
    assert r.status_code == 201
    deal_id = r.json()["id"]
    # Déplacer vers Gagné
    mv = await client.post(
        f"/api/v1/deals/{deal_id}/move",
        json={"stage": "Gagné"},
        headers=auth_headers,
    )
    assert mv.status_code == 200
    assert mv.json()["is_locked"] is True
    return deal_id


# ── CRUD Projects ──────────────────────────────────────────────────────────────

async def test_create_project(client: AsyncClient, auth_headers: dict) -> None:
    resp = await client.post(
        "/api/v1/projects",
        json={
            "title": "Refonte site e-commerce",
            "status": "Planifié",
            "rate_type": "tjm",
            "rate_value": "850.00",
            "budget_days": "15",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Refonte site e-commerce"
    assert data["status"] == "Planifié"
    assert float(data["rate_value"]) == 850.0
    assert data["milestones"] == []
    assert data["milestones_total"] == 0


async def test_list_projects(client: AsyncClient, auth_headers: dict) -> None:
    for title in ("Mission A", "Mission B"):
        await client.post(
            "/api/v1/projects",
            json={"title": title, "status": "En cours", "rate_type": "forfait", "rate_value": "5000"},
            headers=auth_headers,
        )
    resp = await client.get("/api/v1/projects", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["total"] >= 2


async def test_list_projects_filter_status(client: AsyncClient, auth_headers: dict) -> None:
    await client.post(
        "/api/v1/projects",
        json={"title": "Mission Planifiée", "status": "Planifié", "rate_type": "tjm", "rate_value": "750"},
        headers=auth_headers,
    )
    resp = await client.get("/api/v1/projects?status=Planifié", headers=auth_headers)
    assert resp.status_code == 200
    for item in resp.json()["items"]:
        assert item["status"] == "Planifié"


async def test_get_project(client: AsyncClient, auth_headers: dict) -> None:
    r = await client.post(
        "/api/v1/projects",
        json={"title": "Mission GET", "rate_type": "tjm", "rate_value": "900"},
        headers=auth_headers,
    )
    pid = r.json()["id"]
    resp = await client.get(f"/api/v1/projects/{pid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == pid


async def test_patch_project(client: AsyncClient, auth_headers: dict) -> None:
    r = await client.post(
        "/api/v1/projects",
        json={"title": "Mission PATCH", "rate_type": "tjm", "rate_value": "800"},
        headers=auth_headers,
    )
    pid = r.json()["id"]
    resp = await client.patch(
        f"/api/v1/projects/{pid}",
        json={"status": "En cours", "rate_value": "950.00"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "En cours"
    assert float(resp.json()["rate_value"]) == 950.0


async def test_delete_project(client: AsyncClient, auth_headers: dict) -> None:
    r = await client.post(
        "/api/v1/projects",
        json={"title": "Mission DELETE", "rate_type": "tjm", "rate_value": "700"},
        headers=auth_headers,
    )
    pid = r.json()["id"]
    del_resp = await client.delete(f"/api/v1/projects/{pid}", headers=auth_headers)
    assert del_resp.status_code == 204
    get_resp = await client.get(f"/api/v1/projects/{pid}", headers=auth_headers)
    assert get_resp.status_code == 404


async def test_get_project_404(client: AsyncClient, auth_headers: dict) -> None:
    resp = await client.get(
        "/api/v1/projects/00000000-0000-0000-0000-000000000000", headers=auth_headers
    )
    assert resp.status_code == 404


# ── Create from deal ──────────────────────────────────────────────────────────

async def test_create_project_from_won_deal(
    client: AsyncClient, auth_headers: dict, won_deal_id: str
) -> None:
    resp = await client.post(
        f"/api/v1/deals/{won_deal_id}/create_project",
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["deal_id"] == won_deal_id
    assert data["title"] == "Mission Dev Web"
    assert float(data["budget_amount"]) == 12000.0


async def test_create_project_from_deal_not_won(client: AsyncClient, auth_headers: dict) -> None:
    r = await client.post(
        "/api/v1/deals",
        json={"title": "Deal non gagné", "amount": "5000", "stage": "Qualification", "probability": 25},
        headers=auth_headers,
    )
    deal_id = r.json()["id"]
    resp = await client.post(f"/api/v1/deals/{deal_id}/create_project", headers=auth_headers)
    assert resp.status_code == 422


async def test_create_project_from_deal_duplicate(
    client: AsyncClient, auth_headers: dict, won_deal_id: str
) -> None:
    await client.post(f"/api/v1/deals/{won_deal_id}/create_project", headers=auth_headers)
    resp2 = await client.post(f"/api/v1/deals/{won_deal_id}/create_project", headers=auth_headers)
    assert resp2.status_code == 409


# ── Milestones ────────────────────────────────────────────────────────────────

@pytest.fixture
async def project_id(client: AsyncClient, auth_headers: dict) -> str:
    r = await client.post(
        "/api/v1/projects",
        json={"title": "Mission jalons", "rate_type": "tjm", "rate_value": "800"},
        headers=auth_headers,
    )
    return r.json()["id"]


async def test_add_milestone(client: AsyncClient, auth_headers: dict, project_id: str) -> None:
    resp = await client.post(
        f"/api/v1/projects/{project_id}/milestones",
        json={"name": "Livrable 1", "due_date": "2026-03-15", "amount": "3000", "status": "Pending"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Livrable 1"
    assert data["status"] == "Pending"
    assert float(data["amount"]) == 3000.0


async def test_patch_milestone_status(client: AsyncClient, auth_headers: dict, project_id: str) -> None:
    r = await client.post(
        f"/api/v1/projects/{project_id}/milestones",
        json={"name": "Livrable PATCH", "status": "Pending"},
        headers=auth_headers,
    )
    mid = r.json()["id"]
    resp = await client.patch(
        f"/api/v1/projects/{project_id}/milestones/{mid}",
        json={"status": "Done"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "Done"


async def test_delete_milestone(client: AsyncClient, auth_headers: dict, project_id: str) -> None:
    r = await client.post(
        f"/api/v1/projects/{project_id}/milestones",
        json={"name": "Livrable DELETE"},
        headers=auth_headers,
    )
    mid = r.json()["id"]
    del_resp = await client.delete(
        f"/api/v1/projects/{project_id}/milestones/{mid}", headers=auth_headers
    )
    assert del_resp.status_code == 204


async def test_project_detail_includes_milestones(
    client: AsyncClient, auth_headers: dict, project_id: str
) -> None:
    for name in ("Milestone X", "Milestone Y"):
        await client.post(
            f"/api/v1/projects/{project_id}/milestones",
            json={"name": name, "status": "Pending"},
            headers=auth_headers,
        )
    resp = await client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["milestones_total"] == 2
    assert len(data["milestones"]) == 2


async def test_milestone_done_counted(client: AsyncClient, auth_headers: dict, project_id: str) -> None:
    r = await client.post(
        f"/api/v1/projects/{project_id}/milestones",
        json={"name": "Done milestone"},
        headers=auth_headers,
    )
    mid = r.json()["id"]
    await client.patch(
        f"/api/v1/projects/{project_id}/milestones/{mid}",
        json={"status": "Done"},
        headers=auth_headers,
    )
    resp = await client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["milestones_done"] >= 1


# ── Documents ─────────────────────────────────────────────────────────────────

async def test_create_document_link(client: AsyncClient, auth_headers: dict, project_id: str) -> None:
    resp = await client.post(
        "/api/v1/documents",
        data={
            "type": "Proposition",
            "related_type": "project",
            "related_id": project_id,
            "external_url": "https://docs.google.com/abc123",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["type"] == "Proposition"
    assert data["external_url"] == "https://docs.google.com/abc123"


async def test_list_documents_for_project(
    client: AsyncClient, auth_headers: dict, project_id: str
) -> None:
    for i in range(2):
        await client.post(
            "/api/v1/documents",
            data={
                "type": "Autre",
                "related_type": "project",
                "related_id": project_id,
                "external_url": f"https://drive.google.com/doc{i}",
            },
            headers=auth_headers,
        )
    resp = await client.get(
        f"/api/v1/documents?related_type=project&related_id={project_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["total"] >= 2


async def test_get_document_returns_signed_url(
    client: AsyncClient, auth_headers: dict, project_id: str
) -> None:
    r = await client.post(
        "/api/v1/documents",
        data={
            "type": "Contrat",
            "related_type": "project",
            "related_id": project_id,
            "external_url": "https://onedrive.live.com/contract.pdf",
        },
        headers=auth_headers,
    )
    doc_id = r.json()["id"]
    resp = await client.get(f"/api/v1/documents/{doc_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["signed_url"] is not None


async def test_delete_document(client: AsyncClient, auth_headers: dict, project_id: str) -> None:
    r = await client.post(
        "/api/v1/documents",
        data={
            "type": "Brief",
            "related_type": "project",
            "related_id": project_id,
            "external_url": "https://drive.google.com/brief",
        },
        headers=auth_headers,
    )
    doc_id = r.json()["id"]
    del_resp = await client.delete(f"/api/v1/documents/{doc_id}", headers=auth_headers)
    assert del_resp.status_code == 204
    get_resp = await client.get(f"/api/v1/documents/{doc_id}", headers=auth_headers)
    assert get_resp.status_code == 404
