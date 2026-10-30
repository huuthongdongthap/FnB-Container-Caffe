# Brainstorm Report: Incremental Migration 3-Way Schema Parity & Full-Monorepo Zero-Warning Lint

**Date:** 2026-10-30
**Baseline Commit:** `9f7e0bd98c2503cb0c98e40a96e05b2f5e62f654`
**Predecessor Plan:** `plans/261030-0730-schema-bootstrap-parity-and-legacy-fallback-hardening` (`Complete`)

## 1. Empirical Findings (`Scout-First`)

### Finding A — Incremental Migration Path (`createProductionReplica() + migrations`) vs Canonical `worker/schema.sql` (`123` vs `124` Tables, `53` Missing Columns Across `19` Tables)
While `worker/schema.sql` and `db/schema.sql` achieved 100% 124-table column parity in `261030-0730` (`verified by tests/bootstrap-payment-schema.test.ts`), comparing the incremental migration path (`createProductionReplica() + 20261029_03..20261030_01`) against `worker/schema.sql` revealed:
1. **1 missing table** in incremental migrations:
   - `waste_log` (`id`, `ingredient_id`, `quantity`, `unit`, `reason`, `notes`, `logged_by`, `created_at` + indexes `idx_waste_log_item`, `idx_waste_log_date`).
2. **53 missing columns across 19 tables** in incremental migrations:
   - `cafe_tables`: `created_at`
   - `menu_items`: `is_local_specialty`, `ingredient_source`
   - `customers`: `notes`, `capture_source`, `marketing_consent`, `consent_marketing`, `consent_analytics`, `consent_timestamp`, `first_visit_at`, `last_visit_at`, `referred_by`
   - `reviews`: `customer_id`, `is_approved`, `is_visible`, `updated_at`
   - `cashback_wallets`: `lifetime_earned`, `lifetime_spent`, `tier`
   - `cashback_transactions`: `tenant_id`
   - `rewards`: `min_order`
   - `promotion_usages`: `tenant_id`
   - `referral_codes`: `max_uses`, `tenant_id`
   - `referrals`: `referee_id`, `referrer_reward`, `referee_reward`, `rewarded_at`
   - `staff_shifts`: `is_active`, `staff_email`, `shift_type`
   - `notification_audit_log`: `latency_ms`
   - `users`: `username`, `full_name`, `password_changed_at`, `tier`, `total_points`
   - `staff_login_identities`: `created_at`, `updated_at`
   - `loyalty_accounts`: `points_balance`, `tier_expires_at`, `streak_days`, `last_checkin_date`, `total_orders`, `referral_code`, `referred_by`
   - `tier_configs`: `multiplier`, `birthday_discount`, `benefits`, `display_name_vi`, `min_spent_vnd`, `max_spent_vnd`
   - `loyalty_redemptions`: `voucher_code`, `used_at`
   - `recipe_ingredients`: `waste_percentage`, `notes`
   - `payment_transactions`: `currency`, `transaction_ref`, `gateway_response`
3. **Runtime Impact on Migrated Production D1**:
   - `worker/src/routes/openapi-loyalty-handlers/admin-handlers.ts:138`: `GET /api/loyalty/admin/accounts?search=<q>` interpolates `OR referral_code LIKE ?` into `SELECT * FROM loyalty_accounts ${whereClause}`. On migrated production D1 without `loyalty_accounts.referral_code`, the primary query throws `no such column: referral_code` and degrades to the `customers` fallback, and `referralCode` / `referredBy` always serialize as `null`.
   - `packages/domain/staff/commands/staff-tips.ts:52`: fallback query projects `COALESCE(u.name, u.full_name, u.username, 'Unassigned')` on `users`.
   - `packages/domain/crm/lookup-profile.ts:108`: `SELECT * FROM customers` reads `customer.last_visit_at` and `customer.tier`.

### Finding B — Frontend `src/` ESLint Warnings (`123` Warnings Across `96` Files)
- `npx eslint worker/src --max-warnings=0` passes with `0 errors, 0 warnings`.
- `npm run lint` (`eslint worker/src/ src/`) emits `0 errors, 123 warnings` across `96` files in `src/` (`122` `@typescript-eslint/no-unused-vars` and `1` `no-console` in `src/lib/logger.ts:32`).
- Cleaning these 123 warnings in `src/` brings the entire monorepo (`npm run lint -- --max-warnings=0`) to `0 errors, 0 warnings`.

## 2. Recommended Architecture & Implementation Plan

1. **Phase 01 — Migration `20261030_02` for 3-Way Canonical Schema Parity**:
   - Create `worker/db/migrations/20261030_02_replica_schema_parity_and_waste_log_cutover.sql` and `.down.sql` to create `waste_log` (+ indexes), add all 53 missing columns across the 19 tables, and backfill `loyalty_accounts` (`points_balance`, `referral_code`, `referred_by`) and `tier_configs` (`multiplier`, `benefits`).
   - Verify `npm run lint:migrations` passes (`43` forward/rollback pairs).
2. **Phase 02 — Frontend `src/` Zero-Warning ESLint Convergence**:
   - Clean all 123 ESLint warnings across 96 files in `src/` using targeted `Edit` operations without modifying UI layout or `.pen` files.
3. **Phase 03 — Regression Tests, Full Verification & Baseline Lock**:
   - Update migration count assertions in `worker/src/__tests__/routes/web-payment-and-staging-gates.test.ts` (`43` migrations) and add a full 124-table + column parity assertion between `createProductionReplica() + migrations` and `worker/schema.sql` plus a `GET /api/loyalty/admin/accounts?search=` test in `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts`.
   - Run `npm run typecheck:all`, `npx eslint worker/src/ src/ --max-warnings=0`, `npx vitest run`, `npx vite build --logLevel error`, `npm run verify:gates`, and synchronize `source-baseline.json`.

## 3. Unresolved Questions
- None. External cloud/deploy/live-origin gates remain `UNKNOWN/NOT_RUN` per security constraints.
