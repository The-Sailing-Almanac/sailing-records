# Contributing Guidelines

We welcome contributions to the Sailing Almanac / Sail Southern codebase! To ensure code quality, security, and maintainability, all contributors must adhere to the rules and workflows outlined below.

---

## 🌿 Branch Naming Conventions

Always create a branch from `main` using one of the following prefixes:
* `feat/` — for new features (e.g., `feat/auth-middleware`)
* `fix/` — for bug fixes (e.g., `fix/xss-sanitizer`)
* `refactor/` — for code changes that neither fix a bug nor add a feature (e.g., `refactor/type-definitions`)
* `docs/` — for documentation updates (e.g., `docs/security-runbook`)
* `test/` — for adding or fixing tests (e.g., `test/integration-suites`)
* `infra/` — for DevOps, Docker, or server setups (e.g., `infra/harden-compose`)

---

## 💬 Commit Message Formats (Conventional Commits)

Commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This style is automatically enforced by `commitlint` and `husky` on commit.

Format:
```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Allowed Types:
* `feat`: A new feature
* `fix`: A bug fix
* `docs`: Documentation changes
* `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
* `refactor`: A code change that neither fixes a bug nor adds a feature
* `perf`: A code change that improves performance
* `test`: Adding missing tests or correcting existing tests
* `build`: Changes that affect the build system or external dependencies
* `ci`: Changes to CI configuration files and scripts
* `chore`: Other changes that don't modify src or test files

### Example:
```
feat(api): add DOMPurify input sanitization to submissions endpoint
```

---

## 🔒 Security & Code Hygiene Rules

### 1. Secret Linting & PII Protection
* **NEVER** write or log secrets, API keys, private passwords, email addresses, or database connection strings.
* Run `npm run secretlint` locally to verify your changes do not contain secrets before committing. A pre-commit hook runs this check automatically.

### 2. Input Sanitization
* All user-supplied text inserted into the database must be sanitized first using the central sanitization helper in `apps/api/src/lib/sanitize.ts` to prevent Cross-Site Scripting (XSS).

### 3. Log Sanitization
* Do not use `console.log`, `console.error`, or `console.warn` directly in application code. Use the centralized `logger` utility from `apps/api/src/lib/logger.ts`, which automatically masks IP addresses, user emails, query params, and connection strings.

### 4. Function Decomposition Limit
* To maintain readability and testability, **all functions must be 50 lines or fewer**. If a function exceeds this limit, decompose it into smaller, descriptive sub-functions.

### 5. Monetization Terminology
* Avoid the words "tip", "tipping", or "tip jar" in any context (code, logs, documentation, templates). Use **Value-for-Value (V4V)** or **Direct Support** instead.

---

## ⚙️ Development Workflow

1. **Format & Lint**: Ensure your code is formatted properly and runs without linting errors.
2. **Type Checking**: Run TypeScript compilation to ensure everything compiles cleanly:
   ```bash
   npx tsc --noEmit
   ```
3. **Tests**: Verify that all integration and unit tests pass before opening a Pull Request:
   ```bash
   npm run test
   ```
4. **Pre-commit Hooks**: When committing, `husky` will run type checks, secret lints, and verify your commit message format. If these fail, fix the issues and commit again.
