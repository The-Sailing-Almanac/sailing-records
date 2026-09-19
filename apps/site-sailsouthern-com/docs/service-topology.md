# Deployment & Service Topology Note

This document specifies the deployment topology, container/service boundaries, and resource orchestrations for the Sailing Almanac running on the `chantecler-01` droplet (Ubuntu LTS).

---

## 🏗️ Docker Compose Service Topology

To ensure modularity and ease of horizontal scaling, the system is separated into Docker containers managed via a single `docker-compose.yml` or isolated Systemd services.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          chantecler-01 VPS                             │
│                                                                        │
│   ┌───────────────────┐    ┌───────────────────┐    ┌──────────────┐   │
│   │    almanac-web    │    │    almanac-api    │    │almanac-search│   │
│   │  (Next.js App)    │    │ (Node/Express API)│    │ (Meilisearch)│   │
│   └─────────┬─────────┘    └─────────┬─────────┘    └──────┬───────┘   │
│             │                        │                     │           │
│   ┌─────────▼────────────────────────▼─────────┐           │           │
│   │                 almanac-db                 │◄──────────┘           │
│   │                (PostgreSQL)                │                       │
│   └──────────────────────▲─────────────────────┘                       │
│                          │                                             │
│   ┌──────────────────────┴─────────────────────────────────────────┐   │
│   │                     almanac-worker-fleet                       │   │
│   │  - Ingest  - Crawl  - Tagger  - Archive  - Submissions         │   │
│   └────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### Core Services Definition

1. **`almanac-web`**
   * **Role**: The public frontend for Sailing Almanac and the Sail Southern regional child interface.
   * **Framework**: Next.js App Router (SSG pre-rendered files, with client-side hydrates for search and submissions).
   * **Port Binding**: Internal `3000` (exposured via Nginx reverse proxy).

2. **`almanac-api`**
   * **Role**: Admin controls, ingestion queues API endpoints, and public search/filter query endpoints.
   * **Framework**: Node.js / TypeScript.
   * **Port Binding**: Internal `4000`.

3. **`almanac-db`**
   * **Role**: Primary relational database storing graph nodes, ingestion records, rules, and crawler states.
   * **Engine**: PostgreSQL 16+.
   * **Volume**: Persistent volume mounted to `/var/lib/postgresql/data`.

4. **`almanac-search`**
   * **Role**: Fast index search, fuzziness, auto-completions, and relationship indexing.
   * **Engine**: Meilisearch or Typesense.
   * **Volume**: Persistent indexes mounted to `/data/meili_data`.

5. **`almanac-worker-fleet` (Queue Workers)**
   * Distributed worker threads polling database/Redis job queues.
   * Named Worker Roles:
     * `almanac-worker-ingest`: Ingests RSS feeds, webhooks, and manual submissions.
     * `almanac-worker-crawl`: Fetches raw HTML pages (throttled, respects limits).
     * `almanac-worker-tagger`: Performs entity extraction and relational tagging.
     * `almanac-worker-archive`: Handles local snapshots and Internet Archive triggers.
     * `almanac-worker-submissions`: Sanitizes, verifies, and processes reader uploads.

6. **`almanac-scheduler`**
   * **Role**: Cron scheduler trigger for feed polls, source intelligence scoring runs, and backfill jobs.

---

## 💾 Storage & Queue Strategy

### Queue Layer: Redis vs. Postgres Jobs
* **Primary Recommendation**: Redis-backed queues (e.g. BullMQ in Node.js) for high-velocity crawler queues (Discovery, Fetch, Extraction).
* **Backup/Admin Jobs**: PostgreSQL-backed job schedules (e.g. Pg-boss) for high-durability administrative moderation reviews and submission handling.

### Blob/Document Storage (Snapshot Preservation)
* **Local Volume**: A dedicated local directory mounted inside the VPS (e.g., `/var/data/almanac/snapshots/`) containing hashed snapshot files: `[sha256-hash].html` and `[sha256-hash].txt`.
* **S3 Fallback**: In the future, this directory can be mirrored or directly configured to upload to an S3-compatible bucket (e.g., Cloudflare R2, matching your Cloudflare zone) to avoid VPS disk space exhaustion.

---

## 🛡️ Observability & Maintenance

### Logging & Monitoring
* **Metrics**: Standard Docker logs forwarded to a local dashboard, or PM2 logs if running directly in node processes.
* **Observability Queue**: Prometheus metric scrape endpoints on workers to monitor task durations, queue sizes, and crawl failure rates.

### Backup Strategy
* **Daily Cron**: Automatic database backups (`pg_dump`) saved to a compressed archive folder and uploaded to Cloudflare R2 storage.
