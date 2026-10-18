# Phase 02: Worker Feature Routes, Auth, QR, Chat & Realtime Sync

**Context**: [plan.md](plan.md) | [reports/brainstorm-20261018-wave7-deep-audit.md](reports/brainstorm-20261018-wave7-deep-audit.md)
**Priority**: High
**Status**: Completed
**File Ownership (Strict)**:
- `worker/src/routes/{orders-hono-handlers/**,floor-plan.ts,table-sessions-handlers/**,notifications-mobile.ts,admin-qr.ts,dindin-handlers/**,chat.ts,recruitment.ts,pos-customer.ts,loyalty.ts,checkin.ts,birthday.ts,referrals.ts,push.ts,customers-handlers/**,reports-handlers/**,cron-handlers/**,webhooks-handlers/**,orders-unified.ts,staff-mobile.ts,orders-mobile.ts,tables-mobile.ts,refunds-handlers/**,crm-handlers/**,features-router.ts,analytics-handlers/**}`
- `worker/src/tree/{qr/**,loyalty/**}`
- `worker/src/lib/{audit-logger.ts,validators/customer.ts}`

---

## Implementation Steps

1. **D1 Schema Fallbacks in Feature Routes**:
   - `worker/src/routes/orders-hono-handlers/guest-handlers.ts` & `checkout-handlers.ts`: Keep primary queries for test spy compatibility, and add `try/catch` fallbacks for `cafe_tables` without `updated_at`, `orders` using `address` instead of `customer_address`, and `INSERT INTO order_items` wrapped in `try/catch`.
   - `worker/src/routes/floor-plan.ts` & `worker/src/routes/table-sessions-handlers/{session-handlers.ts,order-handlers.ts}`: Wrap `cafe_tables.notes` and `table_sessions` queries in `try/catch`, and in `/:id/no-show` keep the table status consistent (`'Available'` after logging no-show or fallback cleanly).
   - `worker/src/routes/notifications-mobile.ts`: Return `{ items: [], unreadCount: 0 }` when `notifications` table is missing, and fall back to `customer_id` (without `last_used_at`) on `push_subscriptions`.
   - `worker/src/routes/admin-qr.ts` & `worker/src/tree/qr/generator.ts`: Support string table IDs (`String(t.id)`) as well as numeric IDs in `slugMap` and `table_qr_codes`, and wrap `table_qr_codes` queries in `try/catch`.
   - `worker/src/routes/dindin-handlers/{cart-handlers.ts,checkout-handlers.ts}`: Fall back from `dindin_carts` to `dindin_cart (raw)`, fix cart item update total calculation (`cart.total - prevPrice * prevQty + nextPrice * nextQty`), write idempotency KV key after D1 insert succeeds (or clean up on error), and call `publishOrderEvent` on QC completion.
   - `worker/src/routes/chat.ts` & `worker/src/routes/recruitment.ts`: Provide `content` in `contact_messages` inserts (with fallback), omit string `id` when `contact_messages.id` is `INTEGER PRIMARY KEY AUTOINCREMENT` (with fallback), and do not grant `resolvedDirection = 'admin'` when `JWT_SECRET` is unset.
   - `worker/src/routes/pos-customer.ts`, `worker/src/tree/loyalty/{auth-middleware.ts,lookup-handler.ts,summary-handler.ts}`, `worker/src/routes/loyalty.ts`: Add `try/catch` fallbacks when `lifetime_points`, `loyalty_tiers` (fall back to `tier_configs`), `balance_after`, `reward_type`/`reward_value`, or `customers.updated_at` differ in canonical schema.
   - `worker/src/routes/customers-handlers/profile-handlers.ts`, `worker/src/routes/reports-handlers/{analytics-handlers.ts,export-handlers.ts}`, `worker/src/routes/cron-handlers/cashback-warnings.ts`, `worker/src/routes/webhooks-handlers/notifications.ts`, `worker/src/lib/audit-logger.ts`: Add `try/catch` fallbacks for `customers.updated_at` and `zalo`/`last_expiry_warning_at`, filter exported customers by `from`/`to` and RFC 4180-escape CSV cells, read `orderRow.address || orderRow.customer_address`, and wrap `c.executionCtx` access in `try/catch`.

2. **Auth, Checkin, Birthday & RBAC Hardening**:
   - `worker/src/lib/validators/customer.ts` & `worker/src/routes/checkin.ts`: Allow `customer_id` or `phone` in `checkinSchema` (resolving customer by phone when `customer_id` is omitted), require staff auth on `GET /api/checkin`, and record `staff_id = user?.id` on approve/reject.
   - `worker/src/routes/birthday.ts`: Fix `checkBirthdayEligibility` across month/year boundaries and validate birthday eligibility in `POST /api/birthday/redeem`.
   - `worker/src/tree/loyalty/auth-middleware.ts`, `worker/src/routes/referrals.ts`, `worker/src/routes/customers-handlers/admin-handlers.ts`: Check `AUTH_KV` for `revoked:${token}` when present and avoid matching `email = ''` when `payload.email` is empty.
   - Expand RBAC roles (`cashier`, `waiter`, `staff`, `admin`) across `orders-unified.ts`, `staff-mobile.ts`, `orders-mobile.ts`, `tables-mobile.ts`, `floor-plan.ts`, `pos-customer.ts`, `dindin-handlers/routes.ts`, `refunds-handlers/*`, `crm-handlers/*`, `features-router.ts`, `analytics-handlers/metrics-handlers.ts`.
   - Add `publishOrderEvent` in `orders-mobile.ts`, `refunds-handlers/mutation-handlers.ts`, `crm-handlers/order-handlers.ts`, `table-sessions-handlers/order-handlers.ts`, and check `changes === 0` in `features-router.ts` order status/complete routes.

---

## Success Criteria
- Zero TypeScript errors, zero ESLint errors, and all existing worker unit/integration tests pass.
