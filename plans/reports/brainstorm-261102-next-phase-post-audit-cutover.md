# Deep Strategic Brainstorm — Phase P1–P3 Completed & Next Phase (Q1–Q3) Blueprint

- **Date**: 2026-11-02
- **Git HEAD**: `da9473720900646c95c372da5695011e19f17ce6`
- **Source Audit**: `reports/dev/audit/261101-1115-codebase-browser-auth/`
- **Completed Plan**: `plans/261102-1135-post-audit-schema-and-auth-convergence/plan.md`

---

## 1. Completed Phase P1–P3 Summary

| Phase | Deliverable | Status |
|---|---|---|
| **P1 — Full Audit Probe Parity (`BA-01`..`BA-06`, `F01`..`F15`)** | - `packages/domain/inventory/src/routes/order-deduction.ts`: `deductInventoryForOrder` resolves `effectiveTenant` from `orders.tenant_id` when `tenantId` arg is omitted.<br>- `worker/src/__tests__/security/codebase-browser-auth-audit-261101.test.ts` (198 lines): Verifies `BA-01` (`authVersion` revocation), `BA-02` (concurrent OTP across cloned `env`), `BA-03` (customer `DELETE /api/auth/devices` sibling JWT invalidation), `BA-04` (staff `DELETE /api/auth/devices` fail-closed `500`), `BA-05` (`/api/auth/register` canonical D1 `customers` seeding), `F06/F07` (staff `auth_version` bump & mobile device fail-closed), `F09` (Happy Hour tenant isolation), `F12` (TastyIgniter bridge/state guards), `F13` (BOM & non-BOM inventory deduction isolation), and `F14` (HA device tenant isolation). | `PASS` |
| **P2 — 3-Way Canonical Schema Tenant Parity** | Added `tenant_id TEXT NOT NULL DEFAULT 'default'` to `ha_device_states` and `happy_hour_windows` across:<br>1. `worker/schema.sql`<br>2. `db/schema.sql`<br>3. `worker/db/migrations/20261030_02_replica_schema_parity_and_waste_log_cutover.sql` + `.down.sql`<br>Verified 3-way `124`-table & column parity in `loyalty-referrals-inventory-po-cutover.test.ts`. | `PASS` |
| **P3 — Monorepo Quality & Migration Gates** | `npm run typecheck:all` (`0` errors), `npm run lint` (`0` warnings), `npm run lint:migrations` (`85` forward / `16` down PASS), `npx vitest run` (`499/499` suites, `4,800/4,800` tests PASS). | `PASS` |

---

## 2. Deep Brainstorm Contract — Next Phase (Phase Q1–Q3)

| Field | Specification |
|---|---|
| **Outcome** | Execute local re-bundled Browser Auth & Role Matrix E2E verification (`11` Staff roles + `4` Member tiers + `/account` self-service OTP/Email login + `/mobile` PIN device switch reload), Operating-Unit (`unit_id`) Session Contract Clarification, and Working-Tree Pre-Release Hygiene. |
| **Constraints** | 1. Maintain `124`-table 3-way schema parity and `0` typecheck/lint/test failures.<br>2. Local browser verification must use real local Vite + Worker (`workerd`/D1/KV) without token injection or mocked API responses.<br>3. Preserve `UNKNOWN / NOT_RUN` for remote/cloud gates (`DB Admin live`, `real roster`, `deployed origin live`, `production readiness`). |
| **Non-goals** | - No remote Cloudflare deployment or production D1 migration.<br>- No live external API calls (PayOS, SendGrid, Mautic, Zalo, Home Assistant hardware).<br>- No `.pen` design edits. |
| **Acceptance Criteria** | 1. Re-bundled local browser E2E suite confirms `F01` (`/account` self-service login), `F02` (`/mobile` device switch + reload 200), and `F03`/`BA-06` (`supervisor` & `shipper` desktop/mobile navigation) with `0` console/page errors.<br>2. Untracked scaffold artifacts isolated or cleaned per user decision.<br>3. Ready for `/ship` or staging preflight when authorized. |

---

## 3. Next-Phase Options Comparison (Phase Q)

