# CRM Freelance — Spécifications Fonctionnelles & Techniques

**Auteur** : Christophe Barré  
**Version** : 1.0  
**Date** : 2026‑02‑18  
**Périmètre** : Application web de gestion de prospects, contacts et missions pour un freelance.

---

## 1. Contexte & Objectifs

### 1.1 Contexte
En tant que freelance, la visibilité sur le pipeline commercial, les interactions clients et l’exécution des missions est essentielle. L’outil doit rester **léger**, **rapide** à utiliser, et **extensible**.

### 1.2 Objectifs métiers
- Centraliser les **prospects**, **contacts**, **entreprises** et **missions**.
- Suivre le **pipeline** (stades/opportunités) et les **actions** (appels, emails, tâches).
- Générer et suivre **devis/propositions** (facultatif) et **contrats/PO**.
- Consolider les **revenus prévisionnels** et **réalisés**.
- Historiser les **interactions** et pièces jointes.
- Assurer une **conformité RGPD** minimale (droits d’accès/suppression, consentement).
- Offrir une **base API** propre pour futures intégrations (calendrier, email, compta).

### 1.3 Hors périmètre (v1)
- Facturation & comptabilité avancées (peut être intégrée plus tard via export CSV/Excel).
- Marketing automation complexe.
- Multi‑tenant (v1 = mono‑utilisateur).

---

## 2. Personas & Parcours

### 2.1 Persona principal
- **Freelance** (propriétaire des données) : crée/qualifie des leads, suit les deals, gère les missions, enregistre les temps (optionnel), génère des propositions.

### 2.2 Parcours clefs
1. **Capturer** un lead (formulaire rapide, import CSV, ou Zapier/Email to CRM future).
2. **Qualifier** → convertir en contact + opportunité.
3. **Suivre** l’opportunité par étapes (ex. : Découverte → Proposition → Négociation → Gagné/Perdu).
4. **Démarrer la mission** (si gagné), définir livrables, jalons, taux journalier, dates.
5. **Tracer les interactions** (appels, emails, tâches), joindre documents.
6. **Piloter** via tableaux de bord (pipeline, revenus prévisionnels, missions en cours).

---

## 3. Exigences Fonctionnelles

### 3.1 Entités & Propriétés (v1)

- **Entreprise (Account)**
  - Nom, SIREN/TVA (optionnel), secteur, taille, site web
  - Adresse(s), notes, tags
- **Contact**
  - Prénom, nom, email (unique), téléphone, rôle, entreprise (FK), consentement RGPD
  - Réseaux sociaux (LinkedIn), notes, tags
- **Prospect / Lead**
  - Source (web, recommandation, évènement, autre), statut (Nouveau/Qualifié/Perdu)
  - Intérêt, score (manuel v1), description
- **Opportunité (Deal)**
  - Titre, entreprise/contact lié(s), montant (HT), probabilité (%), devise
  - Stade pipeline (enum), date de clôture estimée, origine, notes, tags
- **Mission (Project/Engagement)**
  - Titre, client (entreprise/contact), statut (Planifié/En cours/Suspendu/Clôturé)
  - Dates (début/fin), TJM/forfait, budget (jours/€), jalons, livrables
- **Activité**
  - Type (Appel/Email/Tâche/RDV), date/heure, durée, résultat, notes, liés à (contact/opportunité/mission)
  - Rappels & notifications
- **Document**
  - Type (Brief, Proposition, Contrat, Autre), fichier, version, lié à (opportunité/mission)
- **Journal / Historique**
  - Audit des changements (qui/quand/quoi), commentaires
- **Utilisateur**
  - Mono‑utilisateur v1 (freelance). Préparer RBAC pour v2.

### 3.2 Backlog fonctionnel (User Stories)

- **Leads & Contacts**
  - En tant que freelance, je peux **créer un lead** avec 3 champs minimum (nom, email, source) pour capturer rapidement.
  - Je peux **convertir un lead** en **contact + opportunité**.
  - Je peux **fusionner** doublons (contacts/entreprises).
