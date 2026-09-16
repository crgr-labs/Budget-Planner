---
name: security-dependency-audit
description: >-
  Comprehensive security, dependency vulnerability, and sensitive data audit workflow.
  Audits npm dependencies, .gitignore exclusions, environment secrets (.env*), AI assistant
  transcripts (.claude/, .gemini/, conversation logs), local filesystem path leaks (C:\Users\...),
  IDE execution configs (.vscode/), and backend API security.
---

# Security & Dependency Audit Skill

This skill provides a standardized, rigorous audit procedure to evaluate codebase security, eliminate dependency vulnerabilities, prevent accidental leakage of sensitive files or local paths to Git, and verify secure local backend execution.

---

## Audit Checklist & Verification Procedure

When this skill is activated, execute the following 7-step audit sequence:

### 1. Dependency Vulnerability Scan (`npm audit`)
* Run `npm audit` to identify known CVEs across direct and transitive dependencies.
* Run `npm outdated` to check for severely outdated or deprecated packages.
* Verify zero high-risk third-party spreadsheet parser dependencies (e.g. vulnerable `xlsx` / SheetJS) — prefer browser-native UTF-8 BOM CSV or JSON handling.

### 2. Environment Secrets & Credentials
* Inspect all environment configurations:
  - Verify `.env`, `.env.*`, `.env.local`, and `environment.development.ts` are untracked and in `.gitignore`.
  - Ensure production builds (`environment.ts`) do not hardcode API tokens or webhook URLs.
  - Verify tokens/secrets are injected via encrypted CI/CD secrets (e.g., GitHub Secrets `GOOGLE_SHEETS_URL`) rather than hardcoded code.
* Scan codebase for exposed API keys, bearer tokens, or query parameter tokens (e.g., `token=...`, `AKfycb...`).

### 3. Local Filesystem Path & Username Leaks
* Scan tracked files for hardcoded Windows/Linux user paths (e.g. `C:\Users\<username>\`, `/home/<username>/`, `OneDrive`).
* Verify that AI conversation logs, transcripts, or notes containing absolute system paths are not tracked by Git.

### 4. AI Tool Directories & Transcript Exclusions
* Verify the following AI directories and chat logs are excluded in `.gitignore` and untracked:
  - `.claude/` (Claude Desktop / Claude Code run configs and prompts)
  - `.gemini/`, `.antigravity/` (Gemini CLI / Antigravity transcripts and scratch files)
  - `*conversation_history*` (chat exports and trajectory dumps)
  - `brain/`, `scratch/`, `*.system_generated/`

### 5. IDE Preferences & Local Execution State
* Ensure user-specific IDE files are excluded in `.gitignore`:
  - `.vscode/*` (allow only shared `.vscode/extensions.json`)
  - `.history/`, `.idea/`, `*.sublime-workspace`
* Confirm `.vscode/launch.json` and `.vscode/tasks.json` do not expose local path configurations to public repos.

### 6. Local Backend & API Security (`server.js`)
* **Zero Untrusted Dependencies:** Use built-in Node.js core modules (`node:http`, `node:fs`, `node:path`) where possible.
* **DoS Protection:** Enforce strict payload limits (e.g., `MAX_BODY_BYTES = 10 * 1024 * 1024`).
* **CORS Restrictions:** Bind CORS explicitly to local development origin (`http://localhost:4200`) rather than wildcard `*`.
* **Data Integrity:** Use write serialization promise queues (`enqueueWrite`) to avoid race conditions during concurrent write requests.

### 7. CI/CD & Supply Chain Review (`deploy.yml`)
* Ensure GitHub Actions use official, verified action versions (`actions/checkout`, `actions/setup-node`, `actions/deploy-pages`).
* Verify least-privilege workflow permissions (`contents: read`, `pages: write`, `id-token: write`).
* Ensure deterministic dependency installs with `npm ci`.

---

## Standard Hardened `.gitignore` Template

```gitignore
# 1. Environment & Secrets
.env
.env.*
.env.local
.env.development.local
.env.test.local
.env.production.local
src/environments/environment.development.ts
src/environments/environment.*.local.ts
*.pem
*.key
*.cert
*.pfx
*.p12
credentials.json
client_secret*.json

# 2. Local Data & Personal Workbooks
data/
data/*
*.xlsx
*.xls
*.csv
*.tsv
*.sqlite
*.sqlite3
*.db
*.bak
*.backup

# 3. AI Assistant & Transcript Data
.claude/
.gemini/
.antigravity/
*conversation_history*
conversation_history.*
recent_conversation_history.*
*.system_generated/
scratch/
brain/

# 4. Logs & NPM Cache
.npm/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# 5. IDEs & Local Execution Preferences
.vscode/*
!.vscode/extensions.json
.history/
.idea/
.project
.classpath
.c9/
*.launch
.settings/
*.sublime-workspace

# 6. Build Output & Dependencies
/dist
/tmp
/out-tsc
/bazel-out
/node_modules
/.angular/cache
.sass-cache/
/coverage

# 7. OS Metadata
.DS_Store
Thumbs.db
```
