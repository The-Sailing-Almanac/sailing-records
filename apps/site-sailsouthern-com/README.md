> **Staged Shell** ? Domain: `sailsouthern.com` ? STAX Lifecycle: `Active ? Planning` ? [Governance](.orchestration/agent-instructions.md)
>
> This repository is an intentional staged shell awaiting content and deployment decisions.

# Sailing Almanac / Sail Southern Monorepo

Welcome to the **Sailing Almanac & Sail Southern** platform codebase. This is a unified, high-performance monorepo serving yachting enthusiasts with real-time news aggregation, podcast processing, directory search, and editorial tools.

The platform is designed to be highly secure, type-safe, and scalable, structured as a modern Node.js monorepo.

---

## ð ï¸ Technology Stack & Architecture

This repository uses a workspace-based monorepo structure:

```
âââ apps/
â   âââ web/          # Next.js 16 frontend (Port 3002)
â   âââ api/          # Express API backend (Port 4000, proxied via Nginx)
âââ packages/
â   âââ types/        # @almanac/types - Shared TypeScript interfaces
âââ workers/
â   âââ ingest/       # Ingest worker (BullMQ + Redis) for feed polling & podcasts
âââ infra/
â   âââ docker/       # PostgreSQL, Redis, and Meilisearch docker containers
â   âââ nginx/        # Nginx production configuration and rate-limiting rules
âââ scripts/          # Operational, backup, and indexing scripts
```

### Core Components
* **Frontend**: Next.js 16 with Vanilla CSS, responsive layouts, and SEO-optimized structures.
* **Backend**: Express server with robust middleware architecture (Helmet, CORS, schema validation, rate-limiting).
* **Datastore**: PostgreSQL 16 (relational data), Redis 7 (queues, cache, and rate-limits), and Meilisearch 1.6 (fast, fuzzy site search).
* **Job Processor**: BullMQ for background worker execution and job scheduling.
* **Integrations**: Gemini API (AI-driven content relevance), Resend (Transactional emails).

---

## ð Getting Started

### 1. Prerequisites
Ensure you have the following installed on your machine:
* Node.js v18+
* npm v9+
* Docker & Docker Compose
* Git

### 2. Installation
Clone the repository and install the dependencies from the root directory:
```bash
git clone https://github.com/woodyardae/ss-sailsouthern-com.git
cd ss-sailsouthern-com
npm install
```

### 3. Environment Setup
Copy the example environment file and fill in your local credentials:
```bash
cp .env.example .env
```
Ensure you set:
* `DATABASE_URL` (local or tunneled PostgreSQL)
* `MEILI_MASTER_KEY` (Meilisearch auth)
* `GEMINI_API_KEY` (AI services)
* `RESEND_API_KEY` (Emails)
* `ADMIN_API_KEY` (Protected admin routes)

### 4. Running Infrastructure
Start PostgreSQL, Redis, and Meilisearch via Docker:
```bash
cd infra/docker
docker compose up -d
```

### 5. Running the Apps
Start the development servers for all workspaces:
```bash
npm run dev
```
* Frontend will run at `http://localhost:3000` (or the configured port).
* Backend API will run at `http://localhost:4000`.

---

## ð Security & Data Hygiene

This codebase adheres to a strict security doctrine:
1. **Zero Secret Leakage**: No API keys, passwords, or personal credentials may be committed or logged. Pre-commit hooks run `secretlint` automatically.
2. **Log Masking**: API logging (using `apps/api/src/lib/logger.ts`) automatically masks IP addresses, user emails, query params, and database connection strings.
3. **No Direct Exposure**: PostgreSQL and Redis ports are bound strictly to internal Docker networks in production, accessible only through secure SSH tunnels.
4. **Input Sanitization**: All user-supplied text inserted into the database is sanitized using DOMPurify to prevent XSS payloads.

---

## ð§ª Testing

We use [Vitest](https://vitest.dev/) for unit and integration testing across the workspaces.

Run the test suite:
```bash
# Test the entire workspace
npm run test

# Run tests in the API workspace only
npm run test --workspace=apps/api
```

---

## ð¤ Contributing & Standards

We enforce high standards of code hygiene:
* **Typescript**: All code must compile cleanly under strict mode (`npx tsc --noEmit`).
* **Conventional Commits**: Commit messages must follow the Conventional Commits specification. This is enforced by `commitlint` and `husky` on commit.
* **No "Tipping" nomenclature**: For supporter tier modules, we refer to monetization as **Value-for-Value (V4V)** or **Direct Support**.

See [CONTRIBUTING.md](file:///c:/Users/aewoo/.projects/repos/ss-sailsouthern-com/CONTRIBUTING.md) for more details.
