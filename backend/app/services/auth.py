"""Service Authentication — login, refresh, révocation."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)

logger = structlog.get_logger(__name__)


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    """Vérifie les credentials et retourne l'utilisateur ou None."""
    result = await db.execute(
        select(User).where(User.email == email, User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if user is None:
        return None
    if not verify_password(password, user.password_hash):
        logger.warning("auth.login_failed", email=email)
        return None
    return user


async def create_tokens(db: AsyncSession, user: User) -> dict[str, str | int]:
    """Crée access + refresh tokens, persiste le refresh en DB."""
    from app.config import get_settings

    settings = get_settings()
    access = create_access_token(user.id)
    refresh_str, jti, expires_at = create_refresh_token(user.id)

    token_db = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh_str),
        jti=jti,
        expires_at=expires_at,
    )
    db.add(token_db)
    await db.flush()

    logger.info("auth.tokens_created", user_id=str(user.id))
    return {
        "access_token": access,
        "refresh_token": refresh_str,
        "token_type": "bearer",
        "expires_in": settings.access_token_expire_minutes * 60,
    }


async def rotate_refresh_token(
    db: AsyncSession, refresh_token_str: str
) -> dict[str, str | int] | None:
    """Valide et fait tourner un refresh token. Retourne None si invalide/révoqué."""
    try:
        payload = decode_token(refresh_token_str)
        if payload.get("type") != "refresh":
            return None
        jti: str = payload["jti"]
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        return None

    # Chercher le token en DB
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.jti == jti,
            RefreshToken.revoked.is_(False),
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )
    stored = result.scalar_one_or_none()
    if stored is None:
        return None

    # Révoquer l'ancien
    stored.revoked = True
    await db.flush()

    # Récupérer l'utilisateur
    user_result = await db.execute(
        select(User).where(User.id == user_id, User.deleted_at.is_(None))
    )
    user = user_result.scalar_one_or_none()
    if user is None:
        return None

    return await create_tokens(db, user)


async def create_user(db: AsyncSession, email: str, name: str, password: str) -> User:
    """Crée un utilisateur (bootstrap mono-user v1)."""
    user = User(
        email=email,
        name=name,
        password_hash=hash_password(password),
    )
    db.add(user)
    await db.flush()
    logger.info("auth.user_created", user_id=str(user.id), email=email)
    return user
