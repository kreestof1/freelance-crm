"""Configuration pytest — fixtures partagées."""
from __future__ import annotations

import asyncio
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.database import Base, get_db
from app.main import app
from app.models import User
from app.utils.security import hash_password

# ── DB de test (PostgreSQL éphémère via Docker Compose) ───────────────────────
TEST_DB_URL = "postgresql+asyncpg://crm:crm@localhost:5432/crm_test"

test_engine = create_async_engine(TEST_DB_URL, poolclass=NullPool)
TestSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=test_engine,
    expire_on_commit=False,
    autocommit=False,
)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_db() -> AsyncGenerator[None, None]:
    """Crée le schéma DB avant les tests, purge après."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Session DB avec rollback automatique après chaque test."""
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Client HTTP async avec la session DB de test injectée."""

    async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Crée un utilisateur de test."""
    user = User(
        email="test@example.com",
        name="Test User",
        password_hash=hash_password("Password123!"),
    )
    db_session.add(user)
    await db_session.flush()
    return user
