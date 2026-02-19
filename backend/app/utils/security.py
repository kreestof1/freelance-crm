"""Utilitaires de sécurité — JWT (Access + Refresh), hachage Argon2."""
from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")


# ── Hachage Mot de passe ───────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ── JWT ────────────────────────────────────────────────────────────────────────

def create_access_token(user_id: uuid.UUID, extra_claims: dict[str, Any] | None = None) -> str:
    """Génère un Access JWT (exp = 15 min)."""
    jti = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "jti": jti,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "type": "access",
        **(extra_claims or {}),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: uuid.UUID) -> tuple[str, str, datetime]:
    """Génère un Refresh JWT.

    Returns:
        (token_string, jti, expires_at)
    """
    jti = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=settings.refresh_token_expire_days)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "jti": jti,
        "iat": now,
        "exp": expires_at,
        "type": "refresh",
    }
    token = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return token, jti, expires_at


def decode_token(token: str) -> dict[str, Any]:
    """Décode un JWT et lève JWTError si invalide/expiré."""
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])  # type: ignore[return-value]


def hash_token(token: str) -> str:
    """Hash SHA-256 d'un token pour stockage en DB."""
    return hashlib.sha256(token.encode()).hexdigest()


def generate_random_token() -> str:
    return secrets.token_urlsafe(32)
