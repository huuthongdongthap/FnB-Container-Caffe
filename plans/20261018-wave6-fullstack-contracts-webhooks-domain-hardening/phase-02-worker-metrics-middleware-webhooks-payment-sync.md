# Phase 02: Worker Metrics, Middleware, Webhooks & Order Hono Handlers

## Context Links
- Brainstorm Report: [reports/brainstorm-20261018-wave6-deep-audit.md](reports/brainstorm-20261018-wave6-deep-audit.md)
- Plan Overview: [plan.md](plan.md)

## Overview
- **Priority**: High
- **Status**: Pending
- **Scope**: Guard `metrics-collector.ts` against minimal D1 mocks and `_alerts` schema differences, harden `staff-auth.ts` & `audit-log.ts`, fix PayOS/MoMo webhook signature & KV/order sync, and harden `orders-hono-handlers` & `customers-handlers`.

## Related Code Files (Strict Ownership)
- `worker/src/lib/metrics-collector.ts`
- `worker/src/middleware/staff-auth.ts`
- `worker/src/middleware/audit-log.ts`
- `worker/src/middleware/auth.ts`
- `worker/src/routes/webhooks-handlers/helpers.ts`
- `worker/src/routes/webhooks-handlers/payos.ts`
- `worker/src/routes/webhooks/momo.ts`
- `worker/src/routes/orders-hono-handlers/guest-handlers.ts`
- `worker/src/routes/orders-hono-handlers/checkout-handlers.ts`
- `worker/src/routes/orders-hono-handlers/kds-handlers.ts`
- `worker/src/routes/customers-handlers/admin-handlers.ts`
- `worker/src/routes/customers-handlers/profile-handlers.ts`

## Implementation Steps
1. **`worker/src/lib/metrics-collector.ts`**:
   - In `recordMetric`, `pruneOldMetrics`, `createMetricsCollector.recordMetric`, and `createMetricsCollector.pruneOldMetrics`, wrap statement execution in `try/catch` and verify `typeof stmt?.run === 'function'` before calling `stmt.run()`, using `result?.meta?.changes ?? 0`.
   - In `createMetricsCollector.recordAlert`, add a `try/catch` fallback for `_alerts` without the `dispatched` column (`SELECT id FROM _alerts WHERE alert_key = ? AND resolved_at IS NULL` and `INSERT INTO _alerts (alert_key, severity, message, value, threshold, created_at) VALUES (?, ?, ?, ?, ?, ?)`).
2. **`worker/src/middleware/staff-auth.ts`, `auth.ts` & `audit-log.ts`**:
   - In `staff-auth.ts`, include `'admin'` in default `allowedRoles`, guard `c.env?.AUTH_KV` before `.get(...)`, and resolve `id: String(payload.id || (payload as Record<string, unknown>).sub || '')`.
   - In `auth.ts` (`optionalAuth`), resolve `id: String(payload.id || (payload as Record<string, unknown>).sub || '')`.
   - In `audit-log.ts`, resolve `tenantId: user?.tenantId ?? user?.tenant_id`.
3. **`worker/src/routes/webhooks-handlers/helpers.ts` & `payos.ts`**:
   - In `helpers.ts` (`verifySignature`), serialize `null` or `undefined` property values as `''` (`const val = data[k] === null || data[k] === undefined ? '' : data[k]; return `${k}=${val}`;`).
   - In `payos.ts`:
     - Update `orders.payment_status = 'paid'` without restricting to `AND payment_method = 'payos'` (or set `payment_method = 'payos'` when matched via PayOS `payments` table) so orders initially created with default `'cash'` and paid via PayOS link transition to `'paid'`.
     - Add `.catch(() => {})` on `kv.put('latest_order_ts', now)` and call `publishOrderEvent(kv, payment.order_id, 'paid')` (and in the self-healing branch).
     - Query `SELECT total FROM orders WHERE id = ?` (with fallback to `total_amount`) when computing loyalty cashback on webhook completion.
4. **`worker/src/routes/webhooks/momo.ts`**:
   - Update `AUTH_KV` (`latest_order_ts`, `orders:latest_updated_at`) and call `publishOrderEvent(c.env.AUTH_KV, payment.order_id, isSuccess ? 'paid' : 'payment_failed')`.
   - On failed MoMo IPN (`!isSuccess`), guard the order update with `WHERE id = ? AND payment_status != 'paid'` so a late failed attempt cannot clobber an already-paid order.
5. **`worker/src/routes/orders-hono-handlers/**` & `customers-handlers/**`**:
   - In `guest-handlers.ts`: Call `publishOrderEvent(c.env.AUTH_KV, orderId, 'pending')` in both `handleGuestCheckin` and `handleGuestCheckout`. In `handleGuestCheckout`, look up authoritative prices from `products` when `item_id`/`id` is present in D1 (falling back to client price only if DB returns no row in mock environments).
   - In `checkout-handlers.ts`: Include `'cashier'` in `requireAuth` and call `publishOrderEvent(c.env.AUTH_KV, id, 'pending')`.
   - In `kds-handlers.ts`: Include `'waiter'` and `'cashier'` in `kdsRoles` and `'cashier'` in `mark-cod-paid`.

## Success Criteria
- Zero `recordMetric_failed: db.prepare(...).bind(...).run is not a function` errors in test output.
- All webhook, middleware, and order handler tests pass.