- **Pipeline**
  - Je peux **configurer les étapes** du pipeline (avec un set par défaut).
  - Je peux **glisser‑déposer** une opportunité entre étapes (kanban).
  - Le **montant pondéré** = montant × probabilité, visible en pipeline.
- **Missions**
  - Je peux **créer une mission** à partir d’une opportunité gagnée.
  - Je peux **définir jalons** (nom, date cible, montant, statut).
  - (Option) Je peux **enregistrer des temps** (date, durée, note) au niveau mission/jalon.
- **Activités**
  - Je peux **planifier une tâche** avec rappel (email/notification web).
  - Je peux **journaliser** un appel/email manuel (résumé et résultat).
- **Documents**
  - Upload / versionnage simple, lien vers Google Drive/OneDrive (URL).
  - Générer une **Proposition** à partir d’un **modèle** (Markdown → PDF) [v1: export Markdown].
- **Recherche & Tags**
  - Recherche globale (entreprises, contacts, opportunités, missions).
  - Tags libres + suggestions (auto‑complétion).
- **Dashboards**
  - Pipeline par étape (nombre, montants, montants pondérés).
  - **Forecast** (ce mois, 3 mois glissants).
  - Missions actives (jalons à venir, risques, reste à faire).
- **Import/Export**
  - Import CSV **Contacts** / **Entreprises** / **Leads** (mapping assisté).
  - Export CSV des **Opportunités** et **Missions**.
- **RGPD**
  - Stocker **consentement** au niveau contact, **droit d’oubli** (anonymisation).
  - Politique de rétention (ex. 36 mois pour leads inactifs).

### 3.3 Règles de gestion (extraits)
- Conversion Lead → Contact + Opportunité **transfère** notes et tags.
- Suppression d’un Contact **soft‑delete** (restaurable 30 jours).
- Une Opportunité **Gagnée** est **verrouillée** (montant, date de clôture), sauf rôle Admin (v2).
- Anonymisation RGPD : remplacement des PII par valeurs neutres, conserver métriques agrégées.

---

## 4. Exigences Non‑Fonctionnelles

- **Performance** : TTFB API < 300 ms (p95) sur endpoints courants, liste à 50 éléments en < 1 s.
- **Disponibilité** : Mono‑instance acceptable v1 ; architecture prête pour scalabilité horizontale.
- **Sécurité** : OWASP Top 10, tokens **JWT** courts, **rate‑limiting** sur endpoints publics, **CORS** restreint.
- **Confidentialité** : chiffrement **au repos** (disque) et **en transit** (TLS 1.2+).
- **Observabilité** : logs structurés (JSON), corrélation `trace_id`, métriques (requests, latence, erreurs), alertes.
- **Qualité** : >80% de couverture tests unitaires sur domaine critique (opportunités, missions).
- **UX** : opérations clés ≤ 3 clics, formulaires enregistrables au clavier, mode sombre (option).

---

## 5. Architecture Technique

### 5.1 Vue d’ensemble
- **Front‑end** : React 18 + TypeScript, Vite, React Router, Zustand/Redux Toolkit, TanStack Query.
- **API** : Python **FastAPI** (ou **Django REST Framework** alternative), Pydantic v2 pour schémas.
- **DB** : PostgreSQL 15 (UUID, JSONB, stratégies d’indexation).
- **Auth** : OAuth2 Password + **JWT** (Access ~15 min, Refresh ~7 jours), **Argon2** pour hash.
- **Stockage fichiers** : objet (ex. Azure Blob) + URL signées ; v1 possible en disque local dev.
- **Infra** : Conteneurs **Docker**, docker‑compose (dev), option **Kubernetes** (prod v2).
- **CI/CD** : GitHub Actions / Azure DevOps pipelines (lint, tests, build, scan, déploiement).
- **Observabilité** : OpenTelemetry, Prometheus/Grafana (ou équivalent cloud), Sentry (front+back).

### 5.2 Modèle de données (schéma logique)
*(notation simplifiée)*

