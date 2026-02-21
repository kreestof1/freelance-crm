"""Application settings — chargés depuis .env ou Azure Key Vault."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ────────────────────────────────────────────────────────────
    app_name: str = "CRM Freelance API"
    environment: Literal["local", "dev", "staging", "prod"] = "local"
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    # ── Base de données ────────────────────────────────────────────────────────
    database_url: str = Field(
        default="postgresql+asyncpg://crm:crm@localhost:5432/crm",
        description="URL de connexion PostgreSQL async",
    )

    # ── Auth / JWT ─────────────────────────────────────────────────────────────
    jwt_secret_key: str = Field(
        default="changeme-at-least-32-chars-long-secret!",
        description="Clé HMAC-SHA256 — doit être dans Key Vault en prod",
    )
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7

    # ── CORS ────────────────────────────────────────────────────────────────────
    # list[str] et non list[AnyHttpUrl] : Pydantic v2 normalise AnyHttpUrl en
    # ajoutant un slash final (http://localhost:5173/) ce qui casse le matching
    # CORS (le navigateur envoie Origin: http://localhost:5173 sans slash).
    allowed_origins: list[str] = ["http://localhost:5173"]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            stripped = v.strip()
            # JSON array : '["http://...","http://..."]'
            if stripped.startswith("["):
                import json
                return [o.rstrip("/") for o in json.loads(stripped)]
            # Valeurs séparées par virgule
            return [o.strip().rstrip("/") for o in stripped.split(",") if o.strip()]
        # Déjà une liste (valeur par défaut)
        return [o.rstrip("/") for o in v]

    # ── Rate limiting ───────────────────────────────────────────────────────────
    rate_limit_auth: int = 60       # req/min sur /auth/*
    rate_limit_api: int = 200       # req/min sur endpoints authentifiés

    # ── Azure Blob Storage ──────────────────────────────────────────────────────
    azure_storage_url: str = ""
    azure_storage_account_name: str = ""

    # ── Azure Key Vault ─────────────────────────────────────────────────────────
    key_vault_url: str = ""

    # ── Application Insights / OpenTelemetry ────────────────────────────────────
    applicationinsights_connection_string: str = ""
    otlp_exporter_endpoint: str = ""    # ex. http://jaeger:4317 (local)

    # ── SMTP (rappels email) ────────────────────────────────────────────────────
    smtp_host: str = "mailhog"
    smtp_port: int = 1025
    smtp_from: str = "crm@localhost"
    smtp_password: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
