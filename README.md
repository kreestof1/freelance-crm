# CRM Freelance

**Auteur** : Christophe Barré  
**Stack** : FastAPI · React 18 · PostgreSQL 15 · Azure  
**Sprint courant** : Sprint 0 — Fondations

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture du monorepo](#2-architecture-du-monorepo)
3. [Démarrage rapide](#3-démarrage-rapide)
4. [Commandes Make](#4-commandes-make)
5. [Variables d'environnement](#5-variables-denvironnement)
6. [Tests](#6-tests)
7. [Infrastructure Azure](#7-infrastructure-azure)
8. [CI/CD](#8-cicd)
9. [Roadmap des sprints](#9-roadmap-des-sprints)

---

## 1. Vue d'ensemble

CRM SaaS destiné aux freelances, hébergé sur Azure. Fonctionnalités clés :

- Gestion des **contacts & entreprises**
- Pipeline **opportunités** (Kanban drag-and-drop)
- Suivi des **missions & jalons**
- **Activités & rappels** (tâches, appels, emails)
- Export **RGPD** & conformité

---

## 2. Architecture du monorepo

```
freelance-crm/
├── backend/                  # FastAPI (Python 3.12)
│   ├── app/
│   │   ├── main.py           # App factory, middleware, CORS
│   │   ├── config.py         # Pydantic BaseSettings
│   │   ├── database.py       # Async SQLAlchemy engine
│   │   ├── observability.py  # OpenTelemetry (Azure Monitor / OTLP)
│   │   ├── dependencies.py   # Auth guard, pagination
│   │   ├── models/           # ORM (11 entités)
│   │   ├── schemas/          # Pydantic v2 schemas
│   │   ├── services/         # Logique métier
│   │   ├── routers/          # Endpoints FastAPI
│   │   └── utils/            # security, audit, storage
│   ├── migrations/           # Alembic async
│   ├── tests/
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/                 # React 18 + TypeScript + Vite
│   ├── src/
│   │   ├── api/              # Clients Axios
│   │   ├── features/         # Pages par domaine
│   │   ├── components/       # Composants partagés
│   │   ├── store/            # Zustand stores
│   │   ├── router/           # React Router v6
│   │   ├── i18n/             # Traductions fr/en
│   │   └── theme.ts          # MUI thème dark/light
│   └── package.json
├── infra/                    # Bicep Azure
│   ├── main.bicep
│   ├── modules/              # keyvault, storage, postgres, app service…
│   └── environments/         # dev / staging / prod
├── .github/workflows/        # CI/CD GitHub Actions
├── docker-compose.yml
├── docker-compose.override.yml
├── Makefile
└── .env.example
```

---

## 3. Démarrage rapide

### Prérequis

| Outil | Version minimale |
|---|---|
| Docker Desktop | 4.x |
| Docker Compose | v2 |
| Python | 3.12 |
| Poetry | 1.8+ |
| Node.js | 22 LTS |
| Make | GNU Make |

### Lancement local

```bash
# 1. Cloner et configurer l'environnement
git clone <repo-url> freelance-crm
cd freelance-crm
cp .env.example .env          # éditer les secrets si nécessaire

# 2. Démarrer la stack complète (API + DB + Frontend + Mailhog)
make up

# 3. Appliquer les migrations
make migrate

# 4. (Optionnel) Charger des données de test
make seed
```

Services accessibles :

| Service | URL |
|---|---|
| API (Swagger) | <http://localhost:8000/docs> |
| Frontend | <http://localhost:5173> |
| Adminer (DB) | <http://localhost:8080> |
| Mailhog (SMTP) | <http://localhost:8025> |

---

## 4. Commandes Make

```bash
make up              # Démarre tous les conteneurs
make down            # Arrête les conteneurs
make build           # Reconstruit les images Docker
make logs            # Suit les logs en temps réel

make migrate         # Applique les migrations Alembic (upgrade head)
make migrate-down    # Annule la dernière migration (downgrade -1)
make seed            # Insère des données de démonstration

make test-back       # Tests backend (pytest + couverture)
make test-front      # Tests frontend (vitest + couverture)
make test-e2e        # Tests E2E Playwright
make test            # Lance tous les tests

make lint-back       # ruff + mypy + bandit
make lint-front      # eslint + tsc
make lint            # Lint complet
make format          # ruff format + isort (backend)

make shell-api       # Shell dans le conteneur API
make shell-db        # psql dans la base locale
make clean           # Supprime volumes et données locales
```

---

## 5. Variables d'environnement

Copier `.env.example` vers `.env` et renseigner les valeurs :

| Variable | Description | Défaut local |
|---|---|---|
| `DATABASE_URL` | URL PostgreSQL asyncpg | `postgresql+asyncpg://crm:crm@db:5432/crm` |
| `JWT_SECRET_KEY` | Clé HMAC-HS256 (32+ chars) | *(générer)* |
| `ALLOWED_ORIGINS` | CORS origins autorisés | `http://localhost:5173` |
| `AZURE_BLOB_ACCOUNT` | Nom du compte Azure Storage | — |
| `AZURE_BLOB_CONTAINER` | Conteneur Blob principal | `documents` |
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Application Insights | — |

> **Ne jamais committer `.env`** — il est dans `.gitignore`.

---

## 6. Tests

### Backend (pytest)

```bash
make test-back
# ou directement :
cd backend && poetry run pytest --cov=app tests/ -v
```

| Suite | Couverture cible |
|---|---|
| Tests unitaires (services, utils) | ≥ 80 % |
| Tests d'intégration (endpoints) | Tous les endpoints Sprint 0 |

### Frontend (Vitest)

```bash
make test-front
# ou :
cd frontend && npm run test:coverage
```

### End-to-End (Playwright)

```bash
make test-e2e
# ou :
cd frontend && npm run test:e2e
```

---

## 7. Infrastructure Azure

Tout le provisionnement est décrit en **Bicep** dans `infra/`.

```bash
# Déployer l'environnement dev
az deployment sub create \
  --location westeurope \
  --template-file infra/main.bicep \
  --parameters infra/environments/dev.parameters.json
```

### Ressources créées

| Ressource | SKU dev | SKU prod |
|---|---|---|
| PostgreSQL Flexible Server | Burstable B1ms | General Purpose D2s v3 |
| App Service (API) | B2 | P2v3 |
| Static Web App (Frontend) | Free | Standard |
| Azure Key Vault | Standard | Standard |
| Azure Blob Storage | LRS | ZRS |
| Log Analytics | PerGB2018 | PerGB2018 |
| Application Insights | — | — |

### Key Vault & Identités managées

L'API utilise une **Managed Identity** pour accéder au Key Vault (RBAC, rôle `Key Vault Secrets User`). Aucun secret n'est stocké dans les variables d'application en texte clair.

---

## 8. CI/CD

Trois workflows GitHub Actions dans `.github/workflows/` :

| Workflow | Déclencheur | Étapes |
|---|---|---|
| `ci-backend.yml` | Push / PR sur `main`, `develop` | lint → test (couverture ≥80%) → build Docker + scan Trivy |
| `ci-frontend.yml` | Push / PR sur `main`, `develop` | lint → test → build Vite |
| `deploy.yml` | Push `main` (staging) / tag `v*` (prod) | deploy SWA → deploy App Service (slot swap) → migration DB → smoke E2E |

### Stratégie de déploiement API

1. Build + push image vers ACR
2. Mise à jour du slot **staging** de l'App Service
3. Exécution de la migration Alembic via ACI éphémère
4. **Slot swap** staging → production (zéro downtime)
5. Smoke tests Playwright ; rollback automatique en cas d'échec

---

## 9. Roadmap des sprints

| Sprint | Thème | Durée estimée |
|---|---|---|
| **Sprint 0** ✅ | Fondations (infra, auth, scaffold) | 2 semaines |
| **Sprint 1** | Contacts, Entreprises, Leads | 2 semaines |
| **Sprint 2** | Pipeline Opportunités (Kanban) | 2 semaines |
| **Sprint 3** | Missions & Documents | 2 semaines |
| **Sprint 4** | Activités, Rappels, Recherche | 2 semaines |
| **Sprint 5** | RGPD, Export, Observabilité | 2 semaines |
| **Beta** | QA, Perf, Polishing | 2 semaines |

---

## Contribution

- Branches courtes (≤ 2 jours), rebaser sur `develop` avant PR
- Commits au format **Conventional Commits** (`feat:`, `fix:`, `chore:`, etc.)
- PR requiert 1 review + CI verte
- Pre-commit hooks : `make install-hooks` (ruff, mypy, bandit, eslint, tsc)

```bash
pip install pre-commit
pre-commit install
```