```
Company(id, name, vat, sector, size, website, addresses[], notes, tags[])
Contact(id, first_name, last_name, email*, phone, role, company_id?, consent_rgpd, social, notes, tags[])
Lead(id, source, status, interest, score, description, company_id?, contact_id?, created_at)
Deal(id, title, company_id, contact_id, amount, currency, probability, stage, expected_close, origin, notes, tags[])
Project(id, title, company_id, contact_id, status, start_date, end_date, rate_type, rate_value, budget_days, notes)
Milestone(id, project_id, name, due_date, amount, status)
Activity(id, type, when, duration_min, outcome, notes, related_type, related_id, reminder_at?)
Document(id, type, file_uri, filename, version, related_type, related_id, created_at)
User(id, email*, password_hash, name, preferences_json)
AuditLog(id, entity_type, entity_id, action, actor, at, diff_json)
```

**Indexation** :  
- `Contact.email` unique, index BTREE.  
- `Deal(stage), Deal(expected_close)` indexes composites.  
- Text search GIN sur `notes/tags`.

### 5.3 API (principaux endpoints)
Base : `/api/v1`

- **Auth**
  - `POST /auth/register` (v1 mono‑user, optionnel si provisionné)
  - `POST /auth/login` → tokens
  - `POST /auth/refresh`
- **Contacts / Companies**
  - `GET /contacts?search=&tag=&page=`
  - `POST /contacts` / `PUT /contacts/{id}` / `DELETE /contacts/{id}`
  - `GET /companies` … idem
- **Leads**
  - `POST /leads` / `POST /leads/{id}/convert` → crée `contact` + `deal`
- **Deals (Opportunités)**
  - `GET /deals?stage=&close_before=`
  - `POST /deals` / `PATCH /deals/{id}` / `POST /deals/{id}/move` (kanban)
- **Projects (Missions)**
  - `POST /projects` / `GET /projects?status=`
  - `POST /projects/{id}/milestones`
- **Activities**
  - `POST /activities` / `GET /activities?related_type=&related_id=`
- **Documents**
  - `POST /documents` (multipart) → URI signée / `GET /documents/{id}`
- **Search**
  - `GET /search?q=...` (agrégé)
- **Admin**
  - `GET /metrics` (protégé), `GET /health`

**Erreurs & conventions**
- JSON:API‑like, erreurs normalisées (`code`, `message`, `details`).
- Ids en **UUIDv4**.
- **Limit/Offset** + en‑têtes de pagination.

### 5.4 Sécurité & conformité
- **CSRF** : non pour API JWT (stateless), oui si cookies (même‑site + CSRF token).
- **CORS** : liste blanche (origin front), headers et méthodes minimales.
- **Validation** : Pydantic + schémas stricts, sanitization XSS côté front.
- **Rate‑limit** : 60 req/min par IP sur endpoints sensibles.
- **RBAC** : préparé (v2). v1 = rôle `Owner` unique.
- **RGPD**
  - Endpoints : `DELETE /contacts/{id}` (soft‑delete) + `POST /contacts/{id}/anonymize`.
  - Journaliser la preuve de consentement (`consent_rgpd` + horodatage).

### 5.5 Déploiement & Architecture Cloud (Azure)

L’application est hébergée **entièrement sur Microsoft Azure**.

#### 5.5.1 Architecture Azure recommandée

```
                     [React Frontend]
                           |
                 Azure Static Web Apps
                           |
               -------------------------
               |                       |
           API (FastAPI)         Auth / Identity
        Azure App Service        Azure Entra ID
               |
       Virtual Network (optionnel)
               |
        Azure PostgreSQL Flexible Server
               |
          Azure Blob Storage
               |
          Azure Key Vault
               |
          Azure Monitor / App Insights
```

#### 5.5.2 Composants Azure
- **Azure Static Web Apps** : hosting du build React + CDN + routage SPA.
- **Azure App Service (Linux)** : API FastAPI en container (Docker) + slots de staging + autoscale.
- **Azure Container Registry (ACR)** : registry privé pour images backend.
- **Azure Database for PostgreSQL – Flexible Server** : sauvegardes automatiques, HA, Private Endpoint recommandé.
- **Azure Blob Storage** : stockage documents, accès via **SAS tokens**.
- **Azure Key Vault** : gestion des secrets (chaîne Postgres, JWT, SMTP). Accès par **Managed Identity**.
- **Azure Monitor & Application Insights** : logs, traces, métriques, alertes.
- **Azure Front Door + WAF** (optionnel v2) : CDN global + protection L7.

