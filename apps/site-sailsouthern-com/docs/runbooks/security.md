# Security Operations and Runbooks

This runbook outlines the security controls, hardening measures, and administrative authentication requirements implemented for the Sailing Almanac / Sail Southern codebase.

## 1. Network Hardening

### CORS (Cross-Origin Resource Sharing)
The API strictly restricts cross-origin access based on the `CORS_ALLOWED_ORIGINS` environment variable (comma-separated list of origins).
- **Production settings**: Only domains in `CORS_ALLOWED_ORIGINS` are accepted. If a request is received from an origin not in the list, the API responds with a CORS error block.
- **Example configuration**:
  ```env
  CORS_ALLOWED_ORIGINS=https://sailsouthern.com,https://api.sailsouthern.com
  ```

### Helmet Security Headers
Helmet is configured with strict policies:
- **Content Security Policy (CSP)**: Restrictions are placed to prevent XSS. Only self-hosted scripts, styles (with unsafe-inline allowed for style transitions), and image sources from `https:` (required for loading external OpenGraph images) are allowed.
- **Cross-Origin Embedder Policy (COEP)**: Disabled (`false`) to ensure the frontend can embed OpenGraph images fetched from external sites.
- **Referrer Policy**: Set to `strict-origin-when-cross-origin`.

---

## 2. API Authentication

All administrative endpoints under `/api/admin/*` and the manually managed supporter creation endpoint `POST /api/supporters` require authentication.
- **Mechanism**: Reusable middleware checks the `X-Admin-Key` header against `process.env.ADMIN_API_KEY`.
- **Response**: Missing or incorrect keys receive:
  ```json
  {
    "error": "Unauthorized",
    "code": "UNAUTHORIZED",
    "statusCode": 401
  }
  ```

---

## 3. Data Integrity & Secret Leak Prevention

### Input Sanitization
To mitigate XSS risks, all user inputs destined for storage and subsequent rendering (e.g. supporter display name, description, social handles) are sanitized via `isomorphic-dompurify` prior to database persistence.

### Secrets Scanning
`secretlint` is configured at the project root.
- **Command**: `npm run secretlint`
- Files containing credentials, `.env` variants, private keys (`.pem`, `.key`), or service account JSONs must never be checked into Git. These are ignored via `.gitignore`.

---

## 4. Local Development and SSH Tunnels

Database (`5432`) and Redis (`6379`) ports are NOT exposed publicly in production Docker configuration. Access is only possible via local SSH tunnel from the host.

### Setting up a Safe SSH Tunnel to Production (chantecler-01)
To establish database and cache connections for local scripts:
```bash
ssh -L 5432:localhost:5432 -L 6379:localhost:6379 -L 7700:localhost:7700 username@chantecler-01
```
This maps the remote container ports (forwarded via host localhost bindings) to your local loopback address.
