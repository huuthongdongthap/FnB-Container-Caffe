# Phase 04: Worker Feature Routes, Tree Handlers, D1 SQL Fallbacks & RBAC Hardening

## Context Links
- Brainstorm Report: `plans/20261018-wave5-pos-loyalty-admin-d1-domain-hardening/reports/brainstorm-20261018-wave5-deep-audit.md`
- Overview Plan: `plans/20261018-wave5-pos-loyalty-admin-d1-domain-hardening/plan.md`

## Overview
- **Priority**: P0
- **Status**: Completed
- **Description**: Align Worker feature routes and `worker/src/tree/**` handlers with canonical D1 tables/columns (using safe `try/catch` fallbacks so existing mock tests continue to pass), add missing DinDin checkout/carts endpoints, unwrap Pretix paginated `.results`, and standardize RBAC roles.

## Key Insights
- `promotions-handlers/validation-handlers.ts:91-94` updates `promotions WHERE id = ?` (canonical PK is `code`) and inserts into `promotion_redemptions` without `try/catch`.
- `reports-handlers/reconciliation-handlers.ts:18-26` queries `shifts` and `denominations` without `try/catch` (canonical: `staff_shifts` and `denominations_json`).
- `reminders/shifts/route.ts:78-81` updates non-existent `updated_at` on `staff_shifts`, throwing after push notifications are sent.
- `tree/loyalty/phone-auth-handler.ts:59-61` inserts `date_of_birth, zalo, source` into `customers` without `try/catch`; `spend-cashback-handler.ts:74-77` omits `wallet_id` on `cashback_transactions` and inserts into `loyalty_audit_log` without `try/catch`; `summary-handler.ts:33` queries `user_rewards` without `try/catch`.
- `tree/referrals/apply-referral.ts:22` has an inverted `if (!pending)` check.
- `inventory-forecasting.ts:36-60,168-189` selects non-existent `max_stock` across all fallback queries.
- `dindin-handlers` is missing `GET /checkouts`, `POST /checkout/:orderId/print`, and `POST /checkout/:orderId/qc`, and `cart-handlers.ts` doesn't enrich item `name`/`price` from config.

## Requirements
- Fix `promotions-handlers/{validation-handlers,admin-handlers}.ts`, `reports-handlers/{analytics-handlers,reconciliation-handlers,export-handlers}.ts`, and `reminders/shifts/route.ts`.
- Add safe canonical D1 fallbacks in `table-sessions-handlers/*`, `floor-plan.ts`, `referrals.ts`, `tree/referrals/*`, `tree/loyalty/{phone-auth-handler,spend-cashback-handler,summary-handler}.ts`, `admin-handlers.ts`, and `admin-loyalty.ts`.
- Add safe `try/catch` fallbacks in `tree/campaigns/**`, `tree/mautic/**`, `tree/auth/{email-verification,verified-email-middleware,list-staff,register-staff}.ts`, `saas-pricing.ts`, `saas-tenants.ts`, `tree/qr/generator.ts`, `tree/subscriptions/sub-handlers.ts`, `analytics-handlers/metrics-handlers.ts`, and `webhooks/momo.ts`.
- Remove `max_stock` from `inventory-forecasting.ts` fallback queries.
- Implement `GET /checkouts`, `POST /checkout/:orderId/print`, `POST /checkout/:orderId/qc` and enrich cart items in `worker/src/routes/dindin-handlers/*`.
- Unwrap `(events as any)?.results ?? events` in `worker/src/routes/pretix-handlers/event-handlers.ts`, pass `title`/`message` in `broadcast-handlers/send-handler.ts`, and support case-insensitive/prefix action filtering in `admin-audit-logs-handlers/query-handler.ts`.
- Add `'admin'` / `'manager'` / `'staff'` to RBAC in `features-router.ts`, `orders-core.ts`, `orders-mobile.ts`, `tables-mobile.ts`, and `auth-handlers/staff-handlers.ts`.

## Related Code Files
- Modify:
  - `worker/src/routes/promotions-handlers/validation-handlers.ts`
  - `worker/src/routes/promotions-handlers/admin-handlers.ts`
  - `worker/src/routes/reports-handlers/analytics-handlers.ts`
  - `worker/src/routes/reports-handlers/reconciliation-handlers.ts`
  - `worker/src/routes/reports-handlers/export-handlers.ts`
  - `worker/src/routes/reminders/shifts/route.ts`
  - `worker/src/routes/table-sessions-handlers/session-handlers.ts`
  - `worker/src/routes/table-sessions-handlers/order-handlers.ts`
  - `worker/src/routes/floor-plan.ts`
  - `worker/src/routes/referrals.ts`
  - `worker/src/tree/referrals/apply-referral.ts`
  - `worker/src/tree/referrals/process-referral.ts`
  - `worker/src/tree/referrals/referral-cashback.ts`
  - `worker/src/tree/referrals/reverse-cashback.ts`
  - `worker/src/tree/loyalty/phone-auth-handler.ts`
  - `worker/src/tree/loyalty/spend-cashback-handler.ts`
  - `worker/src/tree/loyalty/summary-handler.ts`
  - `worker/src/routes/admin-handlers.ts`
  - `worker/src/routes/admin-loyalty.ts`
  - `worker/src/routes/dindin-handlers/routes.ts`
  - `worker/src/routes/dindin-handlers/cart-handlers.ts`
  - `worker/src/routes/dindin-handlers/checkout-handlers.ts`
  - `worker/src/routes/pretix-handlers/event-handlers.ts`
  - `worker/src/routes/broadcast-handlers/send-handler.ts`
  - `worker/src/routes/admin-audit-logs-handlers/query-handler.ts`
  - `worker/src/routes/push.ts`
  - `worker/src/routes/inventory-forecasting.ts`
  - `worker/src/tree/campaigns/campaign-engine.ts`
  - `worker/src/tree/campaigns/triggers/cashback-expiry.ts`
  - `worker/src/tree/mautic/campaign-detection.ts`
  - `worker/src/tree/mautic/contact-sync-cron.ts`
  - `worker/src/tree/auth/email-verification.ts`
  - `worker/src/tree/auth/verified-email-middleware.ts`
  - `worker/src/tree/auth/list-staff.ts`
  - `worker/src/tree/auth/register-staff.ts`
  - `worker/src/tree/qr/generator.ts`
  - `worker/src/tree/subscriptions/sub-handlers.ts`
  - `worker/src/routes/analytics-handlers/metrics-handlers.ts`
  - `worker/src/routes/webhooks/momo.ts`
  - `worker/src/routes/features-router.ts`
  - `worker/src/routes/orders-core.ts`
  - `worker/src/routes/orders-mobile.ts`
  - `worker/src/routes/tables-mobile.ts`
  - `worker/src/routes/auth-handlers/staff-handlers.ts`

## Todo List
- [x] Fix SQL & fallbacks in `promotions-handlers`, `reports-handlers`, `reminders/shifts`, `table-sessions-handlers`, and `floor-plan`
- [x] Fix `referrals`, `tree/referrals/*`, `tree/loyalty/*`, `admin-handlers`, and `admin-loyalty`
- [x] Fix `dindin-handlers`, `pretix-handlers`, `broadcast-handlers`, `admin-audit-logs-handlers`, `push.ts`, and `inventory-forecasting.ts`
- [x] Fix `tree/campaigns/*`, `tree/mautic/*`, `tree/auth/*`, `tree/qr/generator.ts`, `tree/subscriptions/sub-handlers.ts`, `metrics-handlers.ts`, `webhooks/momo.ts`, and RBAC roles