#### 5.5.3 Réseau & Sécurité
- **TLS** bout‑en‑bout (HTTPS), HSTS activé au niveau front.
- **CORS** limité aux origines SWA.
- **Private Endpoints** pour Postgres/Blob (option v1.1) + restriction IP App Service.
- **Backups** : Postgres (7–35 jours), versionning sur Blob.

#### 5.5.4 CI/CD Azure
**GitHub Actions (recommandé)**
- Job 1 : build & deploy **Static Web Apps** (front).
- Job 2 : build Docker backend → push **ACR** → deploy **App Service**.
- Job 3 : **migrations DB** Alembic après déploiement réussi (slot → swap).

**Azure DevOps (alternative)** : pipelines YAML équivalents.

---

## 6. Front‑end (React)

### 6.1 Structure & libs
- **Stack** : React 18, TypeScript, Vite, ESLint + Prettier.
- **State** : TanStack Query (serveur) + Zustand/Redux (UI locale).
- **UI** : MUI/Chakra (au choix) + système de design (thèmes clair/sombre).
- **Routing** : React Router (routes protégées).
- **Formulaires** : React Hook Form + Zod (validation).
- **Internationalisation** : i18next (fr d’abord, en option en).

### 6.2 Écrans
- **Dashboard** : pipeline (kanban résumé), prochaines tâches, forecast.
- **Leads** : liste + création rapide.
- **Contacts/Entreprises** : listes, fiches détaillées, fusion doublons.
- **Opportunités** : **Kanban** drag‑drop + fiche opportunité.
- **Missions** : liste, fiche mission, jalons.
- **Activités** : timeline agrégée par entité, rappels.
- **Documents** : attacher/visualiser.
- **Recherche globale** : barre omniprésente.
- **Paramètres** : pipeline, tags, préférences utilisateur.

### 6.3 Accessibilité & UX
- Navigation clavier complète, contrastes AA, annonces ARIA pour drag‑drop.

---

## 7. Intégrations (Roadmap)
- **Calendrier** : iCal export (v1.1) ; sync Google/Microsoft (v2).
- **Email** : capture d’emails via redirection ou extension (v2).
- **Stockage** : liens OneDrive/Google Drive (v1 via URL), API (v2).
- **Automations** : webhooks sortants (`/webhooks/events`) pour Zapier/Make (v1.1).
- **Compta** : export CSV **Missions/Jalons** pour facturation (v1.1).

---

## 8. Import/Export & Migration
- **Import CSV** : mapping assisté, validation avant commit, aperçu erreurs.
- **Export CSV** : contacts, opportunités, missions, activités filtrées.
- **Versionning données** : `AuditLog` pour retracer modifications.

---

## 9. Tests & Qualité
- **Unitaires** : Python (pytest), React (Vitest/Jest + RTL).
- **Intégration API** : httpx + base éphémère (Postgres en container).
- **E2E** : Playwright (création lead → deal → mission).
- **Contrats** : Schemas OpenAPI validés (Dredd/Prism optionnel).
- **Lint/CI** : ESLint, mypy, ruff/flake8, SAST (semgrep/bandit), dépendances (pip‑audit).

---

## 10. Déploiement & Opérations
- **Environnements** : dev / staging / prod.
- **CI/CD** :
  - Build images Docker (front/back).
  - Migrations DB (Alembic si SQLAlchemy / Django migrations).
  - Smoke tests post‑déploiement.
- **Config** : 12‑Factor, secrets via variables d’environnement (Key Vault avec MSI).
- **Backups** : snapshot quotidien Postgres + rétention 30 jours, test de restauration mensuel.
- **Monitoring** : métriques (RPS, latence p95/p99, erreurs), logs centralisés, alertes (SLI/SLO).
- **Coûts** : dimensionnement minimal (1 vCPU/1‑2 Go back, base managée micro), stockage objet à froid pour archives.

---

