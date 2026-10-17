# Phase 04: Staging Smoke Verification & Go-Live Gates

## Context Links
- Master Plan: [plan.md](plan.md)
- Operational Readiness Report: [plans/reports/audit-261014-repo-operational-readiness-verification.md](../reports/audit-261014-repo-operational-readiness-verification.md)
- Deploy Workflow: [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml)

---

## Overview
- **Priority:** P1 High
- **Current Status:** Local Gate Automation Complete | Live Staging Blocked on Credentials
- **Description:** Define and automate the strict staging smoke test checklist, required non-production test data, staging credentials inventory (`validateStagingCredentials`), and go-live release criteria (`npm run verify:gates`).

---

## Key Insights
1. **Zero Production Risk**: Local tests (3,923/3,923 pass) prove unit and contract logic against in-memory SQLite mocks. They do NOT guarantee that live Cloudflare D1 or PayOS production environments are ready.
2. **Decoupled Architecture Verification**: Staging must verify that Cloudflare Pages (`staging.auraspace.cafe`) properly communicates with the Cloudflare Worker API gateway (`staging-api.auraspace.cafe`) without relative path failures.
3. **Sandbox Financial Flows**: PayOS bank QR payment generation, HMAC webhook verification, and payment idempotency must be confirmed against live PayOS sandbox servers before production launch.

---

## Staging Smoke Test Protocol

### Stage 1: Health & Observability (Worker Edge)
- **Step 1.1: Fast Liveness Probe**
  - Command: `curl -i https://staging-api.auraspace.cafe/api/health`
  - Expected: HTTP 200 OK, `{ "status": "ok", "liveness": true, "readiness": true }`, latency < 50ms.
- **Step 1.2: Deep Dependency Readiness Probe**
  - Command: `curl -i https://staging-api.auraspace.cafe/api/health?ready=1`
  - Expected: HTTP 200 OK, `{ "status": "ok", "readiness": true, "d1": "connected" }`.
- **Step 1.3: Failure Sanitization Probe**
  - Expected: When D1 is stopped/unreachable, endpoint returns HTTP 503 with generic message `'Database connectivity probe failed'` (zero SQL/table leakage).

### Stage 2: Pages ↔ Worker Routing
- **Step 2.1: SPA Document Loading**
  - Command: `curl -i https://staging.auraspace.cafe/`
  - Expected: HTTP 200 OK with `Content-Type: text/html; charset=utf-8`.
- **Step 2.2: Telemetry & Mutation Routing**
  - Expected: Browser console shows all `apiFetch` and `navigator.sendBeacon` requests targeting `staging-api.auraspace.cafe`. Zero POST requests sent to `staging.auraspace.cafe/api/*` (preventing HTTP 405).

### Stage 3: Catalog, Cart & Checkout Invariants
- **Step 3.1: Valid Hyphenated Product Ordering**
  - Payload: `{ id: "staging-coffee-01", name: "Cà phê Staging", price: 30000, quantity: 1 }`.
  - Expected: Server snapshot accurately calculates 30,000 VND based on database catalog row.
- **Step 3.2: Nonexistent Hyphenated ID Rejection**
  - Payload: `{ id: "staging-coffee-01-tampered", name: "Fake", price: 1000, quantity: 1 }`.
  - Expected: Rejected with HTTP 400 Bad Request, code `item_not_found`. Never resolves to `staging-coffee-01`.

### Stage 4: PayOS Sandbox Payment & Idempotency
- **Step 4.1: Order Creation & VietQR Generation**
  - Order: Dine-in Table 1, 30,000 VND, method `payos`.
  - Expected: PayOS checkout URL and VietQR generated from sandbox gateway.
- **Step 4.2: Webhook Execution (First Delivery)**
  - Payload: `{ code: "00", orderCode: 999001, amount: 30000 }` with valid sandbox HMAC signature.
  - Expected: HTTP 200 OK `{ error: 0, message: "Success" }`. Status transitions to `completed`.
- **Step 4.3: Webhook Replay (Second Delivery)**
  - Payload: Identical payload replayed.
  - Expected: HTTP 200 OK `{ error: 0, message: "Already processed" }`. Zero duplicate state changes or redundant customer notifications.
- **Step 4.4: Amount Mismatch Guard**
  - Payload: Amount 10,000 VND (mismatched with DB 30,000 VND).
  - Expected: HTTP 400 Bad Request `{ error: 1, message: "Amount mismatch" }`. Stored in KV `payment:stuck:*`.

---

## Missing Staging Credentials Inventory

| Credential Name | Scope & Purpose | Status |
|:---|:---|:---:|
| `CLOUDFLARE_API_TOKEN_STAGING` | Deployment to staging Pages and Worker | Required |
| `AURA_DB_STAGING` | Isolated D1 SQLite database for staging | Required |
| `PAYOS_CLIENT_ID_STAGING` | PayOS sandbox client identifier | Required |
| `PAYOS_API_KEY_STAGING` | PayOS sandbox API key | Required |
| `PAYOS_CHECKSUM_KEY_STAGING` | PayOS sandbox HMAC webhook secret | Required |
| `JWT_SECRET_STAGING` | Dedicated JWT signing secret for staging | Required |

---

## Go-Live Release Gates

- [x] **Gate 1 (CI & Migration Lint Gate — `GATE_1_MIGRATION_LINT`):** `npm run lint:migrations`, `npm run typecheck:all`, `npm run lint`, and Vitest suite pass (`63` forward, `7` down migrations valid across 4 directories; canonical `worker/db/migrations` has `36` forward, `7` down).
- [x] **Gate 2 (Bundle Build Gate — `GATE_2_BUNDLE_BUILD`):** `npm run build` generates fresh production assets (`dist/index.html`, `dist/assets/*.js`) verified against all `BUILD_INPUT_PATHS` (`src`, `public`, `packages`, `assets`, `index.html`, `_redirects`, `_headers`, `package.json`, `package-lock.json`, `vite.config.js`, `tsconfig.json`).
- [ ] **Gate 3 (Rollback Readiness Gate — `GATE_3_ROLLBACK_READINESS`):** **FAIL (Blocked Pending Owner Decision)** — Static inspection of `scripts/deploy-rollback.sh` reports `pages=static_command_detected, worker=unreferenced, d1=unreferenced` (`runtimeVerified=false`), and canonical `worker/db/migrations` has `7/36` `.down.sql` files (`29` missing) with `0/36` safely reversible without data-loss/schema-drift hazards (`7` existing `.down.sql` flagged). Normal deploys (`deploy-cloudflare.sh`, `worker/scripts/apply-migrations.sh`, `scripts/deploy-branded.sh`) are now fail-closed against historical migration replay.
- [ ] **Gate 4 (Staging Credentials & Execution Gate — `GATE_4_STAGING_CREDENTIALS`):** **BLOCKED (`6/6` missing in local env)** — Requires `CLOUDFLARE_API_TOKEN_STAGING`, `AURA_DB_STAGING`, `PAYOS_CLIENT_ID_STAGING`, `PAYOS_API_KEY_STAGING`, `PAYOS_CHECKSUM_KEY_STAGING`, and `JWT_SECRET_STAGING` to execute the 4-stage live staging smoke checklist.
- [ ] **Gate 5 (Secret Zero-Leak Runtime Gate):** Local contract verified via `logger-redaction.test.ts` and `health.test.ts`; live staging log inspection pending Stage 1–4 execution.
