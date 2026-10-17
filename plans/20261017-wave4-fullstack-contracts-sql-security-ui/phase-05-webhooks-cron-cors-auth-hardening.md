# Phase 05: Webhooks Fail-Closed Hardening, Cron SQL Resilience, CORS & Auth Role Matrix

## Context Links
- Brainstorm Report: `plans/20261017-wave4-fullstack-contracts-sql-security-ui/reports/brainstorm-20261017-wave4-deep-audit.md`
- Overview Plan: `plans/20261017-wave4-fullstack-contracts-sql-security-ui/plan.md`

## Overview
- **Priority**: P0
- **Status**: Completed
- **Description**: Harden payment/messaging webhooks (`PayOS`, `NowPayments`, `MoMo`, `Zalo`) to fail closed and verify signatures/amounts safely, align scheduled/cron SQL queries (`cashback-warnings`, `cashback-expiry`, `lookup-handler`, `order-checks`, `shifts/route`, `mautic/*`) with canonical D1 schema, unify CORS headers/origins, and standardize `requireAuth` role matrices across admin/staff endpoints.

## Key Insights
- `worker/src/routes/openapi-payments-handlers/webhook-handlers.ts:28-33` and `packages/domain/payment/commands/nowpayments-ipn.ts:33-46` skip HMAC verification if the secret env var is unset.
- `worker/src/routes/webhooks/momo.ts` calls `await c.req.text()` a second time in `catch` (throwing stream already consumed), writes DLQ to non-existent `c.env.AURA_KV` instead of `AUTH_KV`, and does not verify `payload.amount`.
- `lookup-handler.ts`, `cashback-warnings.ts`, and `cashback-expiry.ts` query `cashback_transactions.customer_id` (which does not exist; `customer_id` is on `cashback_wallets`).
- `order-checks.ts` queries legacy Vietnamese statuses `('Bep tiep nhan', 'Dang pha che')` instead of `('pending', 'confirmed', 'preparing')`.

## Requirements
- Fail closed (`500`/`401`) in `openapi-payments-handlers/webhook-handlers.ts` when `PAYOS_CHECKSUM_KEY` or `body.data` is missing.
- Fail closed (`500`/`401`) in `nowpayments-ipn.ts` when `NOWPAYMENTS_IPN_SECRET` is missing and use constant-time signature comparison.
- Fix `momo-create.ts` (enforce order ownership when `orderRow.customer_id` is set and caller is another authenticated user, regenerate `paymentId`/`transId` inside retry loop, store `orderCode` in `transaction_id`) and `webhooks/momo.ts` (constant-time signature check, verify `amount`, reuse `rawBody` in `catch`, write DLQ to `c.env.AUTH_KV ?? c.env.AURA_KV`).
- Add HMAC signature check to `zalo-webhook.ts` when `ZALO_OA_SECRET` or `ZALO_APP_SECRET` is configured.
- Fix `lookup-handler.ts`, `cashback-warnings.ts`, and `cashback-expiry.ts` to join `cashback_wallets cw ON cw.id = ct.wallet_id` (with `try/catch` fallback for legacy mocks).
- Fix `order-checks.ts` to query `status IN ('pending', 'confirmed', 'preparing')` and guard `AND (notes IS NULL OR notes NOT LIKE '%[OVERDUE]%')`.
- Wrap `scheduled.ts`, `reminders/shifts/route.ts`, and `tree/mautic/*.ts` in resilient `try/catch` blocks and align `customers` column names (`loyalty_tier`, `loyalty_points`).
- Update `worker/src/index.ts` and `worker/src/middleware/cors.ts` to include `Idempotency-Key`, `X-Tenant-ID`, `X-Edge-Telemetry-Secret` in `allowHeaders` and `https://auraspace.cafe` in `ALLOWED_ORIGINS`.
- Standardize `requireAuth` roles across `features-router.ts` (mount `/api/reviews` root + `/api/reviews/*`, allow `['owner', 'manager', 'admin']` on `/api/admin/payments/stuck`, avoid duplicate `/api/admin/metrics` conflict), `auth-endpoints.ts` (`GET /api/auth/staff` allows `['owner', 'manager', 'admin']`), `staff-mobile.ts`, `tables-mobile.ts`, `orders-mobile.ts`, `openapi-promotions-handlers/routes.ts`, and `openapi-auth-handlers/auth-handlers.ts` (use client IP in `forgot-password` rate limiter).

