# ── Stage 1 : builder ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Installer poetry
RUN pip install --no-cache-dir poetry==1.8.3

# Copier uniquement les fichiers de dépendances
COPY pyproject.toml poetry.lock* ./

# Installer les dépendances dans un venv isolé
RUN poetry config virtualenvs.in-project true \
    && poetry install --only=main --no-root --no-interaction --no-ansi

# ── Stage 2 : runtime ──────────────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

# Utilisateur non-root
RUN groupadd --gid 1001 appgroup \
    && useradd --uid 1001 --gid appgroup --no-create-home appuser

WORKDIR /app

# Copier le venv depuis le stage builder
COPY --from=builder /app/.venv .venv

# Copier le code source
COPY app/ ./app/
COPY migrations/ ./migrations/
COPY alembic.ini ./

# Ajuster les permissions
RUN chown -R appuser:appgroup /app

USER appuser

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:8000/health').raise_for_status()"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
