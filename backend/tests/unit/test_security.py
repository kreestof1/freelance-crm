"""Tests unitaires — utils/security.py (JWT, Argon2)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from jose import JWTError

from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)


class TestPasswordHashing:
    def test_hash_password_returns_argon2_hash(self) -> None:
        hashed = hash_password("MySecretPass123!")
        assert hashed.startswith("$argon2")

    def test_verify_password_correct(self) -> None:
        hashed = hash_password("CorrectPassword")
        assert verify_password("CorrectPassword", hashed) is True

    def test_verify_password_wrong(self) -> None:
        hashed = hash_password("CorrectPassword")
        assert verify_password("WrongPassword", hashed) is False

    def test_two_hashes_of_same_password_differ(self) -> None:
        h1 = hash_password("TestPass")
        h2 = hash_password("TestPass")
        assert h1 != h2  # argon2 salt aléatoire


class TestJWT:
    def test_create_and_decode_access_token(self) -> None:
        user_id = uuid.uuid4()
        token = create_access_token(user_id)
        payload = decode_token(token)
        assert payload["sub"] == str(user_id)
        assert payload["type"] == "access"
        assert "jti" in payload

    def test_access_token_has_exp(self) -> None:
        token = create_access_token(uuid.uuid4())
        payload = decode_token(token)
        assert "exp" in payload
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        assert exp > datetime.now(timezone.utc)

    def test_create_and_decode_refresh_token(self) -> None:
        user_id = uuid.uuid4()
        token, jti, expires_at = create_refresh_token(user_id)
        payload = decode_token(token)
        assert payload["sub"] == str(user_id)
        assert payload["type"] == "refresh"
        assert payload["jti"] == jti
        assert expires_at > datetime.now(timezone.utc)

    def test_decode_invalid_token_raises(self) -> None:
        with pytest.raises(JWTError):
            decode_token("not.a.valid.jwt")

    def test_hash_token_is_deterministic(self) -> None:
        t = "sometoken"
        assert hash_token(t) == hash_token(t)

    def test_hash_token_different_inputs_differ(self) -> None:
        assert hash_token("token1") != hash_token("token2")
