# Phase 20: Admin Loyalty, Broadcast, Checkin & Subscriptions D1 Contract Sync

**Phase:** `phase-20-admin-loyalty-broadcast-checkin-subscriptions-sync`  
**Parent Plan:** [AURA OS Full Repository Audit & Operational Remediation Plan](plan.md)  
**Status:** Complete  
**Date:** 2026-10-15  

---

## 1. Context & Objectives

Following Phase 18 (Staff & Admin D1 Contract Sync) and Phase 19 (Mobile Staff, KDS & Admin Integrations Sync), an end-to-end audit of all remaining Admin management routes revealed 5 additional runtime schema mismatches between the Worker API queries and the live D1 database schema (`checkpoint-pre-rollout.sql`):

1. **Admin Broadcast Segments (`/api/broadcast/send` & `types.ts`)**:
   - `segmentSQL` queried `WHERE tier = 'bronze'` (and silver, gold, platinum). On live D1 `customers` table, the column is `loyalty_tier`. D1 threw `no such column: tier`.
   - `birthday_this_month` queried `WHERE birthday IS NOT NULL`. On live D1 `customers` table, the column is `date_of_birth`.
2. **Customer Segments Overview (`/api/customers/segments` in `admin-handlers.ts`)**:
   - Birthday count query referenced non-existent `customers.birthday` instead of `customers.date_of_birth`.
3. **Admin Loyalty Dashboard (`/api/admin-loyalty/*`)**:
   - Direct queries on `/widgets`, `/tiers`, `/top-customers`, and `/export` attempted to select `cashback_balance`, `total_spent`, and `visit_count` from `customers`. On live D1, balances reside in `cashback_wallets` and `orders`.
4. **Check-in Reward Approvals (`PATCH /api/checkin/:id/approve`)**:
   - The approval flow attempted `UPDATE customers SET cashback_balance = ...`. This failed on live D1 because `cashback_balance` does not exist on `customers`.
5. **Subscriptions Lifecycle Resilience (`/api/subscriptions/*`)**:
   - Missing tables on unmigrated or fresh databases threw unhandled 500 exceptions instead of returning safe empty collections.

---

## 2. Key Code Changes

| Component / File | Issue | Remediation |
|:---|:---|:---|
| `worker/src/routes/broadcast-handlers/types.ts` | Column mismatches: `tier` vs `loyalty_tier`, `birthday` vs `date_of_birth` | Aligned SQL with `loyalty_tier` and `date_of_birth`. |
| `worker/src/routes/broadcast-handlers/send-handler.ts` | Test mock schema variations | Added regex fallback in `catch` block for mock resilience. |
| `worker/src/routes/customers-handlers/admin-handlers.ts` | Invalid `birthday` column in segments count | Aligned with `date_of_birth` with mock fallback. |
| `worker/src/routes/admin-loyalty.ts` | Non-existent customer balance columns | Re-engineered queries to join `cashback_wallets` and `orders`, with multi-tier fallback supporting both live D1 and legacy unit mocks. |
| `worker/src/routes/checkin.ts` | Checkin cashback crediting failed on `customers` | Updated approval handler to credit `cashback_wallets` (`balance` + `total_earned`), creating wallet row if missing. |
| `worker/src/tree/subscriptions/sub-handlers.ts` & `plan-handlers.ts` | Uncaught exceptions if subscription tables are unmigrated | Wrapped `listSubscriptions`, `getStatsHandler`, and `listPlans` in resilient try/catch handlers returning empty/zeroed contracts. |
| `scripts/deploy-rollback.sh` | Missing Worker and D1 rollback capabilities | Implemented 3-tier rollback orchestration CLI covering Pages (`wrangler pages rollback`), Worker (`wrangler rollback`), and D1 Time Travel PITR (`wrangler d1 time-travel restore`). |

---

## 3. Verification & Evidence

- **Targeted Vitest Suite**: `worker/src/__tests__/routes/phase-20-admin-loyalty-broadcast-checkin-contracts.test.ts` (9/9 passed).
- **Targeted Worker Route Suites**: 59 test files, 498/498 tests passed in `worker/src/__tests__/routes/`.
- **Targeted Staging Gates Suite**: `worker/src/__tests__/routes/web-payment-and-staging-gates.test.ts` (15/15 passed).
- **Full Workspace Test Suite**: 441 test files, 4,017/4,017 tests passed (0 failures).
- **Static Rollback Gate**: `node scripts/verify-staging-gates.mjs` verifies `allStaticCommandsPresent: true` (`pages=static_command_detected, worker=static_command_detected, d1=static_command_detected`).
- **Compilation**: `npm run typecheck:all` exited with 0 errors.
- **Lint**: `npm run lint --silent` and `npm run lint:migrations` passed with 0 errors.
- **Production Build**: `npm run build --silent` succeeded in 3.66s.
