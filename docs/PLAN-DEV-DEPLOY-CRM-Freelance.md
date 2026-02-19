# Plan Détaillé de Développement & Déploiement — CRM Freelance

**Auteur** : Christophe Barré  
**Version** : 1.0  
**Date** : 2026‑02‑18  
**Basé sur** : SPEC-CRM-Freelance-Azure v1.0

---

## Table des matières

1. [Vue d'ensemble & principes directeurs](#1-vue-densemble--principes-directeurs)
2. [Environnements & outillage](#2-environnements--outillage)
3. [Architecture des dépôts (monorepo)](#3-architecture-des-dépôts-monorepo)
4. [Sprint 0 — Fondations](#4-sprint-0--fondations)
5. [Sprint 1 — Contacts / Entreprises / Leads](#5-sprint-1--contacts--entreprises--leads)
6. [Sprint 2 — Pipeline Opportunités (Kanban)](#6-sprint-2--pipeline-opportunités-kanban)
7. [Sprint 3 — Missions & Documents](#7-sprint-3--missions--documents)
8. [Sprint 4 — Activités, Rappels & Recherche](#8-sprint-4--activités-rappels--recherche)
9. [Sprint 5 — RGPD, Export & Observabilité](#9-sprint-5--rgpd-export--observabilité)
10. [Phase Beta — QA, Perf & Polishing](#10-phase-beta--qa-perf--polishing)
11. [Infrastructure Azure — Provisionnement](#11-infrastructure-azure--provisionnement)
12. [CI/CD — GitHub Actions](#12-cicd--github-actions)
13. [Sécurité & conformité](#13-sécurité--conformité)
14. [Observabilité & opérations](#14-observabilité--opérations)
15. [Tests — stratégie globale](#15-tests--stratégie-globale)
16. [Gestion des risques](#16-gestion-des-risques)
17. [Checklist de mise en production](#17-checklist-de-mise-en-production)

---

## 1. Vue d'ensemble & principes directeurs

| Principe | Application |
|---|---|
| **12‑Factor App** | Config via env vars / Key Vault, pas de secret committé |
| **API‑First** | Schéma OpenAPI généré automatiquement par FastAPI, figé avant tout développement front |
| **Test‑first sur domaine critique** | Opportunités & Missions ≥ 80 % couverture unitaire |
| **Infrastructure as Code** | Tout le provisionnement Azure via Bicep (ou Terraform) |
| **Trunk‑based development** | Branches courtes (≤ 2 jours), PRs revues avant merge |
| **Shift‑left sécurité** | SAST + dépendances scannées à chaque PR |
| **Observabilité dès le départ** | OpenTelemetry instrumenté dès Sprint 0 |

---

## 2. Environnements & outillage

### 2.1 Environnements cibles

| Environnement | Hébergement | Usage |
|---|---|---|
| **local‑dev** | Docker Compose (laptop) | Développement quotidien |
| **dev** | Azure (tier bas) | Intégration continue, tests auto |
| **staging** | Azure (parité prod) | Recette, tests E2E, smoke tests |
| **prod** | Azure (dimensionnement nominal) | Production |

### 2.2 Stack locale (Docker Compose)

```
services:
  api         → FastAPI (uvicorn --reload)
  db          → PostgreSQL 15
  adminer     → UI d'administration DB
  front       → Vite dev server (HMR)
  mailhog     → Capture emails de rappel (dev)
```

### 2.3 Outils développeur

| Outil | Rôle |
|---|---|
| **pyenv + poetry** | Gestion versions Python & dépendances back |
| **nvm + pnpm** | Gestion versions Node & dépendances front |
| **pre‑commit** | Hooks lint/format avant chaque commit |
| **Makefile** | Cibles `make up`, `make test`, `make lint`, `make migrate` |
| **VS Code** | Éditeur recommandé + extensions (Pylance, ESLint, Docker) |

---

## 3. Architecture des dépôts (monorepo)

```
crm-freelance/
├── .github/
│   └── workflows/
│       ├── ci-backend.yml
│       ├── ci-frontend.yml
│       └── deploy.yml
├── infra/                        # IaC Bicep / Terraform
│   ├── main.bicep
│   ├── modules/
│   │   ├── appservice.bicep
│   │   ├── postgres.bicep
│   │   ├── storage.bicep
│   │   ├── keyvault.bicep
│   │   └── staticwebapp.bicep
│   └── environments/
│       ├── dev.parameters.json
│       ├── staging.parameters.json
│       └── prod.parameters.json
├── backend/
│   ├── app/
│   │   ├── main.py               # Point d'entrée FastAPI
│   │   ├── config.py             # Settings Pydantic BaseSettings
│   │   ├── database.py           # Engine SQLAlchemy + session
│   │   ├── models/               # Modèles SQLAlchemy ORM
│   │   │   ├── company.py
│   │   │   ├── contact.py
│   │   │   ├── lead.py
│   │   │   ├── deal.py
│   │   │   ├── project.py
│   │   │   ├── milestone.py
│   │   │   ├── activity.py
│   │   │   ├── document.py
│   │   │   ├── user.py
│   │   │   └── audit_log.py
│   │   ├── schemas/              # Schémas Pydantic v2
│   │   ├── routers/              # Un fichier par ressource
│   │   ├── services/             # Logique métier
│   │   ├── dependencies.py       # Auth, DB session, pagination
│   │   └── utils/
│   │       ├── security.py       # JWT, Argon2
│   │       ├── storage.py        # Azure Blob SAS
│   │       └── audit.py          # AuditLog writer
│   ├── migrations/               # Alembic
│   │   ├── env.py
│   │   └── versions/
│   ├── tests/
│   │   ├── unit/
│   │   ├── integration/
│   │   └── conftest.py
│   ├── Dockerfile
│   ├── pyproject.toml
│   └── alembic.ini
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/                  # Clients TanStack Query
│   │   ├── components/           # Composants réutilisables
│   │   ├── features/             # Modules par domaine
│   │   │   ├── leads/
│   │   │   ├── contacts/
│   │   │   ├── companies/
│   │   │   ├── deals/
│   │   │   ├── projects/
│   │   │   ├── activities/
│   │   │   ├── documents/
│   │   │   └── dashboard/
│   │   ├── hooks/                # Hooks partagés
│   │   ├── store/                # Zustand stores
│   │   ├── router/               # React Router config
│   │   ├── i18n/                 # Fichiers de traduction
│   │   └── utils/
│   ├── tests/
│   │   ├── unit/
│   │   └── e2e/                  # Playwright
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
├── docker-compose.yml
├── docker-compose.override.yml   # Dev overrides
├── Makefile
└── README.md
```

---

## 4. Sprint 0 — Fondations

**Durée estimée** : 1,5 semaine  
**Objectif** : tout le monde peut lancer le projet localement et les pipelines CI/CD sont opérationnels.

### 4.1 Tâches Back‑end

- [ ] **Initialiser le projet FastAPI**
  - Créer `pyproject.toml` avec poetry (`fastapi`, `uvicorn[standard]`, `sqlalchemy[asyncio]`, `alembic`, `pydantic-settings`, `python-jose[cryptography]`, `passlib[argon2]`, `asyncpg`, `httpx`, `pytest`, `pytest-asyncio`, `ruff`, `mypy`)
  - Configurer `app/config.py` avec `BaseSettings` (lecture `.env` + Key Vault via env var)
  - Structurer `app/main.py` : middlewares CORS, rate‑limit, OpenTelemetry, handler erreurs global
- [ ] **Base de données**
  - Configurer `database.py` : engine async SQLAlchemy, session factory
  - Écrire tous les modèles ORM (voir §3.2 spec) avec UUID primaires, timestamps `created_at`/`updated_at`
  - Initialiser Alembic (`alembic init migrations`), écrire migration initiale `0001_initial`
  - Ajouter les indexes : `Contact.email` unique, `Deal(stage, expected_close)`, GIN sur colonnes JSONB/tags
- [ ] **Authentification**
  - `POST /auth/login` : vérification Argon2, retour Access JWT (15 min) + Refresh JWT (7 jours)
  - `POST /auth/refresh` : rotation du refresh token
  - Middleware `get_current_user` (dependency FastAPI)
  - Tests unitaires : hash/verify password, encode/decode JWT
- [ ] **Audit log**
  - Utilitaire `audit.py` : écriture `AuditLog` à chaque mutation (via events SQLAlchemy ou décorateur)
- [ ] **OpenTelemetry**
  - Instrumentation FastAPI + SQLAlchemy avec `opentelemetry-sdk`, export OTLP (Azure Monitor / Jaeger local)
- [ ] **Dockerfile backend**
  - Image multi‑stage : builder (poetry install) → runtime (slim, non-root user)
  - `ENTRYPOINT ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`

### 4.2 Tâches Front‑end

- [ ] **Initialiser le projet Vite**
  - `pnpm create vite frontend --template react-ts`
  - Ajouter : `@tanstack/react-query`, `react-router-dom`, `zustand`, `react-hook-form`, `zod`, `@mui/material`, `i18next`, `react-i18next`
- [ ] **Structure des dossiers** (voir §3)
- [ ] **Router** : routes protégées (guard `RequireAuth`), layout principal
- [ ] **Client HTTP** : wrapper `axios` ou `fetch` avec injection du token Bearer, intercepteur 401 → refresh
- [ ] **Page de login** : formulaire React Hook Form + Zod, appel `POST /auth/login`, stockage token en mémoire + refresh en httpOnly cookie (si supporté) ou localStorage avec mitigation XSS
- [ ] **Thème MUI** : tokens couleurs, mode clair/sombre, typographie
- [ ] **i18n** : fichiers `fr.json` / `en.json`, langue par défaut fr

### 4.3 Infrastructure & DevOps

- [ ] **Docker Compose** local : services `api`, `db`, `front`, `adminer`, `mailhog`
- [ ] **Makefile** : `up`, `down`, `test-back`, `test-front`, `lint`, `migrate`, `seed`
- [ ] **pre‑commit** hooks : `ruff`, `mypy`, `eslint`, `prettier`
- [ ] **GitHub Actions** — CI Backend (`ci-backend.yml`) :
  - Trigger : push / PR sur `main` et `develop`
  - Jobs : `lint` (ruff, mypy) → `test` (pytest, coverage ≥ 80% domaine critique) → `build` (docker build)
- [ ] **GitHub Actions** — CI Frontend (`ci-frontend.yml`) :
  - Jobs : `lint` (ESLint, TSC) → `test` (Vitest) → `build` (vite build)
- [ ] **Provisionnement Azure Sprint 0** (voir §11 pour le détail complet) :
  - Resource Group `crm-freelance-dev`
  - Azure PostgreSQL Flexible Server (B1ms)
  - Azure Blob Storage (LRS)
  - Azure Key Vault (Standard)
  - Azure Container Registry (Basic)
  - Azure App Service Plan (B2) + App Service Linux
  - Azure Static Web Apps (Free tier)
  - Application Insights + Log Analytics Workspace

### 4.4 Critères d'acceptation Sprint 0

- `make up` démarre l'ensemble de la stack en < 2 min
- `make test-back` passe avec ≥ 1 test d'auth
- `make migrate` applique la migration initiale sans erreur
- `GET /health` répond `200 {"status": "ok"}` avec `trace_id` dans les logs
- La page de login s'affiche et retourne un token valide
- Pipeline CI passe au vert sur une PR de test

---

## 5. Sprint 1 — Contacts / Entreprises / Leads

**Durée estimée** : 2 semaines

### 5.1 Back‑end

#### Endpoints à implémenter

| Méthode | Endpoint | Description |
|---|---|---|
| GET | `/companies` | Liste paginée (search, tag) |
| POST | `/companies` | Création |
| GET | `/companies/{id}` | Détail |
| PUT | `/companies/{id}` | Mise à jour |
| DELETE | `/companies/{id}` | Soft‑delete |
| GET | `/contacts` | Liste paginée (search, tag, company_id) |
| POST | `/contacts` | Création |
| GET | `/contacts/{id}` | Détail avec historique activités |
| PUT | `/contacts/{id}` | Mise à jour |
| DELETE | `/contacts/{id}` | Soft‑delete (restaurable 30 j) |
| GET | `/leads` | Liste (status, source) |
| POST | `/leads` | Création rapide (3 champs min) |
| GET | `/leads/{id}` | Détail |
| PATCH | `/leads/{id}` | Mise à jour statut/score |
| POST | `/leads/{id}/convert` | → Contact + Opportunité (transfert notes/tags) |
| POST | `/contacts/merge` | Fusion de doublons |

#### Logique métier critique

- **Soft‑delete** : champ `deleted_at` nullable, filtre automatique dans les queries (SQLAlchemy event ou mixin)
- **Conversion Lead** : transaction atomique — créer `Contact`, créer `Deal`, copier `notes`/`tags`, passer lead `status = "Converti"`
- **Fusion doublons** : entité cible hérite des activités, documents et liens de l'entité source ; source soft‑deleted

#### Import CSV

- Endpoint `POST /contacts/import` (multipart CSV)
- Détection automatique de l'encodage (chardet)
- Mapping colonnes assisté (retourne le mapping détecté, l'appelant confirme)
- Validation Pydantic ligne par ligne → retour rapport `{success: N, errors: [{line, message}]}`
- Import transactionnel (tout ou rien configurable)

#### Tests

- Unitaires : conversion lead, fusion, soft-delete, import CSV (cas nominaux + erreurs)
- Intégration : CRUD complet via `httpx.AsyncClient` sur DB de test

### 5.2 Front‑end

- **Page Leads** : liste avec filtres (statut, source), création rapide (modale 3 champs), bouton « Convertir »
- **Page Contacts** : liste avec search + filtres tags, fiche détail (informations + activités liées)
- **Page Entreprises** : liste, fiche détail avec contacts rattachés
- **Formulaires** : React Hook Form + Zod, validation inline, sauvegarde au clavier (Ctrl+S)
- **Import CSV** : wizard 3 étapes (upload → mapping → confirmation/erreurs)
- **Tags** : composant autocomplete avec suggestions (query `GET /tags`)

### 5.3 Critères d'acceptation Sprint 1

- [ ] Créer un contact en ≤ 3 clics depuis la liste
- [ ] Importer un CSV de 100 contacts avec rapport d'erreurs correct
- [ ] Convertir un lead → contact + opportunité, les notes sont transférées
- [ ] Soft‑delete d'un contact, vérifier qu'il disparaît de la liste mais est restaurable

---

## 6. Sprint 2 — Pipeline Opportunités (Kanban)

**Durée estimée** : 2 semaines

### 6.1 Back‑end

#### Endpoints

| Méthode | Endpoint | Description |
|---|---|---|
| GET | `/deals` | Liste (stage, close_before, company_id) |
| POST | `/deals` | Création |
| GET | `/deals/{id}` | Détail |
| PATCH | `/deals/{id}` | Mise à jour partielle |
| POST | `/deals/{id}/move` | Changer de stage (kanban) |
| DELETE | `/deals/{id}` | Soft‑delete |
| GET | `/pipeline/stages` | Étapes configurées |
| PUT | `/pipeline/stages` | Reconfigurer les étapes |
| GET | `/dashboard/pipeline` | Agrégats par stage (nb, montant, pondéré) |
| GET | `/dashboard/forecast` | Forecast mois + 3 mois glissants |

#### Logique métier critique

- **Montant pondéré** = `amount * probability / 100` — calculé à la volée ou colonne générée
- **Verrouillage** : opportunité `Gagnée` → champs `amount` et `expected_close` en lecture seule (validé en service layer)
- **Historique de stage** : enregistrer chaque transition dans `AuditLog` pour traçabilité pipeline
- **Forecast** : somme des `amount * probability` des deals dont `expected_close` est dans la période et `stage NOT IN ('Perdu')`

#### Configuration pipeline

- Table `PipelineStage(id, name, order, default_probability, is_closed, is_won)` avec seed par défaut :  
  `Découverte(10%) → Qualification(25%) → Proposition(50%) → Négociation(75%) → Gagné(100%) / Perdu(0%)`

### 6.2 Front‑end

- **Vue Kanban** : colonnes = stages, cartes = deals (titre, montant, pondéré, date clôture, avatar contact)
  - Drag‑and‑drop avec `@dnd-kit/core` (accessible, annonces ARIA)
  - Optimistic update : déplacer la carte localement, appel `POST /deals/{id}/move`, rollback si erreur
- **Fiche Deal** : panneau latéral (slide-over) avec tous les champs, historique activités, documents joints
- **Dashboard pipeline** : résumé par stage (cartes métriques), graphique forecast (Recharts)
- **Configuration étapes** : page Paramètres → drag‑drop pour réordonner, édition inline nom/probabilité

### 6.3 Critères d'acceptation Sprint 2

- [ ] Déplacer une opportunité entre stages par drag‑drop, le montant pondéré se recalcule
- [ ] Le forecast affiche des données cohérentes avec les deals en base
- [ ] Une opportunité Gagnée ne peut pas être modifiée (montant/date) depuis l'UI
- [ ] `GET /dashboard/pipeline` répond en < 300 ms avec 200 deals en base

---

## 7. Sprint 3 — Missions & Documents

**Durée estimée** : 2 semaines

### 7.1 Back‑end — Missions

#### Endpoints

| Méthode | Endpoint | Description |
|---|---|---|
| POST | `/projects` | Création (depuis deal ou directe) |
| GET | `/projects` | Liste (status, company_id) |
| GET | `/projects/{id}` | Détail + jalons |
| PATCH | `/projects/{id}` | Mise à jour |
| DELETE | `/projects/{id}` | Soft‑delete |
| POST | `/projects/{id}/milestones` | Ajout jalon |
| PATCH | `/projects/{id}/milestones/{mid}` | Mise à jour jalon |
| DELETE | `/projects/{id}/milestones/{mid}` | Suppression jalon |
| POST | `/deals/{id}/create_project` | Créer mission depuis opportunité gagnée |

#### Logique métier

- Création depuis deal : copie `company_id`, `contact_id`, `title` ; montant deal → `budget`
- Statuts mission : `Planifié → En cours → Suspendu → Clôturé`
- Jalons : `name`, `due_date`, `amount`, `status (Pending/Done/Delayed)` ; somme jalons ≤ budget mission (warning non bloquant v1)

### 7.2 Back‑end — Documents

#### Endpoints

| Méthode | Endpoint | Description |
|---|---|---|
| POST | `/documents` | Upload (multipart) ou lien externe |
| GET | `/documents/{id}` | Métadonnées + URL signée (SAS 1h) |
| DELETE | `/documents/{id}` | Soft‑delete (blob conservé 30j) |

#### Logique stockage Azure Blob

- Bucket/container par type : `documents-proposals`, `documents-contracts`, `documents-other`
- Nom blob : `{entity_type}/{entity_id}/{uuid}_{filename}` (pas de caractères spéciaux)
- SAS token : lecture, durée 1h, régénéré à chaque `GET /documents/{id}`
- Managed Identity de l'App Service → accès Blob sans clé (RBAC `Storage Blob Data Contributor`)

### 7.3 Front‑end

- **Page Missions** : liste avec statuts colorés, jalons à venir mis en avant
- **Fiche Mission** : détail, timeline jalons (composant Stepper MUI), section documents
- **Upload documents** : drag‑drop zone, progress bar, aperçu nom + taille avant upload
- **Lien externe** : champ URL (OneDrive/GDrive) avec icône de type

### 7.4 Critères d'acceptation Sprint 3

- [ ] Créer une mission depuis un deal Gagné en 1 clic
- [ ] Uploader un PDF, récupérer une URL signée valide 1h
- [ ] Modifier le statut d'un jalon, l'audit log enregistre la transition
- [ ] La liste des missions affiche les jalons dus dans les 7 prochains jours en orange

---

## 8. Sprint 4 — Activités, Rappels & Recherche

**Durée estimée** : 2 semaines

### 8.1 Back‑end — Activités

#### Endpoints

| Méthode | Endpoint | Description |
|---|---|---|
| POST | `/activities` | Créer activité (call, email, task, meeting) |
| GET | `/activities` | Liste (related_type, related_id, type, date_from) |
| PATCH | `/activities/{id}` | Modifier (résultat, notes) |
| DELETE | `/activities/{id}` | Suppression |
| GET | `/activities/upcoming` | Tâches dues dans les 48h (pour rappels) |

#### Rappels & notifications

- Champ `reminder_at` (datetime UTC) sur `Activity`
- **Worker de rappel** : tâche périodique (APScheduler ou Celery Beat) toutes les 5 min :
  - Chercher activités avec `reminder_at <= now + 5min` et `reminder_sent = false`
  - Envoyer email via SMTP (Azure Communication Services ou SendGrid)
  - Optionnel : notification web via Server-Sent Events (`GET /notifications/stream`)
  - Marquer `reminder_sent = true`

### 8.2 Back‑end — Recherche globale

#### Endpoint

```
GET /search?q=<terme>&types=contact,company,deal,project&limit=20
```

- Recherche PostgreSQL full‑text (`to_tsvector` + `plainto_tsquery`) sur champs clés
- Index GIN sur colonnes `notes`, `tags`, `name`/`title`/`email`
- Résultat : liste de hits groupés par type `{type, id, title, excerpt}`
- Limite 50 résultats, highlight du terme trouvé (côté DB ou back)

### 8.3 Front‑end

- **Timeline activités** : par entité (contact, deal, mission) avec filtres type, tri chronologique inverse
- **Formulaire activité** : type, date/heure, durée, notes, entité liée (autocomplete), rappel
- **Barre de recherche globale** : `Ctrl+K` / icône loupe, overlay avec résultats groupés, navigation clavier
- **Centre de notifications** : cloche dans la navbar, badge non-lus, liste rappels à venir

### 8.4 Critères d'acceptation Sprint 4

- [ ] Créer une tâche avec rappel → recevoir un email à l'heure prévue
- [ ] Recherche `"Acme"` retourne contacts, entreprises et deals correspondants
- [ ] `GET /search?q=acme` répond en < 300 ms avec 500 entités en base
- [ ] Navigation clavier complète dans l'overlay de recherche (Tab, Entrée, Echap)

---

## 9. Sprint 5 — RGPD, Export & Observabilité

**Durée estimée** : 2 semaines

### 9.1 RGPD

#### Back‑end

- `DELETE /contacts/{id}` → soft‑delete (existant)
- `POST /contacts/{id}/anonymize` :
  - Remplace `first_name`, `last_name`, `email`, `phone`, `social` par valeurs neutres (`[Anonymisé]`)
  - Conserve métriques agrégées (nb deals, montant total) dans un champ JSONB `anonymized_stats`
  - Écrit `AuditLog` avec acteur, date, preuve
- Politique de rétention : script/commande `python -m app.tasks.gdpr_cleanup` — anonymise les leads `Nouveau` inactifs depuis > 36 mois
- Consentement : `Contact.consent_rgpd` (bool) + `consent_date` (timestamp), retourné dans l'export

#### Front‑end

- Bouton « Anonymiser » sur fiche contact (confirmation modale)
- Indicateur visuel consentement RGPD sur fiche et liste
- Page Paramètres → section RGPD : date dernière purge, lancer purge manuelle

### 9.2 Export CSV

#### Back‑end

- `GET /export/deals?stage=&close_before=` → CSV streaming (StreamingResponse)
- `GET /export/projects?status=` → CSV streaming
- `GET /export/contacts?tag=` → CSV avec champ consentement RGPD
- Format : UTF‑8 BOM, délimiteur `;` (compatibilité Excel FR)
- Headers HTTP : `Content-Disposition: attachment; filename="deals_YYYYMMDD.csv"`

### 9.3 Observabilité complète

#### Back‑end

- **Logging structuré** : `structlog` ou `python-json-logger` — champs : `timestamp`, `level`, `trace_id`, `span_id`, `user_id`, `endpoint`, `duration_ms`, `status_code`
- **Métriques Prometheus** : exposer `GET /metrics` (protégé IP ou token interne)
  - `http_requests_total{method, endpoint, status}`
  - `http_request_duration_seconds{endpoint}` — histogramme
  - `db_query_duration_seconds` — instrumenté via SQLAlchemy events
- **Traces** : OpenTelemetry → Azure Monitor (connexion string Application Insights)
- **Alertes** dans Azure Monitor :
  - Latence p95 > 500 ms pendant 5 min → alerte email
  - Taux d'erreur 5xx > 1% pendant 5 min → alerte email + PagerDuty (optionnel)
  - Espace disque DB > 80% → alerte

#### Front‑end

- Sentry SDK (`@sentry/react`) : capture erreurs JS non gérées, performance traces
- Source maps uploadées vers Sentry lors du build CI

### 9.4 Critères d'acceptation Sprint 5

- [ ] Anonymiser un contact : ses PII sont effacées, les métriques agrégées sont conservées
- [ ] Export CSV deals s'ouvre correctement dans Excel (encodage, délimiteur)
- [ ] Application Insights reçoit traces et logs ; requête lente visible dans Perf dashboard
- [ ] Alerte de test (latence simulée) déclenchée et reçue par email

---

## 10. Phase Beta — QA, Perf & Polishing

**Durée estimée** : 1,5 semaine

### 10.1 Tests End‑to‑End (Playwright)

Scénarios prioritaires :

1. **Scénario complet** : Login → Créer lead → Convertir en deal → Déplacer dans pipeline → Créer mission → Uploader document → Créer activité avec rappel
2. **Import CSV** : Upload fichier → Mapping → Confirmation → Vérifier données en base
3. **Recherche globale** : Saisir terme → Naviguer vers résultat → Vérifier fiche
4. **RGPD** : Anonymiser contact → Vérifier effacement PII → Export CSV avec champ consentement

### 10.2 Tests de performance

- Outil : **k6** ou **Locust**
- Scénarios :
  - 50 utilisateurs concurrents sur `GET /deals?stage=` → p95 < 300 ms
  - Upload document 10 Mo → < 5 s
  - Import CSV 1 000 lignes → < 10 s
- Actions si seuil dépassé : analyser EXPLAIN ANALYZE, ajouter index, activer connection pooling (PgBouncer)

### 10.3 Audit sécurité

- Scan OWASP ZAP (baseline scan) sur staging
- Review manuelle des headers HTTP (CSP, HSTS, X‑Frame‑Options)
- Vérification rotation secrets Key Vault
- Test de force brute login (rate‑limit à 60 req/min validé)

### 10.4 UX Polishing

- [ ] Vérifier tous les états vides (liste vide → appel à l'action)
- [ ] Messages d'erreur compréhensibles (pas de stack trace en prod)
- [ ] Loading skeletons sur toutes les listes
- [ ] Mode sombre complet (tokens MUI `colorScheme`)
- [ ] Accessibilité : audit axe-core, corriger violations WCAG AA
- [ ] Performance front : Lighthouse ≥ 85 (Performance, Accessibility, Best Practices)

---

## 11. Infrastructure Azure — Provisionnement

### 11.1 Ressources Azure à créer

```
Subscription
└── Resource Group: crm-freelance-{env}
    ├── Azure Static Web Apps          crm-front-{env}
    ├── Azure App Service Plan         crm-asp-{env}          (Linux, B2)
    ├── Azure App Service              crm-api-{env}          (Docker, Linux)
    ├── Azure Container Registry       crmacr{env}            (Basic)
    ├── Azure Database for PostgreSQL  crm-db-{env}           (Flexible, B_Standard_B2ms)
    ├── Azure Storage Account          crmdocs{env}           (LRS, StorageV2)
    │   └── Blob containers: documents-proposals, documents-contracts, documents-other
    ├── Azure Key Vault                crm-kv-{env}           (Standard)
    ├── Log Analytics Workspace        crm-law-{env}
    └── Application Insights           crm-ai-{env}
```

### 11.2 Bicep — structure IaC

```bicep
// infra/main.bicep
targetScope = 'resourceGroup'

param env string = 'dev'
param location string = resourceGroup().location
param postgresAdminLogin string
@secure()
param postgresAdminPassword string

module postgres 'modules/postgres.bicep' = { ... }
module storage  'modules/storage.bicep'  = { ... }
module keyvault 'modules/keyvault.bicep' = { ... }
module appservice 'modules/appservice.bicep' = {
  params: {
    keyVaultName: keyvault.outputs.name
    postgresHost: postgres.outputs.fqdn
    acrLoginServer: acr.outputs.loginServer
  }
}
module swa 'modules/staticwebapp.bicep' = { ... }
```

### 11.3 Secrets dans Azure Key Vault

| Secret | Description |
|---|---|
| `postgres-connection-string` | `postgresql+asyncpg://user:pass@host/db` |
| `jwt-secret-key` | Clé HMAC‑SHA256, ≥ 256 bits |
| `storage-account-connection-string` | Pour SDK Azure Blob |
| `app-insights-connection-string` | Instrumentation key |
| `smtp-password` | Mot de passe SMTP (rappels email) |

**Accès via Managed Identity** : App Service → `Key Vault Secrets User` RBAC sur le Key Vault.  
Pas de secrets dans le code ni dans les variables d'env en clair (sauf `KEY_VAULT_URL`).

### 11.4 Configuration App Service

```
# App Settings (référencent Key Vault via @Microsoft.KeyVault(SecretUri=...))
DATABASE_URL        = @KV(postgres-connection-string)
JWT_SECRET_KEY      = @KV(jwt-secret-key)
AZURE_STORAGE_URL   = @KV(storage-account-connection-string)
APPLICATIONINSIGHTS_CONNECTION_STRING = @KV(app-insights-connection-string)
ENVIRONMENT         = prod
ALLOWED_ORIGINS     = https://crm-front-prod.azurestaticapps.net
```

### 11.5 Réseau & sécurité Azure

- **HTTPS only** activé sur App Service
- **TLS 1.2 minimum** sur App Service et PostgreSQL
- **Outbound IP** App Service allowlistée dans les règles firewall PostgreSQL
- **Private Endpoint** PostgreSQL (optionnel v1.1) : VNet injection App Service + PE sur DB
- **CORS** App Service : uniquement l'origin SWA (prod) ou `localhost:5173` (dev)
- **Azure WAF** (optionnel v2) : Front Door Premium + WAF policy (OWASP 3.2)

---

## 12. CI/CD — GitHub Actions

### 12.1 Pipeline Backend (`ci-backend.yml`)

```
Trigger: push/PR → main, develop
Jobs:
  1. lint
     - ruff check .
     - mypy app/
     - bandit -r app/ (SAST)
     - pip-audit (dépendances vulnérables)
  
  2. test (needs: lint)
     - Services: postgres:15 (GitHub Actions service container)
     - alembic upgrade head
     - pytest --cov=app --cov-report=xml
     - Vérification coverage ≥ 80% sur modules deals/ et projects/
     - Upload coverage → Codecov
  
  3. build (needs: test, only on main/tags)
     - docker build -t crmacr{env}.azurecr.io/api:{sha} .
     - docker scan (Trivy — scan CVE image)
     - docker push → ACR
```

### 12.2 Pipeline Frontend (`ci-frontend.yml`)

```
Trigger: push/PR → main, develop
Jobs:
  1. lint
     - pnpm eslint
     - pnpm tsc --noEmit

  2. test (needs: lint)
     - pnpm vitest run --coverage
     - Vérification coverage ≥ 70%
  
  3. build (needs: test, only on main/tags)
     - pnpm build
     - Upload artifact dist/
     - Sentry upload source maps
```

### 12.3 Pipeline Déploiement (`deploy.yml`)

```
Trigger: push → main (staging) | tag v*.*.* (prod)
  
  Inputs: environment (staging | prod)

Jobs:
  1. deploy-frontend
     - Télécharger artifact dist/
     - az staticwebapp deploy → Azure Static Web Apps
     - Smoke test: curl https://<swa-url>/health

  2. deploy-backend (needs: deploy-frontend ne bloque pas)
     - az acr build (ou docker pull depuis CI)
     - az webapp config container set → nouvelle image
     - az webapp deployment slot swap (staging → prod) [prod uniquement]
     - Smoke test: curl https://<api-url>/api/v1/health

  3. migrate-db (needs: deploy-backend)
     - Lancer alembic upgrade head via az webapp ssh ou
       via un Azure Container Instance éphémère (recommandé)
     - Vérifier exit code 0
  
  4. e2e-smoke (needs: migrate-db) [staging uniquement]
     - playwright test tests/e2e/smoke.spec.ts
     - Si échec → rollback slot swap automatique
```

### 12.4 Stratégie de déploiement

| Environnement | Stratégie | Rollback |
|---|---|---|
| **dev** | Push direct (auto-deploy) | Re-run CI avec commit précédent |
| **staging** | Deploy sur slot `staging` puis swap | Swap inverse immédiat |
| **prod** | Slot swap depuis staging validé | Slot swap inverse (< 30 s) |

---

## 13. Sécurité & conformité

### 13.1 Authentification & tokens

- Access JWT : `exp = now + 15 min`, signé HS256, claims : `sub` (user_id), `jti`, `iat`
- Refresh JWT : `exp = now + 7 jours`, stocké en DB (`RefreshToken` table), révocable
- Rotation refresh : à chaque usage, nouveau refresh émis, ancien invalidé
- Liste de révocation : table DB `revoked_tokens(jti, revoked_at)` — nettoyage automatique des tokens expirés

### 13.2 Headers HTTP (back & front)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; ...
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### 13.3 Validation & sanitization

- Pydantic v2 : validation stricte, pas d'extra fields, longueurs max sur tous les `str`
- Paramètres SQL : SQLAlchemy ORM (pas de f-strings SQL)
- XSS front : MUI échappe par défaut ; ne pas utiliser `dangerouslySetInnerHTML`
- Uploads : vérifier MIME type côté serveur (pas seulement extension), taille max 25 Mo v1

### 13.4 Rate limiting

- `slowapi` (FastAPI) : 60 req/min par IP sur tous les endpoints `auth/`
- 200 req/min par IP sur endpoints API authentifiés
- Réponse `429 Too Many Requests` avec header `Retry-After`

---

## 14. Observabilité & opérations

### 14.1 SLI / SLO

| SLI | SLO |
|---|---|
| Disponibilité (5xx < total) | ≥ 99,5% / mois |
| Latence p95 endpoints principaux | < 300 ms |
| Latence p95 recherche globale | < 500 ms |
| Taux de succès migrations DB | 100% |

### 14.2 Dashboards Azure Monitor

- **API Health** : RPS, latence p50/p95/p99, taux 4xx/5xx
- **Database** : CPU%, connexions actives, latence queries, stockage
- **Blob Storage** : transactions, bandwidth, erreurs
- **Application** : top endpoints lents, top erreurs, utilisateurs actifs

### 14.3 Runbook incidents

| Incident | Détection | Action |
|---|---|---|
| API down (5xx > 10%) | Alerte Azure Monitor | Vérifier logs App Service → slot swap si nécessaire |
| DB connexions saturées | Alerte > 80% max connections | Redémarrer App Service, analyser requêtes longues |
| Espace Blob > 80% | Alerte stockage | Archiver ou supprimer blobs orphelins |
| Token JWT compromis | Détection manuelle/audit | Révoquer tous les refresh tokens → forcer re-login |

### 14.4 Backups & restauration

- PostgreSQL : rétention 7 jours (dev), 35 jours (prod), PITR activé
- Test de restauration : mensuel sur environnement de test isolé, documenter le RTO mesuré
- Blob Storage : versioning activé, soft delete 30 jours
- **Objectifs** : RTO < 4h, RPO < 1h

---

## 15. Tests — stratégie globale

### 15.1 Pyramide de tests

```
         [E2E Playwright]
             (5-10 scénarios clés)
        [Tests d'intégration API]
           (tous les endpoints)
    [Tests unitaires — domaine métier]
     (opportunités, missions, auth, RGPD)
```

### 15.2 Couverture cible

| Module | Type | Cible |
|---|---|---|
| `services/deals.py` | Unitaire | ≥ 90% |
| `services/projects.py` | Unitaire | ≥ 90% |
| `utils/security.py` | Unitaire | ≥ 95% |
| `routers/` (tous) | Intégration | ≥ 80% |
| Scénarios E2E | Playwright | 5 scénarios clés |

### 15.3 Fixtures & données de test

- `conftest.py` : fixture `async_client` (FastAPI TestClient async), fixture `db_session` (transaction rollback après chaque test)
- Factory Boy pour générer des entités de test réalistes
- Seed DB de staging avec jeu de données réaliste (50 contacts, 20 deals, 5 missions)

---

## 16. Gestion des risques

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Perte de données DB | Faible | Critique | Backups PITR + test restauration mensuel |
| Breach sécurité (token volé) | Faible | Élevé | JWT courts + révocation refresh + rate-limit |
| Performance dégradée (N+1 queries) | Moyenne | Moyen | `selectinload` SQLAlchemy, EXPLAIN ANALYZE en CI optionnel |
| Dérive coûts Azure | Faible | Moyen | Budget alerts Azure Cost Management (seuil 80% + 100%) |
| Dépendance externe (SaaS email) | Moyenne | Faible | Azure Communication Services en fallback |
| Besoin collaborateur court-terme | Faible | Faible | RBAC préparé (rôle `Editor` activable en 1 migration) |

---

## 17. Checklist de mise en production

### Infrastructure

- [ ] Toutes les ressources Azure provisionnées via Bicep (`prod.parameters.json`)
- [ ] TLS activé, HTTPS only, HSTS configuré
- [ ] Tous les secrets dans Key Vault, Managed Identity configurée
- [ ] Private Endpoint PostgreSQL (ou firewall IP strict)
- [ ] Budget alerts Azure Cost Management configurées
- [ ] Backup PostgreSQL validé (test PITR réussi)

### Application

- [ ] Variable `ENVIRONMENT=prod` — pas de debug, pas de stack trace exposé
- [ ] CORS limité à l'origin SWA prod
- [ ] Rate limiting actif et testé
- [ ] Migrations Alembic appliquées, rollback testé
- [ ] Seed des données initiales (stages pipeline par défaut, utilisateur admin)

### Sécurité

- [ ] Scan OWASP ZAP baseline sur staging → zéro finding CRITICAL/HIGH non traité
- [ ] Headers HTTP vérifiés (securityheaders.com)
- [ ] Rotation secrets Key Vault planifiée (6 mois)
- [ ] Audit log opérationnel (vérifier une entrée après mutation)

### Observabilité

- [ ] Application Insights reçoit traces et logs
- [ ] Dashboard Azure Monitor opérationnel
- [ ] Alertes configurées et testées (alerte test déclenchée → email reçu)
- [ ] Sentry front opérationnel (erreur test capturée)

### Tests & qualité

- [ ] Pipeline CI vert sur `main`
- [ ] Coverage ≥ 80% sur domaines critiques
- [ ] E2E scénario complet vert sur staging
- [ ] Tests de performance : p95 < 300 ms validé
- [ ] Lighthouse front ≥ 85

### Documentation

- [ ] `README.md` : setup local, commandes make, architecture
- [ ] `CONTRIBUTING.md` : conventions de code, PR process
- [ ] OpenAPI exporté et versionné (`/api/v1/openapi.json`)
- [ ] Runbook incidents dans le wiki du dépôt

---

## Annexe A — Estimation des charges

| Sprint | Domaine | Charge estimée |
|---|---|---|
| Sprint 0 | Fondations, CI/CD, Infra | 8–10 j/h |
| Sprint 1 | Contacts / Leads / Import | 8–10 j/h |
| Sprint 2 | Pipeline Kanban / Dashboard | 8–10 j/h |
| Sprint 3 | Missions / Documents / Blob | 8–10 j/h |
| Sprint 4 | Activités / Rappels / Recherche | 8–10 j/h |
| Sprint 5 | RGPD / Export / Observabilité | 6–8 j/h |
| Beta | QA, Perf, Polishing | 6–8 j/h |
| **Total** | | **~52–66 j/h** |

---

## Annexe B — Coûts Azure estimés (prod, tier minimal)

| Service | SKU | Coût/mois estimé |
|---|---|---|
| App Service (Linux) | B2 (2 vCPU, 3,5 Go) | ~28 € |
| PostgreSQL Flexible | B_Standard_B2ms | ~35 € |
| Azure Blob Storage | LRS, 50 Go | ~1 € |
| Azure Key Vault | Standard, < 10K ops | ~0,5 € |
| Container Registry | Basic | ~5 € |
| Static Web Apps | Free | 0 € |
| Application Insights | Pay-as-you-go (< 5 Go/mois) | ~0–5 € |
| **Total estimé** | | **~70–80 €/mois** |

> Ajuster selon usage réel. Activer les alertes Azure Cost Management à 80% et 100% du budget mensuel.

---

**Fin du plan.**