| Option | Description | Trade-offs | Verdict |
|---|---|---|---|
| **Option 1: Local Re-Bundled Browser E2E + Frontend Auth Unit/Integration Suite (Recommended)** | Add deterministic frontend/router tests for `AccountNotLoggedIn` (`F01`), `MobileLogin` + `MobileAuthProvider` device switch refresh (`F02`), and `ProtectedRoute` + `canAccess` for `supervisor`/`shipper` (`F03`), paired with local Vite + Worker bundle verification. | Fast, deterministic, zero external dependencies, directly proves `F01`–`F03` fixes. | **RECOMMENDED (YAGNI / KISS)** |
| **Option 2: Sub-Tenant Operating-Unit (`operating_unit_id`) Session Propagation** | Add `operating_unit_id` column to `users`/`staff_devices` and propagate `operatingUnitId` into `StaffSession` JWT claims for `authorization-policy.ts`. | High surface area across D1 migrations and staff auth handlers; unnecessary while 1 container store = 1 `tenant_id`. | Defer unless multi-unit single-tenant stores are planned. |
| **Option 3: Staging Cutover & Pre-Commit Packaging** | Clean untracked Mekong bootstrap scaffold files, stage verified audit remediation diff, and run `npm run verify:gates`. | Requires user confirmation before removing untracked files or creating a git commit. | Execute after user confirms untracked file handling. |

---

## 4. Completed Phase Q1–Q2 & Next Phase (R1–R2)

| Phase | Deliverable | Status |
|---|---|---|
| **Q1 — Frontend Auth & Role Matrix Regression + Re-Bundle** | - `src/components/auth/__tests__/LoginForm.test.tsx`: Verifies `AccountNotLoggedIn` customer Phone OTP request/verify -> `saveClientSession` and Email login (`F01`).<br>- `src/hooks/__tests__/use-mobile-auth.test.tsx`: Verifies `MobileAuthProvider.login(tok, profile, explicitDevice)` atomic device switch across `mobile_device` and `aura_device_token` (`F02`).<br>- `src/components/auth/__tests__/ProtectedRoute.test.tsx`: Verifies `supervisor` & `shipper` admission across `ADMIN_SHELL_ROLES`, `KDS_SHELL_ROLES`, and `canAccess` mobile tabs (`F03`/`BA-06`).<br>- `npm run build` (`vite build`) & `npm run typecheck:all` & `npm run lint`: `0` errors/warnings. | `PASS` |
| **Q2 — Working-Tree Scaffold Isolation** | Added Mekong bootstrap scaffold files (`HARNESS.md`, `LICENSE`, `pyproject.toml`, `dna/`, `scripts/mcp_server.py`, `scripts/hooks/`, `src/__init__.py`, `src/main.py`, `tests/test_main.py`) to `.gitignore` (`55a1ff6`). | `PASS` |
| **R1 — Full Audit Working-Tree Consolidation** | `273` modified domain/worker/frontend/test files verified clean (`0` typecheck/lint errors, `499/499` test suites PASS) and staged for commit. | `PASS` |
| **R2 — Local End-to-End Flow & Staging Gate (`test:local-flow` / `verify:gates`)** | - `packages/domain/order/commands/create-order-side-effects.ts`: Hardened `runPostOrderSideEffects` with `ON CONFLICT DO NOTHING` and guarded `cashback_wallets` foreign-key provisioning when a guest phone already exists in another tenant (`0` side-effect constraint warnings).<br>- `scripts/local-payment-flow/local-runtime.mjs` + `local-flow-browser.mjs`: Added real Playwright + Vite + Miniflare (`workerd`/D1/KV) browser E2E checks `browser-audit-261101-f01-account-self-service-login`, `browser-audit-261101-f02-mobile-device-switch` (`POST /mobile/refresh` -> `200`), and `browser-audit-261101-f03-supervisor-shipper-nav`.<br>- `node scripts/local-payment-flow/run.mjs --api-only`: `37/37` API & security checks `PASS`.<br>- `npm run test:local-flow`: `60/60` full local Miniflare (`workerd`/D1/KV) + Vite + Playwright Chromium headless checks `PASS`.<br>- `npm run verify:gates`: `GATE_1_MIGRATION_LINT` (`85` up / `16` down) `PASS`, `GATE_2_BUNDLE_BUILD` (`dist/index.html` & JS assets) `PASS`; live/staging credentials remain `UNKNOWN / NOT_RUN`. | `PASS` |
| **S1 — Git Branch & Commit Packaging** | Committed & pushed all audit-remediation code/test/verification files (`55a1ff6`, `f0311f3`, `79c598d`, `b1b0ebf`, `86f2a18` -> `origin/main`); kept `assets/menu/` and `designs/poster-tuyen-dung-aura-logo-added.png` untracked per user confirmation. | `PASS` |
| **S2 — Staging Deployment Preflight & Dry-Run Verification** | - Pushed `main` to `origin/main` (`86f2a18`) per user confirmation.<br>- Verified fresh production bundle (`npm run build` -> `GATE_2_BUNDLE_BUILD: PASS`) and migration linter (`GATE_1_MIGRATION_LINT: PASS`, `85` up / `16` down).<br>- Verified fail-closed forward migration dry-run (`bash worker/scripts/apply-migrations.sh --dry-run --file 20261030_02_replica_schema_parity_and_waste_log_cutover.sql`).<br>- Verified 3-layer rollback dry-run (`bash scripts/deploy-rollback.sh --dry-run --target worker|d1|pages`).<br>- Remote staging execution remains `UNKNOWN / NOT_RUN` pending `6` `*_STAGING` credentials. | `LOCAL_PREFLIGHT_PASS` / `REMOTE_UNKNOWN_NOT_RUN` |

