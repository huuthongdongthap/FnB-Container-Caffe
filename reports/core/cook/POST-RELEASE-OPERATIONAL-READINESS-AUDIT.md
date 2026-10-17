# AURA Post-Release Operational Readiness Audit Report

**Date:** 2026-10-13  
**Target Environment:** `production`  
**Execution Mode:** Read-Only Audit & Verification  
**Branch / Commit:** `main` (`16b91738906586db6a9310d7f8f86bd5490365c3`)  
**Active Production Worker Version:** `3fb52a02-b6a2-4d41-bfd8-0d14d8c009db` (100% Traffic)  
**Execution Skill:** `/core:cook`

---

## 1. Executive Summary & Verification Matrix

This audit evaluates the post-release operational readiness of AURA OS across four high-priority operational dimensions following the successful 100% traffic promotion of release `16b91738` (PR #72, Run #274).

| Item # | Priority Dimension | Verified Status | Evidence Reference | Verdict |
|:---:|:---|:---:|:---|:---:|
| **1** | **PayOS Webhook Idempotency & Consistency** | **VERIFIED** | `worker/src/routes/webhooks-handlers/payos.ts:9-166`<br>`payment-webhook-lifecycle.test.ts` (5/5 PASS) | 🟢 **PASS** |
| **2** | **SePay Webhook Integration** | **GAP (Docs-Only)** | `docs/product/FEATURE_MATRIX.md:20`<br>`docs/product/AURA_GAP_ANALYSIS.md:23` | 🟡 **GAP** |
| **3** | **Schema Migration CI Linter (P3-1)** | **GAP (Backlog)** | `.github/workflows/ci.yml:1-42`<br>`deployment-contract.test.ts:73-99` | 🟡 **GAP** |
| **4** | **Observability Core Middleware & Tracing** | **VERIFIED** | `worker/src/middleware/correlation-id.ts`<br>`worker/src/middleware/request-metrics.ts`<br>`observability-reliability-contract.test.ts` (5/5 PASS) | 🟢 **PASS** |
| **5** | **Alert Dispatch Scheduling & Ingestion** | **GAP / PARTIAL** | `worker/src/scheduled.ts:1-44`<br>`worker/src/routes/cron-admin.ts:50-76` | 🟡 **GAP** |
| **6** | **Admin Continuity Telemetry Widget (P3-2)** | **GAP (Backlog)** | `packages/domain/continuity/index.ts`<br>`use-admin-dashboard-store.ts:1-32` | 🟡 **GAP** |

---

## 2. Deep-Dive Audit Findings by Priority

### Priority 1: PayOS / SePay Webhook Idempotency & Payment Consistency

#### 1.1 PayOS Webhook Processing (VERIFIED)
- **Signature Cryptographic Verification:**
  - Implemented in `worker/src/routes/webhooks-handlers/payos.ts:33-39` and `worker/src/routes/webhooks-handlers/helpers.ts:5-25`.
  - Computes HMAC-SHA256 signature using `PAYOS_CHECKSUM_KEY`.
  - Rejects missing or invalid signatures with `401 Unauthorized` and records metric `webhook_rejected` (`reason: invalid_signature`).
- **Database Idempotency & Unique Constraints:**
  - Database constraint: `CREATE UNIQUE INDEX idx_payments_txn_unique ON payments(transaction_id) WHERE transaction_id != ''` (`worker/db/migrations/20260825_01_payments_txn_unique.sql:5-6`, verified active in production D1 database backup `fnb-caffe-db-20260825-204654.sql:830`).
  - Replay handling: If `existingPayment.status === 'completed'`, the handler returns `HTTP 200 OK` `{ error: 0, message: 'Already processed' }` immediately (`payos.ts:64-74`) and self-heals order state to `paid` if desynchronized (`payos.ts:68-71`).
  - Race condition isolation: Uses conditional database update `UPDATE payments SET status = ? WHERE transaction_id = ? AND status != 'completed'` (`payos.ts:97-100`). If changes equals 0, acknowledges `HTTP 200 OK` (`Already processed (race lost)`).
- **Amount Mismatch & Failure Isolation:**
  - Amount mismatch validation (`payos.ts:76-89`): Rejects with `HTTP 400 Bad Request` and quarantines event into Cloudflare KV `payment:stuck:${orderId}` with 7-day TTL.
  - Failure/expiration isolation: Webhooks reporting `FAILED` or `EXPIRED` transition `payments.status` to `failed` or `expired` without mutating `orders.payment_status` (`payos.ts:95-99`, verified in `payment-webhook-lifecycle.test.ts:59-122`).
  - Dead Letter Queue (DLQ): Unhandled exceptions write payload to Cloudflare KV `webhook:dlq:${Date.now()}` with 7-day TTL (`payos.ts:154-162`).
- **Empirical Test Evidence:**
  - `worker/src/__tests__/integrations/payment-webhook-lifecycle.test.ts`: 5/5 passed (1.41s).
  - `worker/src/__tests__/integrations/payment-intent-lifecycle.test.ts`: 6/6 passed (2.38s).
  - `worker/src/__tests__/routes/payos-webhook-e2e.test.ts`: 7/7 passed.

#### 1.2 SePay Integration Status (GAP / DOCS-ONLY)
- **Status:** **GAP (Not Implemented / Docs-Only)**
- **Evidence:**
  - No handler exists in `worker/src/routes/webhooks-handlers/` for SePay (only `payos.ts` exists).
  - Enum reference exists in `packages/domain/shift/src/model/shift-pos-types.ts:43` (`'cash' | 'card' | 'payos' | 'sepay' | 'transfer'`).
  - Repository documentation explicitly notes:
    - `docs/product/FEATURE_MATRIX.md:20`: `| Payment — SePay | ⚠ docs/config only | ❓ | — | — | docs | — | verify before claiming |`
    - `docs/product/AURA_GAP_ANALYSIS.md:23`: `| 4 | Payment | ✅ | none — Stripe/NOWPayments/COD PROD; SePay docs-only (verify or drop) | — |`
    - `docs/01_GOAL.md:78`: `Payment integration (VNPay, MoMo, SePay via PayOS webhook)`
- **Architectural Conclusion:**
  The system currently routes VietQR and bank transfer payments via the PayOS aggregator. SePay is not an active standalone webhook endpoint. If direct SePay webhooks are required, a dedicated endpoint (`/api/webhooks/sepay`) with API token signature validation must be created.

---

### Priority 2: Schema Migration CI Linter (P3-1)

#### 2.1 Current State Analysis (GAP)
- **Status:** **GAP (P3-1 in PRODUCTION-READINESS-GO-LIVE-AUDIT.md)**
- **Evidence:**
  - `.github/workflows/ci.yml:1-42` executes:
    - `npm run lint` (ESLint on frontend/worker)
    - `npm run typecheck` & `npm run typecheck:worker`
    - `npm run test:ci` (Vitest test suite)
    - Codecov coverage reporting
  - No workflow step executes static SQL linting, schema drift detection, or migration naming/pairing checks.
  - Contract validation logic already exists in `@aura/domain-deployment`:
    - `packages/domain/deployment/src/policies/deployment-policy.ts:96-130` implements `validateMigrationSequence(migrationFilenames)`.
    - Tested in `worker/src/__tests__/integrations/deployment-contract.test.ts:73-99` (verifying chronological ordering and `.down.sql` pairing).
- **Risk Assessment:**
  A migration with syntax errors, unsafe column drops, missing indexes on foreign keys, or broken `.down.sql` reversal could pass PR review and fail only upon execution against Cloudflare D1 in production.

---

### Priority 3: Production Observability & Alert Coverage

#### 3.1 Core Telemetry Middleware (VERIFIED)
- **Correlation ID Tracking:**
  - `worker/src/middleware/correlation-id.ts:1-40` extracts or generates UUID correlation IDs per request, stores in Hono context (`c.set('correlationId', id)`), and appends `X-Correlation-Id` to all responses. Verified in `observability-middleware-contract.test.ts:25-45`.
- **Request Metrics Pipeline:**
  - `worker/src/middleware/request-metrics.ts:1-37` captures `method`, `path`, `status`, and `duration` for all incoming edge requests.
  - Writes to D1 `_metrics` table using non-blocking edge task `c.executionCtx.waitUntil(mc.recordMetric(...))` to preserve zero edge latency overhead.
- **Error Boundary & Classification:**
  - `worker/src/middleware/error-handler.ts:29-93` classifies errors via `@aura/domain-observability` into `business` (4xx validation), `application` (domain faults), and `infrastructure` (5xx platform errors).
  - Redacts sensitive headers and payloads, returning a consistent JSON schema with `correlationId` and tracing codes.
- **Empirical Test Evidence:**
  - `worker/src/__tests__/integrations/observability-reliability-contract.test.ts`: 5/5 passed.
  - `worker/src/__tests__/integrations/observability-middleware-contract.test.ts`: 7/7 passed.
  - `worker/src/__tests__/lib/alert-dispatcher.test.ts`: 7/7 passed.

#### 3.2 Alert Coverage & Dispatch Gaps (GAP / UNKNOWN)
- **Gap 3a: Alert Dispatch Cron Decoupling:**
  - Cloudflare Worker cron trigger is configured for every 5 minutes in `worker/wrangler.toml:37` (`crons = ["*/5 * * * *"]`).
  - `worker/src/scheduled.ts:23-44` executes `checkOverdueOrders`, `pruneOldMetrics`, and customer sync tasks.
  - However, `dispatchAlerts(env)` is NOT invoked inside `handleScheduled`!
  - It is currently wired exclusively to endpoint `GET /cron/alerts` (`worker/src/routes/cron-admin.ts:52-60`), protected by `CRON_SECRET`.
  - **Impact:** Alerts inserted into `_alerts` table (e.g. `kds_sla_breach`, `order_stuck`) are only dispatched to Telegram if an external cron runner hits `/cron/alerts`.
- **Gap 3b: External Log Drain / APM Sink:**
  - No Cloudflare Tail Worker or external logging drain (Axiom, Datadog, Sentry) is bound in `worker/wrangler.toml`.
  - Worker logs are ephemeral and accessible only via live `wrangler tail` or Cloudflare dashboard streaming.
- **Gap 3c: Automated 5xx / Latency Spikes Threshold Calculation:**
  - `ALERT_THRESHOLDS` (`worker/src/lib/alerts/types.ts:18-49`) defines keys for `worker_5xx_rate` and `d1_latency_high`, but automatic background calculations querying `_metrics` are not scheduled to evaluate these thresholds periodically.

---

### Priority 4: Admin Continuity Telemetry Widget (P3-2)

#### 4.1 Current State Analysis (GAP)
- **Status:** **GAP (P3-2 in PRODUCTION-READINESS-GO-LIVE-AUDIT.md)**
- **Evidence:**
  - Domain Policy: `@aura/domain-continuity` (`packages/domain/continuity/src/policies/continuity-policy.ts:13-65`) establishes RPO (15 min), RTO (10 min), storage tiers (`fnb_caffe_db`, `auth_kv`, `order_broadcaster`), and restoration plan generation. Verified in `backup-recovery-contract.test.ts:1-125` (5/5 PASS).
  - API Boundary: Zero routes for `/api/dashboard/continuity` or `/api/continuity` exist in `worker/src/routes/`.
  - Frontend State: `src/hooks/stores/admin/use-admin-dashboard-store.ts:1-32` calls only `/api/stats` for high-level sales data.
  - No UI component exists in `src/pages/admin/` or `src/components/admin/` to present live D1 backup checksum status, RPO lag, or replication health.

---

## 3. Prioritized Operational Backlog & Acceptance Criteria

Based on audit findings, the following prioritized backlog items are defined for post-release operational hardening:

```
PRIORITY MATRIX:
P1: Critical Operational Gaps (Alert Delivery & Reliability)
P2: External Gateways & Schema Safety (CI Automation)
P3: Administrative Telemetry & Observability Enhancements
```

### Backlog Item 1: Auto-Dispatch Alerts in Worker Scheduled Handler (P1)
- **Scope:** Worker Cron Automation (`worker/src/scheduled.ts`)
- **Problem:** Alerts recorded in `_alerts` require manual or external HTTP hits to `/cron/alerts` to deliver via Telegram.
- **Acceptance Criteria (AC):**
  1. Update `worker/src/scheduled.ts` to call `dispatchAlerts(env)` inside `handleScheduled(controller, env, ctx)` via `ctx.waitUntil()`.
  2. Guard execution with check for `env.TELEGRAM_BOT_TOKEN` and `env.TELEGRAM_CHAT_ID`.
  3. Enforce alert cooldown to prevent notification flooding on persistent breaches.
  4. Verify in unit/integration test that alerts queued in `_alerts` are dispatched during scheduled execution.

### Backlog Item 2: Pre-PR Schema Migration Linter in CI (P2 — Item P3-1)
- **Scope:** GitHub Actions CI Pipeline (`.github/workflows/ci.yml`, `scripts/validate-migrations.ts`)
- **Problem:** Schema migrations are verified during Vitest test runs but lack a standalone pre-PR static analysis and DDL verification gate.
- **Acceptance Criteria (AC):**
  1. Add standalone script `scripts/validate-migrations.ts` integrating `@aura/domain-deployment`'s `validateMigrationSequence`.
  2. Add `schema-lint` step to `.github/workflows/ci.yml` running on all PRs targeting `main`.
  3. Validate:
     - Naming pattern `YYYYMMDD_NN_slug.sql` and chronological order against `origin/main`.
     - Presence of `.down.sql` companion for reversible migrations.
     - DDL syntax validity by executing forward and rollback migrations against an ephemeral SQLite `:memory:` database with `PRAGMA foreign_key_check`.
  4. Block PR merge if schema validation fails.

### Backlog Item 3: Clarify or Implement SePay Webhook Endpoint (P2)
- **Scope:** Gateway Contract Reconciliation (`worker/src/routes/webhooks-handlers/`, documentation)
- **Problem:** References to SePay exist in documentation and enum types, but no standalone webhook handler exists in the Worker.
- **Acceptance Criteria (AC):**
  - *Option A (Aggregator Model — Recommended):* Update documentation in `docs/product/FEATURE_MATRIX.md` and contract specifications to explicitly designate PayOS as the canonical VietQR / bank transfer gateway, removing standalone SePay references from pending release deliverables.
  - *Option B (Dedicated Endpoint):* Implement `worker/src/routes/webhooks-handlers/sepay.ts` with API key/secret validation, replay idempotency on `payments.transaction_id`, amount checking, and unit test coverage in `worker/src/__tests__/integrations/sepay-webhook-lifecycle.test.ts`.

### Backlog Item 4: Admin Continuity Telemetry Endpoint & Widget (P3 — Item P3-2)
- **Scope:** Worker API & Admin Dashboard (`worker/src/routes/`, `src/components/admin/`)
- **Problem:** Operational staff have no real-time visibility into Cloudflare D1 backup timestamps, checksum status, or RPO compliance from the Admin UI.
- **Acceptance Criteria (AC):**
  1. Implement `GET /api/dashboard/continuity` in Cloudflare Worker (protected by admin authentication).
     - Response schema:
       ```json
       {
         "status": "healthy" | "degraded" | "critical",
         "rpo_minutes": 15,
         "current_lag_minutes": number,
         "last_backup_timestamp": string,
         "last_backup_checksum": string,
         "resources": {
           "d1": { "status": "active", "rpo_minutes": 15 },
           "kv": { "status": "active", "rpo_minutes": 0 },
           "do": { "status": "active", "rpo_minutes": 0 }
         }
       }
       ```
  2. Add `useContinuityTelemetry` in `src/hooks/stores/admin/`.
  3. Implement `<ContinuityHealthWidget />` in Admin Operations view displaying status badge (🟢 RPO < 15m, 🟡 RPO 15-60m, 🔴 RPO > 60m).

### Backlog Item 5: Production Log Drain / Tail Worker Binding (P3)
- **Scope:** Observability Infrastructure (`worker/wrangler.toml`)
- **Problem:** Worker edge logs cannot be queried historically outside the Cloudflare Dashboard live tail window.
- **Acceptance Criteria (AC):**
  1. Configure Cloudflare Tail Worker or external log drain (Axiom / Datadog / Vector) to ingest structured JSON logs from `worker/src/middleware/logger.ts`.
  2. Implement alert rules for sustained 5xx rates exceeding 1% over 5-minute rolling windows.
