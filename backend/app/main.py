"""Point d'entrée FastAPI — middlewares, routes, OpenTelemetry."""
from __future__ import annotations

import time
import uuid
from contextlib import asynccontextmanager
from typing import AsyncIterator

import structlog
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings
from app.database import engine, Base
from app.routers import auth, companies, contacts, health, leads
from app.observability import configure_telemetry

logger = structlog.get_logger(__name__)
settings = get_settings()

limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialisation et nettoyage de l'application."""
    logger.info("startup", environment=settings.environment)
    configure_telemetry()
    yield
    await engine.dispose()
    logger.info("shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        docs_url="/api/docs" if settings.environment != "prod" else None,
        redoc_url="/api/redoc" if settings.environment != "prod" else None,
        openapi_url="/api/v1/openapi.json",
        lifespan=lifespan,
    )

    # ── Rate limiting ───────────────────────────────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]

    # ── CORS ────────────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(o) for o in settings.allowed_origins],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )

    # ── Middleware trace_id + timing ────────────────────────────────────────────
    @app.middleware("http")
    async def request_context_middleware(request: Request, call_next: ...) -> Response:  # type: ignore[misc]
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        start = time.perf_counter()
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        response: Response = await call_next(request)
        duration_ms = round((time.perf_counter() - start) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=duration_ms,
        )
        return response

    # ── Handler d'erreurs global ────────────────────────────────────────────────
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.error("unhandled_exception", exc=str(exc), exc_info=exc)
        message = str(exc) if settings.environment != "prod" else "Internal server error"
        return JSONResponse(
            status_code=500,
            content={"code": "INTERNAL_ERROR", "message": message},
        )

    # ── Sécurité headers ────────────────────────────────────────────────────────
    @app.middleware("http")
    async def security_headers(request: Request, call_next: ...) -> Response:  # type: ignore[misc]
        response: Response = await call_next(request)
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

    # ── Routers ─────────────────────────────────────────────────────────────────
    app.include_router(health.router, tags=["health"])
    app.include_router(auth.router, prefix=settings.api_v1_prefix + "/auth", tags=["auth"])
    app.include_router(companies.router, prefix=settings.api_v1_prefix + "/companies", tags=["companies"])
    app.include_router(contacts.router, prefix=settings.api_v1_prefix + "/contacts", tags=["contacts"])
    app.include_router(leads.router, prefix=settings.api_v1_prefix + "/leads", tags=["leads"])

    return app


app = create_app()