## Architecture
- Webhooks must fail closed when secrets or signatures are missing in production/configured environments, use constant-time HMAC comparison, and persist DLQ payloads to `AUTH_KV`.

## Related Code Files
- Modify:
  - `worker/src/index.ts`
  - `worker/src/scheduled.ts`
  - `worker/src/middleware/cors.ts`
  - `worker/src/lib/rate-limiter.ts`
  - `worker/src/routes/features-router.ts`
  - `worker/src/routes/auth-endpoints.ts`
  - `worker/src/routes/staff-mobile.ts`
  - `worker/src/routes/tables-mobile.ts`
  - `worker/src/routes/orders-mobile.ts`
  - `worker/src/routes/zalo-webhook.ts`
  - `worker/src/routes/container-telemetry.ts`
  - `worker/src/routes/openapi-payments-handlers/webhook-handlers.ts`
  - `worker/src/routes/openapi-promotions-handlers/routes.ts`
  - `worker/src/routes/openapi-auth-handlers/auth-handlers.ts`
  - `worker/src/routes/customers-handlers/admin-handlers.ts`
  - `worker/src/routes/webhooks/momo.ts`
  - `worker/src/routes/cron-handlers/cashback-warnings.ts`
  - `worker/src/routes/cron-handlers/order-checks.ts`
  - `worker/src/routes/cron-handlers/erpnext-sync.ts`
  - `worker/src/tree/loyalty/auth-middleware.ts`
  - `worker/src/tree/loyalty/lookup-handler.ts`
  - `worker/src/tree/campaigns/triggers/cashback-expiry.ts`
  - `worker/src/tree/mautic/campaign-detection.ts`
  - `worker/src/tree/mautic/campaign-enrollment.ts`
  - `worker/src/tree/mautic/contact-sync.ts`
  - `worker/src/tree/mautic/enrollment-tracker.ts`
  - `worker/src/routes/reminders/shifts/route.ts`
  - `packages/domain/payment/commands/momo-create.ts`
  - `packages/domain/payment/commands/nowpayments-ipn.ts`

## Implementation Steps
1. Harden `openapi-payments-handlers/webhook-handlers.ts`, `nowpayments-ipn.ts`, `momo-create.ts`, `webhooks/momo.ts`, and `zalo-webhook.ts`.
2. Fix SQL and error handling in `lookup-handler.ts`, `cashback-warnings.ts`, `cashback-expiry.ts`, `order-checks.ts`, `erpnext-sync.ts`, `reminders/shifts/route.ts`, `tree/mautic/*.ts`, and `scheduled.ts`.
3. Update `worker/src/index.ts` and `worker/src/middleware/cors.ts` with complete CORS headers and `auraspace.cafe` origins.
4. Update `features-router.ts`, `auth-endpoints.ts`, `staff-mobile.ts`, `tables-mobile.ts`, `orders-mobile.ts`, `openapi-promotions-handlers/routes.ts`, `openapi-auth-handlers/auth-handlers.ts`, `tree/loyalty/auth-middleware.ts`, `customers-handlers/admin-handlers.ts`, and `container-telemetry.ts`.

## Todo List
- [x] Harden PayOS OpenAPI, NowPayments IPN, MoMo, and Zalo webhooks
- [x] Fix `cashback_wallets` join in `lookup-handler`, `cashback-warnings`, and `cashback-expiry`
- [x] Fix `order-checks.ts` canonical statuses and `[OVERDUE]` idempotency
- [x] Wrap `scheduled.ts`, `shifts/route.ts`, and `mautic/*` in resilient `try/catch`
- [x] Align CORS headers/origins and `requireAuth` role matrices

## Success Criteria
- All webhook, cron, auth, and payment test suites pass with 0 regressions.

## Risk Assessment
- Check existing webhook tests (`nowpayments`, `payos`, `momo`) to verify whether tests supply secrets in `env`; preserve test compatibility while failing closed against invalid/forged signatures.

## Security Considerations
- Eliminates forged webhook acceptance, cross-customer MoMo payment initiation, and global rate-limit bucket sharing on `/api/auth/forgot-password`.

## Next Steps
- Run full 5-gate verification after all 5 phases complete.
