# CRM Freelance

**Auteur** : Christophe Barré  
**Stack** : FastAPI · React 18 · PostgreSQL 15 · Azure  
**Sprint courant** : Sprint 4 — Activités & Rappels

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture du monorepo](#2-architecture-du-monorepo)
3. [Démarrage rapide](#3-démarrage-rapide)
4. [Commandes Make](#4-commandes-make)
5. [Variables d'environnement](#5-variables-denvironnement)
6. [API Endpoints](#6-api-endpoints)
7. [Tests](#7-tests)
8. [Infrastructure Azure](#8-infrastructure-azure)
9. [CI/CD](#9-cicd)
10. [Roadmap des sprints](#10-roadmap-des-sprints)

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
│   │   ├── models/           # ORM (12 entités : User, Contact, Company, Lead, Deal, PipelineStage, Project, Milestone, Document…)
│   │   ├── schemas/          # Pydantic v2 (auth, companies, contacts, leads, deals, pipeline, dashboard, projects, documents)
│   │   ├── services/         # Logique métier (CRUD, fusion, conversion, import CSV, deals, dashboard, projects, documents)
│   │   ├── routers/          # Endpoints FastAPI (auth, companies, contacts, leads, deals, pipeline, dashboard, projects, documents, health)
│   │   └── utils/            # security, audit, storage (Azure Blob + fallback local)
│   ├── migrations/           # Alembic async (0001 initial, 0002 S1 indexes, 0003 S2 pipeline+deals, 0004 S3 projects+documents indexes)
│   ├── tests/
│   │   ├── unit/             # Tests unitaires (conversion lead, fusion contact)
│   │   └── integration/      # Tests d'intégration (companies, contacts, leads, deals, projects)
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/                 # React 18 + TypeScript + Vite
│   ├── src/
│   │   ├── api/              # Clients Axios + hooks TanStack Query (auth, companies, contacts, leads, deals, dashboard, projects, documents)
│   │   ├── features/         # Pages par domaine
│   │   │   ├── auth/         # LoginPage
│   │   │   ├── companies/    # CompaniesPage, CompanyDetailPage
│   │   │   ├── contacts/     # ContactsPage, ContactDetailPage, ImportCsvWizard
│   │   │   ├── leads/        # LeadsPage (filtres, création, conversion)
│   │   │   ├── deals/        # DealsPage (Kanban DnD), DealCard, DealSlideOver
│   │   │   ├── dashboard/    # DashboardPage (KPIs + Recharts prévisions)
│   │   │   ├── projects/     # ProjectsPage (liste + filtres), ProjectDetailPage (jalons + documents)
│   │   │   └── documents/    # DocumentsPage (liste globale, filtres type/entité)
│   │   ├── components/
│   │   │   ├── common/       # DataTable<T>, TagsInput, ConfirmDialog
│   │   │   └── layout/       # MainLayout, sidebar, topbar
│   │   ├── store/            # Zustand stores (auth)
│   │   ├── router/           # React Router v6 (routes lazy)
│   │   ├── i18n/             # Traductions fr/en (leads, contacts, companies, csvImport, projects, documents)
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
| Make | GNU Make (Windows : `winget install ezwinports.make`) |

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

## 6. API Endpoints

Tous les endpoints sont préfixés `/api/v1` et requièrent un token JWT Bearer (`Authorization: Bearer <token>`), sauf `/auth/login`.

### Authentification

| Méthode | Endpoint | Description |
|---|---|---|
| `POST` | `/auth/login` | Connexion (retourne `access_token`) |
| `POST` | `/auth/refresh` | Renouvellement du token (cookie httpOnly) |
| `POST` | `/auth/logout` | Révocation du refresh token |

### Entreprises

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/companies` | Liste paginée (filtre `search`, `tag`) |
| `POST` | `/companies` | Créer une entreprise |
| `GET` | `/companies/{id}` | Détail + nombre de contacts associés |
| `PUT` | `/companies/{id}` | Mise à jour partielle |
| `DELETE` | `/companies/{id}` | Suppression douce (`deleted_at`) |

### Contacts

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/contacts` | Liste paginée (filtre `search`, `tag`, `company_id`) |
| `POST` | `/contacts` | Créer un contact |
| `GET` | `/contacts/{id}` | Détail |
| `PUT` | `/contacts/{id}` | Mise à jour partielle |
| `DELETE` | `/contacts/{id}` | Suppression douce |
| `POST` | `/contacts/merge` | Fusionner deux contacts (réassigne activités & deals) |
| `POST` | `/contacts/import/detect` | Détecter l'encodage et le mapping des colonnes CSV |
| `POST` | `/contacts/import` | Importer un fichier CSV (multipart) |

### Prospects (Leads)

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/leads` | Liste paginée (filtre `search`, `status`, `source`, `tag`) |
| `POST` | `/leads` | Créer un lead |
| `GET` | `/leads/{id}` | Détail |
| `PATCH` | `/leads/{id}` | Mise à jour partielle |
| `DELETE` | `/leads/{id}` | Suppression douce |
| `POST` | `/leads/{id}/convert` | Convertir en Contact + Deal (atomique) |

### Opportunités (Deals)

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/deals` | Liste paginée (filtre `stage`, `company_id`, `close_before`) |
| `POST` | `/deals` | Créer un deal |
| `GET` | `/deals/{id}` | Détail |
| `PATCH` | `/deals/{id}` | Mise à jour partielle (verrouillé si `Gagné`) |
| `DELETE` | `/deals/{id}` | Suppression douce |
| `POST` | `/deals/{id}/move` | Déplacer dans le pipeline (Kanban) |
| `POST` | `/deals/{id}/create_project` | Créer une mission depuis un deal Gagné (HTTP 201) |

> **Règle métier** : un deal déplacé en `Gagné` est automatiquement verrouillé (`is_locked=true`, `probability=100`). Modifier `amount` ou `expected_close` sur un deal verrouillé retourne HTTP 422.

### Missions (Projects)

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/projects` | Liste paginée (filtre `search`, `status`) |
| `POST` | `/projects` | Créer une mission |
| `GET` | `/projects/{id}` | Détail enrichi (jalons, métriques, prochains jalons) |
| `PATCH` | `/projects/{id}` | Mise à jour partielle |
| `DELETE` | `/projects/{id}` | Suppression douce |
| `POST` | `/projects/{id}/milestones` | Ajouter un jalon |
| `PATCH` | `/projects/{id}/milestones/{mid}` | Modifier un jalon |
| `DELETE` | `/projects/{id}/milestones/{mid}` | Supprimer un jalon |

**Statuts** : `Planifié → En cours → Suspendu → Clôturé`  
**Types de facturation** : `TJM` (taux journalier) · `Forfait` (budget global)  
**Jalons** : statuts `Pending / Done / Delayed` ; mise en évidence des jalons dus dans les 7 jours suivants

### Documents

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/documents` | Liste (globale ou filtrée par `related_type` + `related_id`) |
| `POST` | `/documents` | Upload fichier (multipart) **ou** enregistrer lien externe |
| `GET` | `/documents/{id}` | Métadonnées + URL signée Azure Blob (1 h, fallback `file_uri` en dev) |
| `DELETE` | `/documents/{id}` | Suppression douce |

**Types** : `Brief · Proposition · Contrat · Autre`  
**Entités liables** : `deal` ou `project`

### Pipeline

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/pipeline/stages` | Liste les étapes configurées (auto-seed si vide) |
| `PUT` | `/pipeline/stages` | Remplace la configuration complète du pipeline |

**Étapes par défaut** : Découverte (10%) → Qualification (25%) → Proposition (50%) → Négociation (75%) → Gagné (100%) → Perdu (0%)

### Tableau de bord

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/dashboard/pipeline` | Agrégats par étape (count, total, pondéré) |
| `GET` | `/dashboard/forecast` | Prévisions mois courant + 3 mois suivants |

### Santé

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Liveness check |
| `GET` | `/health/ready` | Readiness check (DB + dépendances) |

---

## 7. Tests

### Backend (pytest)

```bash
make test-back
# ou directement :
cd backend && poetry run pytest --cov=app tests/ -v
```

| Suite | Fichier | Couverture cible |
|---|---|---|
| Unitaires — conversion lead | `tests/unit/test_leads_contacts.py` | `services/leads.py` |
| Unitaires — fusion contacts | `tests/unit/test_leads_contacts.py` | `services/contacts.py` |
| Intégration — entreprises | `tests/integration/test_companies.py` | CRUD complet + search |
| Intégration — contacts | `tests/integration/test_contacts.py` | CRUD + merge + CSV import |
| Intégration — leads | `tests/integration/test_leads.py` | CRUD + conversion + 409 double |
| Intégration — deals | `tests/integration/test_deals.py` | CRUD, move, verrouillage Gagné, weighted_amount, dashboard |
| Intégration — missions & docs | `tests/integration/test_projects.py` | CRUD projects, jalons, documents, create_from_deal, 409 doublon |

Couverture globale cible : **≥ 80 %**

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

## 8. Infrastructure Azure

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

## 9. CI/CD

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

## 10. Roadmap des sprints

| Sprint | Thème | Statut |
|---|---|---|
| **Sprint 0** | Fondations (infra, auth, scaffold, Docker, CI/CD, Bicep) | ✅ Terminé |
| **Sprint 1** | Contacts, Entreprises, Leads — CRUD, fusion, import CSV, conversion | ✅ Terminé |
| **Sprint 2** | Pipeline Opportunités (Kanban drag-and-drop) | ✅ Terminé |
| **Sprint 3** | Missions & Documents | ✅ Terminé |
| **Sprint 4** | Activités, Rappels, Recherche full-text | ⏳ Planifié |
| **Sprint 5** | RGPD, Export, Observabilité (Azure Monitor) | ⏳ Planifié |
| **Beta** | QA, Performance, Polishing | ⏳ Planifié |

### Ce qui a été livré en Sprint 3

**Backend**

- Schémas Pydantic v2 : `ProjectCreate/Patch/Out/List`, `MilestoneCreate/Patch/Out`, `DocumentCreate/Out/List`
- Service `projects` : CRUD complet, enrichissement (company_name, deal_title, milestones[], métriques, upcoming_milestones), `create_project_from_deal` (409 si doublon deal), transitions de statut logguées dans AuditLog
- Service `documents` : upload vers Azure Blob Storage (fallback `local://` en dev), liens externes, URL signées 1 h, soft-delete
- 9 endpoints `/projects` (CRUD + 3 jalons) + 4 endpoints `/documents` (upload/lien, liste, détail+SAS, suppression)
- `POST /deals/{id}/create_project` : factory depuis un deal Gagné verrouillé
- Migration Alembic `0004` : 8 index de performance (projets, jalons, documents, audit logs) — pas de nouvelles tables (déjà créées en 0001)
- 18 tests d'intégration dans `test_projects.py` (CRUD, jalons, documents, create_from_deal, 409, 422)
- Listing global `/documents` sans filtre obligatoire (100 derniers, avec filtres optionnels `type` et `related_type`)

**Frontend**

- `ProjectsPage` : liste filtrée par statut + recherche, barre de progression des jalons, chip « jalon à venir », dialogue de création (titre, statut, facturation TJM/Forfait, dates, notes)
- `ProjectDetailPage` : dropdown statut avec auto-sauvegarde, panneau jalons (stepper, mise en évidence orange ≤7 jours, ajout/édition/suppression), panneau documents (upload fichier + lien externe, affichage avec lien d'ouverture, suppression)
- `DocumentsPage` : liste globale de tous les documents, filtres par type et entité, recherche par nom, suppression avec confirmation
- Hooks TanStack Query : `useProjects`, `useProject`, `useCreateProject`, `usePatchProject`, `useDeleteProject`, `useCreateProjectFromDeal`, `useAddMilestone`, `usePatchMilestone`, `useDeleteMilestone`, `useDocuments`, `useAllDocuments`, `useDocument`, `useUploadDocument`, `useDeleteDocument`
- Route lazy `/projects/:id` → `ProjectDetailPage`
- Clés i18n `fr` / `en` pour `projects` (statuts inclus) et `documents` (types inclus)
- Ajout de la dépendance `date-fns ^3.6.0` (formatage dates, calcul jalons imminents)

---

### Ce qui a été livré en Sprint 2

**Backend**

- Modèle `PipelineStage` avec 6 étapes par défaut seedées automatiquement
- 6 endpoints `/deals` : CRUD complet avec `weighted_amount` calculé, soft-delete
- `POST /deals/{id}/move` : transition Kanban avec verrouillage automatique sur « Gagné »
- `GET/PUT /pipeline/stages` : configuration des étapes
- `GET /dashboard/pipeline` et `/dashboard/forecast` : agrégats et prévisions 4 mois
- Migration Alembic `0003` : table `pipeline_stages`, indexes sur `deals`
- 14 tests d'intégration (CRUD, verrouillage, montant pondéré, dashboard)

**Frontend**

- `DealsPage` : board Kanban complet avec `@dnd-kit` (colonnes droppables, DragOverlay, dialogue création rapide)
- `DealCard` : carte draggable (probabilité, montant pondéré, verrouillage, tags, date d'échéance)
- `DealSlideOver` : drawer d'édition (React Hook Form + Zod, slider probabilité, suppression avec confirmation)
- `DashboardPage` : KPI cards + barre de progression par étape + BarChart Recharts (prévisions 4 mois)
- Hooks TanStack Query : `useDeals`, `usePipelineStages`, `useMoveDeal`, `usePatchDeal`, `useCreateDeal`, `useDeleteDeal`, `usePipelineDashboard`, `useForecastDashboard`
- `AuthInitializer` : renouvellement silencieux du token au démarrage (évite les 401 après rechargement)

**Corrections techniques**

- CORS : remplacement de `list[AnyHttpUrl]` par `list[str]` (Pydantic v2 ajoutait un `/` final)
- Auth : `EmailStr` remplacé par `str` dans `LoginRequest` et `UserOut` (domaines `.local` rejetés)
- `UserOut.id` : ajout d'un `field_validator` pour coercition `UUID → str`

---

### Ce qui a été livré en Sprint 1

**Backend**

- 15 endpoints REST (`/companies`, `/contacts`, `/leads`) avec soft-delete et pagination
- Fusion atomique de contacts (réassignation des activités et deals)
- Conversion lead → Contact + Deal en transaction atomique
- Import CSV : détection automatique de l'encodage (UTF-8/Latin-1) et mapping interactif des colonnes
- Migration Alembic `0002` : indexes GIN sur `tags[]` + indexes fonctionnels `lower(name)`
- Tests unitaires et d'intégration couvrant tous les flux critiques

**Frontend**

- Pages complètes : `LeadsPage`, `ContactsPage`, `CompaniesPage` (remplacent les stubs)
- Pages de détail : `CompanyDetailPage`, `ContactDetailPage`
- Composants partagés : `DataTable<T>` (pagination, tri, sélection), `TagsInput`, `ConfirmDialog`
- Assistant import CSV 3 étapes : upload → mapping colonnes → résultat
- Dialog de conversion lead (titre deal, montant, étape)
- Dialog de fusion contacts (sélection multiple dans la DataTable)
- Hooks TanStack Query pour toutes les ressources (`useLeads`, `useContacts`, `useCompanies`, `useConvertLead`, `useMergeContacts`, `useImportContactsCsv`…)
- Clés i18n `fr` / `en` pour `leads`, `contacts`, `companies`, `csvImport`
- Routes lazy `/contacts/:id` et `/companies/:id`

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
