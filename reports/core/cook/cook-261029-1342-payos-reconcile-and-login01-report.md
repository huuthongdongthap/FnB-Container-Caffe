# /core:cook — Execution Report (2026-10-29)

## Recipe Summary
Executed the post-cutover Go-Live remediation & PayOS Reconciliation pipeline:
1. **Step 1 (`LOGIN-01` Phone Auth Ownership Hardening):** Restricted unauthenticated customer JWT issuance on `POST /api/loyalty/auth/phone` (`worker/src/tree/loyalty/phone-auth-handler.ts`) when `meta?.verified_at || c.env.ENVIRONMENT === 'production'`, requiring either OTP verification (`otp_verified` / `otp`) or an active `Authorization: Bearer` header.
2. **Step 2 (PayOS Reconciliation & DLQ Auto-Recovery Engine):** Implemented the full 4-phase plan from `plans/261024-0116-payos-reconciliation/plan.md`:
   - **D1 Migration & Schema Sync:** Created `worker/db/migrations/20261029_02_payment_reconciliation_jobs.sql` (`payment_reconciliation_jobs` table + `idx_payment_reconcile_due` index) and synced `worker/schema.sql`, `db/schema.sql`, and `worker/src/__tests__/helpers/payment-sqlite-db.ts`.
   - **Provider Verifier & CAS Lease (`packages/domain/payment/commands/`):**
     - `payos-provider-verify.ts` (146 lines): `GET https://api-merchant.payos.vn/v2/payment-requests/{orderCode}` with `/^\d+$/` guard, 5s timeout, HMAC signature check (`verifyPayOSSignature`), and strict `orderCode`/`amount`/`linkId`/`amountPaid`/`amountRemaining` verification.
     - `payos-reconcile-lease.ts` (102 lines): D1 CAS lease (`claimReconcileJob`, `releaseReconcileJob`, 90s lease TTL) and KV review marker writer (`writePaymentReviewMarker` with 7d TTL and untrusted ID sanitization).
     - `payos-reconcile.ts` (189 lines): Single-writer settlement via `settlePayOS`, post-I/O state re-read, refund immutability guard, cancelled-order `PAID_ON_CANCELLED_ORDER` flagging, and single `payment_success` metric emission when `paymentChanged === true`.
   - **Create-Link Recovery & Webhook DLQ Markers:**
     - Updated `packages/domain/payment/commands/payos-attempt.ts` and `payos-create-link.ts` so `recover()` verifies existing `pending` attempts with PayOS and auto-settles `PAID` payments (`409 ORDER_ALREADY_PAID`), reuses `PENDING` links, or rotates `CANCELLED`/`EXPIRED` links.
     - Updated `worker/src/routes/webhooks-handlers/payos.ts` to emit `payment:review:{id}` markers on invalid signature (`untrusted: true`), unknown `orderCode` (preserving `200` ACK), and amount mismatch.
   - **Scheduled Cron & Manual Admin Endpoint:**
     - Created `worker/src/routes/cron-handlers/payment-reconcile.ts` (155 lines) and wired `runPaymentReconciliation` into `worker/src/scheduled.ts`, `worker/src/routes/cron.ts`, and `worker/src/routes/cron-handlers/index.ts`.
     - Created `worker/src/routes/payment-reconcile-handlers/manual-reconcile.ts` (92 lines) and mounted `POST /api/admin/payments/:id/reconcile` (`owner`, `admin`, `manager`, `cashier` + `audit('payment_reconcile')`) in `worker/src/routes/features-router.ts`.
     - Extended `getStuckPayments` in `worker/src/routes/admin-handlers.ts` to surface `payment:review:*` entries and `reconcileStatus`.
   - **Verification Suite:** Created `worker/src/__tests__/routes/payos-reconcile.test.ts` (411 lines, 17 real-SQLite integration tests) and aligned migration counts in `worker/src/__tests__/routes/web-payment-and-staging-gates.test.ts`.

## Verification Results
- **Login Flow Audit Probes (`reports/audit/plan/261028-1829-login-flow/audit-probes.config.mjs`):** `3/3 PASS` (`LOGIN-01`, `LOGIN-02`, `LOGIN-03`)
- **D1 Migration Linter (`node scripts/lint-d1-migrations.mjs`):** `PASS` (`47 forward, 10 down` in `worker/db/migrations`; `74 forward, 10 down` total across 4 directories)
- **TypeScript (`npx tsc --noEmit` & `npx tsc --noEmit -p worker/tsconfig.json`):** `PASS` (`0 errors`)
- **ESLint (`npm run lint --silent`):** `PASS` (`0 errors`)
- **Vitest Suites (`125/125 PASS` across 7 test files):**
  - `worker/src/__tests__/routes/payos-reconcile.test.ts` (`17 passed`)
  - `worker/src/__tests__/routes/payos-webhook-e2e.test.ts` (`13 passed`)
  - `worker/src/__tests__/routes/admin-payments-stuck.test.ts` (`4 passed`)
  - `worker/src/__tests__/routes/web-payment-and-staging-gates.test.ts` (`47 passed`)
  - `packages/domain/payment/__tests__/payos-attempt-integrity.test.ts` (`21 passed`)
  - `worker/src/__tests__/tree/loyalty/phone-auth-handler.test.ts` (`5 passed`)
  - `tests/loyalty.test.ts` (`18 passed`)

## Unresolved Questions
- None. Remote D1 migration (`20261029_02_payment_reconciliation_jobs.sql`) and Worker deploy are ready whenever you authorize production rollout.