## 11. Sécurité détaillée (extraits)
- **Auth** : `POST /auth/login` renvoie Access (JWT signé, scopes) + Refresh ; rotation et liste de révocation.
- **PII** : chiffrage de champs sensibles si nécessaire (ex. téléphone) via **pgcrypto** (option).
- **Uploads** : antivirus en file d’attente (ClamAV container) [v1.1].
- **Headers** : CSP stricte, HSTS, X‑Frame‑Options deny, Referrer‑Policy strict‑origin.
- **Secrets** : jamais committés ; rotation semestrielle.

---

## 12. Mesures de succès (KPIs)
- Temps moyen de création d’une opportunité < **20 s**.
- Taux d’adoption des rappels d’activités > **70%** des deals actifs.
- Exactitude du forecast (mois courant) ± **15%** vs réalisé.
- MTTR incident prod < **30 min**.

---

## 13. Plan de livraison (proposition)
- **Sprint 0 (1‑2 semaines)** : cadrage, design système, modèle de données, pipelines CI/CD, squelette front/back, auth.
- **Sprint 1** : Contacts/Entreprises/Leads + import CSV.
- **Sprint 2** : Pipeline Opportunités (kanban) + dashboards de base.
- **Sprint 3** : Missions + jalons + documents.
- **Sprint 4** : Activités + rappels + recherche globale.
- **Sprint 5** : RGPD (anonymisation), export CSV, observabilité, durcissement sécurité.
- **Beta** : E2E, perf, polishing UX.  
*(Les sprints sont indicatifs, à ajuster selon charge réelle.)*

---

## 14. Annexes

### 14.1 Modèle OpenAPI (squelette)
```yaml
openapi: 3.0.3
info:
  title: CRM Freelance API
  version: 1.0.0
servers:
  - url: /api/v1
paths:
  /auth/login:
    post:
      requestBody: { required: true }
      responses:
        '200': { description: Tokens }
  /contacts:
    get: { responses: { '200': { description: List contacts } } }
    post: { responses: { '201': { description: Created } } }
  /leads/{id}/convert:
    post:
      responses:
        '201': { description: Converted to contact + deal }
```

### 14.2 Exemple de pipeline par défaut
- Découverte → Qualification → Proposition → Négociation → Gagné/Perdu

### 14.3 Matrice permissions (v1)
- `Owner` : tout accès.

---

## 15. Décisions techniques (ADR résumé)
- **FastAPI + SQLAlchemy + Postgres** pour vitesse de dev, typage, OpenAPI auto.  
- **React + TS + TanStack Query** pour data‑fetching robuste, cache et mutations optimisées.  
- **JWT stateless** pour simplicité (v1 mono‑user), prêt à passer à RBAC.

---

## 16. Risques & Atténuations
- **Monoposte** : si besoin d’un collaborateur court‑terme → activer RBAC lite (Reader/Editor).
- **Perte données** : backups + tests de restauration programmés.
- **Charge variable** : requêtes lourdes paginées, index GIN/BTree, N+1 évité via jointures/`selectinload`.

---

## 17. Checklist d’acceptation (v1)
- [ ] Authentification JWT opérationnelle, rotation refresh.  
- [ ] CRUD complet Contacts/Entreprises/Leads + import CSV (validation).  
- [ ] Pipeline Opportunités **kanban** + calcul pondéré.  
- [ ] Création Mission depuis Opportunité gagnée + jalons.  
- [ ] Activités avec rappels + notifications locales.  
- [ ] Recherche globale + tags.  
- [ ] Export CSV deals/missions.  
- [ ] Logs, métriques, alertes de base, sauvegardes OK.  
- [ ] RGPD : anonymisation, consentement stocké.  
- [ ] Tests unitaires/integ principaux verts ; E2E scénario clé vert.

---

### Notes de mise en œuvre rapide (dev bootstrap)
- **Backend** : `fastapi`, `uvicorn`, `sqlalchemy`, `alembic`, `pydantic`, `python-jose`, `passlib[argon2]`.
- **Frontend** : `vite`, `react`, `typescript`, `@tanstack/react-query`, `react-hook-form`, `zod`, `mui`.
- **Dev** : `docker-compose` (api, db, adminer/pgadmin, front), make targets (`make up/test/lint`).

---

**Fin du document.**
