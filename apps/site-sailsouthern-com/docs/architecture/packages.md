# `@stax/*` Monorepo Packages

This document outlines the architectural purpose, target APIs, and consumers of the internal shared packages under `packages/*`.

---

## 1. `@stax/logger`

### Purpose
Provides a production-grade structured logging utility with built-in privacy controls. It automatically scans logs and metadata to mask:
* IP Addresses (IPv4 and IPv6)
* User email addresses (masking local part to 3 characters + `***`)
* Sensitive credential fields (passwords, auth tokens, API keys, secrets)
* HTTP request query parameters (to prevent token leakage from URLs)

### Target Consumers
* **Sailing Almanac API (`apps/api`)**: Replaces standard `console` output for incoming requests, queries, and errors.
* **Ingest Workers (`workers/ingest`)**: Sanitizes logs generated during background RSS polling, podcast processing, and Gemini calls.
* **Operational Scripts (`scripts/`)**: Tracks execution states of seeds and scrapers.
* **Future Standalone Repositories**: Can be packaged and published to npm to serve other web projects.

---

## 2. `@stax/api-middleware`

### Purpose
Centralizes common Express middleware handlers for request validation, error reporting, and authorization.
* `validate(schema, target)`: Verifies request bodies, queries, or URL parameters against a Zod schema, returning uniform `400 Validation Error` on failure.
* `requireAdminKey(headerName)`: Implements auth checks against the environment `ADMIN_API_KEY`, supporting both direct middleware signature and customized header override factory configuration.
* `errorHandler`: Intercepts unhandled route errors and returns standard JSON error responses while logging the error safely using `@stax/logger`.

### Target Consumers
* **Sailing Almanac API (`apps/api`)**: Protects admin endpoints and validates user subscriptions, reactions, and submissions.
* **Future Node.js REST Services**: Standardizes Express routing configuration.

---

## 3. `@stax/activity-core`

### Purpose
Exposes pure helper functions and TS types required to interact with the federated web via the ActivityPub and WebFinger protocols. 
* Free of network and database I/O to maximize portability.
* `buildActor(entity, domain)`: Generates followable Actor profiles.
* `buildWebFinger(username, domain)`: Formats standard account queries.
* `buildCreateNote(actorId, object, domain)`: Packages posts in standard JSON-LD streams.

### Target Consumers
* **Sailing Almanac API (`apps/api`)**: Exposes public federation endpoints.
* **SWS-Multitool / Sibling Repos**: Distributes articles across federated Mastodon nodes.

---

## 4. `@stax/handicap-core`

### Purpose
A pure mathematical calculator engine defining rating interfaces and scoring formulas for yacht racing systems.
* Defers complex ORC/IRC algorithms to database mappings.
* Implements Portsmouth Yardstick scoring.
* Implements PHRF Time-on-Distance (ToD) and Time-on-Time (ToT) rating equations.

### Target Consumers
* **Sailing Almanac API (`apps/api`)**: Evaluates results and polar performance.
* **Future Open Source Rating Apps**: Computes club regatta positions.
