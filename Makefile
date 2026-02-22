.PHONY: help up down build logs test-back test-front lint lint-back lint-front \
        migrate migrate-down seed seed-demo shell-api shell-db clean

# ── Variables ──────────────────────────────────────────────────────────────────
COMPOSE       = docker compose
BACKEND_EXEC  = $(COMPOSE) exec api
FRONT_EXEC    = $(COMPOSE) exec front

# ── Aide ───────────────────────────────────────────────────────────────────────
help: ## Affiche cette aide
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ── Stack ──────────────────────────────────────────────────────────────────────
up: ## Démarre tous les services
	$(COMPOSE) up -d
	@echo "✅ Stack démarrée"
	@echo "   API     → http://localhost:8000"
	@echo "   Front   → http://localhost:5173"
	@echo "   Adminer → http://localhost:8080"
	@echo "   MailHog → http://localhost:8025"

down: ## Arrête tous les services
	$(COMPOSE) down

build: ## Reconstruit les images
	$(COMPOSE) build --no-cache

logs: ## Suivi des logs (ctrl+C pour quitter)
	$(COMPOSE) logs -f

restart-api: ## Redémarre uniquement l'API
	$(COMPOSE) restart api

# ── Base de données ────────────────────────────────────────────────────────────
migrate: ## Applique toutes les migrations Alembic
	$(BACKEND_EXEC) alembic upgrade head

migrate-down: ## Rollback d'une migration
	$(BACKEND_EXEC) alembic downgrade -1

migrate-generate: ## Génère une nouvelle migration (MSG=<description>)
	$(BACKEND_EXEC) alembic revision --autogenerate -m "$(MSG)"

seed: ## Insère les données initiales (stages pipeline, user admin)
	$(BACKEND_EXEC) python -m app.tasks.seed

seed-demo: ## Insère les données initiales + données de démonstration
	$(BACKEND_EXEC) python -m app.tasks.seed --demo

# ── Tests ──────────────────────────────────────────────────────────────────────
test-back: ## Lance les tests backend (pytest + coverage)
	$(BACKEND_EXEC) pytest -x --cov=app --cov-report=term-missing

test-back-unit: ## Tests unitaires uniquement
	$(BACKEND_EXEC) pytest tests/unit -x -v

test-back-integ: ## Tests d'intégration uniquement
	$(BACKEND_EXEC) pytest tests/integration -x -v

test-front: ## Lance les tests frontend (vitest)
	$(FRONT_EXEC) pnpm test

test-e2e: ## Lance les tests E2E Playwright (env staging)
	$(FRONT_EXEC) pnpm test:e2e

test: test-back test-front ## Lance tous les tests

# ── Lint / Format ──────────────────────────────────────────────────────────────
lint-back: ## Lint backend (ruff + mypy + bandit)
	$(BACKEND_EXEC) ruff check app/ tests/
	$(BACKEND_EXEC) mypy app/
	$(BACKEND_EXEC) bandit -r app/ -ll

lint-front: ## Lint frontend (eslint + tsc)
	$(FRONT_EXEC) pnpm lint
	$(FRONT_EXEC) pnpm type-check

lint: lint-back lint-front ## Lint complet

format: ## Formate le code (ruff + prettier)
	$(BACKEND_EXEC) ruff format app/ tests/
	$(FRONT_EXEC) pnpm lint:fix

# ── Shells ─────────────────────────────────────────────────────────────────────
shell-api: ## Ouvre un shell dans le conteneur API
	$(BACKEND_EXEC) bash

shell-db: ## Ouvre psql dans le conteneur DB
	$(COMPOSE) exec db psql -U crm crm

# ── Nettoyage ──────────────────────────────────────────────────────────────────
clean: ## Supprime les volumes et conteneurs
	$(COMPOSE) down -v --remove-orphans
	find backend -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find backend -name "*.pyc" -delete 2>/dev/null || true
