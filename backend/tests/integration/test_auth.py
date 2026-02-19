"""Tests d'intégration — endpoints /auth et /health."""
from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.models.user import User


class TestHealth:
    async def test_health_returns_200(self, client: AsyncClient) -> None:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert "trace_id" in data


class TestLogin:
    async def test_login_success(self, client: AsyncClient, test_user: User) -> None:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "Password123!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, test_user: User) -> None:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "WrongPassword!"},
        )
        assert response.status_code == 401

    async def test_login_unknown_email(self, client: AsyncClient) -> None:
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": "nobody@example.com", "password": "Password123!"},
        )
        assert response.status_code == 401


class TestRefresh:
    async def test_refresh_success(self, client: AsyncClient, test_user: User) -> None:
        # Login pour obtenir un refresh token
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "Password123!"},
        )
        refresh_token = login_resp.json()["refresh_token"]

        # Utiliser le refresh token
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert resp.status_code == 200
        assert "access_token" in resp.json()

    async def test_refresh_invalid_token(self, client: AsyncClient) -> None:
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid.token.here"},
        )
        assert resp.status_code == 401


class TestMe:
    async def test_me_authenticated(self, client: AsyncClient, test_user: User) -> None:
        login_resp = await client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "Password123!"},
        )
        access_token = login_resp.json()["access_token"]

        resp = await client.get(
            "/api/v1/auth/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["email"] == "test@example.com"

    async def test_me_unauthenticated(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 401