---

## 5. Phase S2 Deep Brainstorm — Staging Cutover & Rollback Architecture

| Stage | Command / Action | Gate / Verification Status |
|---|---|---|
| **Stage 1: Local Static & Bundle Preflight** | `npm run build && npm run verify:gates` | - `GATE_1_MIGRATION_LINT`: `PASS` (`85` forward / `16` down valid across 4 directories)<br>- `GATE_2_BUNDLE_BUILD`: `PASS` (`dist/index.html` + `dist/assets/*.js` fresh)<br>- `GATE_3_ROLLBACK_READINESS`: Static 3-layer commands (`pages`, `worker`, `d1`) `DETECTED`; historical `.down.sql` DDL hazard report preserved (`worker/src/__tests__/routes/web-payment-and-staging-gates.test.ts:713`)<br>- `GATE_4_STAGING_CREDENTIALS`: `PENDING` (`0/6` `*_STAGING` env vars set locally) |
| **Stage 2: Pre-Cutover D1 Time-Travel Bookmark & Migration Dry-Run** | 1. Dry-run (verified locally): `bash worker/scripts/apply-migrations.sh --dry-run --file 20261030_02_replica_schema_parity_and_waste_log_cutover.sql`<br>2. Live bookmark capture (when authorized): `npx wrangler d1 time-travel info fnb-caffe-db --config worker/wrangler.toml` | - Local dry-run: `PASS`<br>- Remote D1 bookmark & live schema inspection: `UNKNOWN / NOT_RUN` |
| **Stage 3: Explicit Forward Migration & Worker/Pages Cutover** | `bash deploy-cloudflare.sh --migration-file=20261030_02_replica_schema_parity_and_waste_log_cutover.sql` | - Enforces fail-closed single-file migration selection (never replays historical table-rebuild migrations)<br>- Injects `GIT_COMMIT_SHA` (`f0311f3`) and writes `dist/version.json`<br>- Remote execution: `UNKNOWN / NOT_RUN` |
| **Stage 4: 3-Layer Rollback Dry-Run & Recovery Matrix** | - Worker: `bash scripts/deploy-rollback.sh --dry-run --target worker <version-uuid>`<br>- D1: `bash scripts/deploy-rollback.sh --dry-run --target d1 <bookmark-or-rfc3339> fnb-caffe-db`<br>- Pages: `bash scripts/deploy-rollback.sh --dry-run --target pages <deployment-uuid>` | - Local dry-run & `tests/deploy-rollback.test.ts` (`12/12` tests): `PASS`<br>- Live rollback drill: `UNKNOWN / NOT_RUN` |

---

## 6. Unresolved Questions

- None for local development, browser E2E verification, or dry-run preflight; remote/cloud deployment gates (`DB Admin live`, `real roster`, `deployed origin live`, `production readiness`) remain `UNKNOWN / NOT_RUN` until the `6` `*_STAGING` credentials (`CLOUDFLARE_API_TOKEN_STAGING`, `AURA_DB_STAGING`, `PAYOS_CLIENT_ID_STAGING`, `PAYOS_API_KEY_STAGING`, `PAYOS_CHECKSUM_KEY_STAGING`, `JWT_SECRET_STAGING`) and deployment authorization are provided.
