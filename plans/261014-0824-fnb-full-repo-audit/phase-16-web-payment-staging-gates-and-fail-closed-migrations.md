# Phase 16: Web Payment Fail-Closed, Staging Gates & Fail-Closed D1 Migration Runners

**Context Links:**
- [Overview Plan](plan.md)
- [Phase 15: OpenAPI Table Zones Auth, ORDER BY SQLi & Staff Security Hardening](phase-15-openapi-table-zones-auth-order-by-sqli-and-staff-security-hardening.md)
- [Operational Readiness Report](../reports/audit-261014-repo-operational-readiness-verification.md)

## Overview
- **Priority:** P0 / P1 (Payment Security, Release Gate Honesty & D1 Data Loss Prevention)
- **Current Status:** Complete
- **Description:** Enforces fail-closed behavior on `/api/payments/payment-request` (`401`/`403`/`422`), hardens `GATE_2` build freshness and `GATE_3` static vs. content-reversibility verification in `scripts/verify-staging-gates.mjs` + `scripts/lint-d1-migrations.mjs`, converts `deploy-cloudflare.sh`, `worker/scripts/apply-migrations.sh`, and `scripts/deploy-branded.sh` to fail-closed D1 migration execution (preventing destructive replay of `push_subscriptions` and `audit_logs` table-rebuild migrations), and aligns rollback/migration documentation with verified Cloudflare Wrangler/REST API/D1 Time Travel syntax.

## Key Insights
1. **Unverified Web Payment Bypass Risk:** `worker/src/routes/payments-handlers/web-payment.ts` and `packages/domain/payment/commands/process-web-payment.ts` previously allowed unverified Apple Pay / Google Pay token payloads to transition orders to `'paid'`. Both paths now require authenticated caller ownership (`401`/`403`) and reject unverified payment tokens fail-closed with `422 payment_processor_verification_unavailable` before any `orders` or `payments` write.
2. **Destructive Replay of Historical Table-Rebuild Migrations:**
   - `worker/db/migrations/20260710_02_notifications_fixed.sql:24-45` rebuilds `push_subscriptions` (`CREATE TABLE push_subscriptions_new` -> `INSERT ... SELECT id, customer_id, 'customer', ..., NULL, NULL` -> `DROP TABLE push_subscriptions` -> `RENAME`). Replaying it overwrites `role` to `'customer'`, `last_used_at` to `NULL`, and `device_id` to `NULL` on every existing row.
   - `worker/db/migrations/20261003_02_admin_metrics_and_inventory.sql:27-47` rebuilds `audit_logs` copying only 9 of 13 columns before `trg_audit_logs_sync` (`:55-68`) is created, resetting `user_id`, `entity_type`, `entity_id`, and `metadata` to `NULL`/`'{}'`, and dropping the 4 columns added later by `20261009_01_audit_trail_canonical_contract.sql:4-7` (`operating_unit_id`, `tenant_id`, `status`, `correlation_id`).
3. **Fail-Closed Deploy & Migration Runner Remediation:**
   - `deploy-cloudflare.sh` and `scripts/deploy-branded.sh` now execute **zero** D1 commands by default during normal deploys.
   - `worker/scripts/apply-migrations.sh` now fails closed (`exit 1`) unless an explicit `--file <migration.sql>` is passed, and rejects `--all`, wildcards, path traversal, files outside `worker/db/migrations/`, `*.down.sql`, and superseded files (`20260706_11`, `20260824_02`), without swallowing `"duplicate column name"` errors.
4. **Honest Rollback Gate & Verified Cloudflare CLI Syntax:**
   - `scripts/lint-d1-migrations.mjs` and `scripts/verify-staging-gates.mjs` distinguish `.down.sql` file presence (`7/36`) from safe content reversibility (`0/36` safely reversible due to `DROP TABLE` data-loss and incomplete `ALTER TABLE ADD COLUMN` reversal hazards) and static script inspection (`pages=static_command_detected, worker=unreferenced, d1=unreferenced`).
   - Rollback and deployment runbooks (`reports/devops/deploy/rollback.md`, `reports/devops/deploy/checklist.md`, `docs/runbook-d1-backup-restore.md`, `docs/deployment-guide.md`, `docs/deployment.md`, `worker/db/migrations/README.md`) now reflect the actual Pages project (`fnb-caffe-container`), Cloudflare Pages Rollback REST API, `npx wrangler rollback <VERSION_ID> --config worker/wrangler.toml`, and `npx wrangler d1 time-travel info/restore`.

## Related Code Files
- `worker/src/routes/payments-handlers/web-payment.ts`
- `packages/domain/payment/commands/process-web-payment.ts`
- `scripts/lint-d1-migrations.mjs`
- `scripts/verify-staging-gates.mjs`
- `deploy-cloudflare.sh`
- `worker/scripts/apply-migrations.sh`
- `scripts/deploy-branded.sh`
- `worker/db/migrations/README.md`
- `reports/devops/deploy/rollback.md`
- `reports/devops/deploy/checklist.md`
- `docs/runbook-d1-backup-restore.md`
- `docs/deployment-guide.md`
- `docs/deployment.md`
- `worker/src/__tests__/routes/web-payment-and-staging-gates.test.ts`

## Todo List
- [x] Enforce fail-closed `401`/`403`/`422` on `/api/payments/payment-request` and `process-web-payment.ts`
- [x] Harden `scripts/lint-d1-migrations.mjs` and `scripts/verify-staging-gates.mjs` for 4-directory inventory, `public/` freshness, and safe content reversibility
- [x] Convert `deploy-cloudflare.sh`, `worker/scripts/apply-migrations.sh`, and `scripts/deploy-branded.sh` to fail-closed explicit migration execution
- [x] Update rollback and deployment documentation with verified Cloudflare Pages REST API, Worker rollback, and D1 Time Travel syntax
- [x] Verify with offline `wrangler` mocks in `worker/src/__tests__/routes/web-payment-and-staging-gates.test.ts` (`15/15` pass), `npm run lint:migrations`, `npm run typecheck:all`, `npm run lint`, and `npm run build`
