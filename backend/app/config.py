"""Application settings — chargés depuis .env ou Azure Key Vault."""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import AnyHttpUrl, Field, field_validator
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
    allowed_origins: list[AnyHttpUrl] = ["http://localhost:5173"]  # type: ignore[assignment]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def split_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            return [o.strip() for o in v.split(",")]
        return v

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
