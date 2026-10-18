# Phase 05: Worker Auth Revocation, Webhooks, Tracking & Test Hardening

**Context**: [plan.md](plan.md) | [reports/brainstorm-20261018-wave8-deep-audit.md](reports/brainstorm-20261018-wave8-deep-audit.md)
**Priority**: High
**Status**: Pending
**File Ownership (Strict)**:
- `worker/src/routes/orders-unified.ts`
- `worker/src/routes/erpnext.ts`
- `worker/src/routes/webhooks-handlers/payos.ts`
- `worker/src/routes/cal-booking-webhook-handlers/bookings-handler.ts`
- `worker/src/tree/subscriptions/{middleware.ts,sub-handlers.ts}`
- `worker/src/__tests__/routes/{debug-patch.test.ts,debug-refund.test.ts,debug-wrong-sig.test.ts,reviews-dispatcher.test.ts,contact-dispatcher.test.ts,admin-metrics.test.ts}`
- `worker/src/__tests__/middleware/audit-log.test.ts`
- `worker/src/__tests__/orders/loyalty-dual-trigger.test.ts`

---

## Requirements & Implementation Steps

1. **Guest Public Order Tracking Route**:
   - `worker/src/routes/orders-unified.ts`: Add public order tracking route `GET /api/orders/:id/track` (or permit unauthenticated `GET /:id` when order exists and return sanitized public fields) so guest customers can track orders without 401 Unauthorized errors.

2. **KV Token Revocation Guards**:
   - `worker/src/tree/subscriptions/middleware.ts`: In `requireAdmin`, check `if (c.env.AUTH_KV && await c.env.AUTH_KV.get('revoked:' + token)) return c.json({ error: 'Token đã bị thu hồi' }, 401)`.
   - `worker/src/tree/subscriptions/sub-handlers.ts`: In `listSubscriptions` and `cancelSubscription`, check `AUTH_KV` for `revoked:${token}`.
   - `worker/src/routes/erpnext.ts`: In `POST /configure` and `DELETE /configure`, check `AUTH_KV` for `revoked:${token}`.

3. **Webhook Resilience**:
   - `worker/src/routes/webhooks-handlers/payos.ts`: In `handlePayOSWebhook`, broaden payment lookup query: `WHERE transaction_id = ? OR id = ? OR order_id = ?`.
   - `worker/src/routes/cal-booking-webhook-handlers/bookings-handler.ts`: Wrap fallback query in safe try/catch defaulting to `COALESCE(created_at, datetime('now'))` if date/time columns are absent.

4. **Test Suite Hardening**:
   - `worker/src/__tests__/routes/debug-patch.test.ts`: Dispatch actual `PATCH /api/tables/:id` with mock app context and verify update behavior.
   - `worker/src/__tests__/routes/debug-refund.test.ts`: Replace broad `toContain` with exact status assertions (`200` or expected status).
   - `worker/src/__tests__/routes/debug-wrong-sig.test.ts`: Assert exact status code `400` or `401`.
   - `worker/src/__tests__/middleware/audit-log.test.ts`: Execute real `audit(...)` middleware export with mock context and verify D1 statement bindings.
   - `worker/src/__tests__/routes/{reviews-dispatcher.test.ts,contact-dispatcher.test.ts,admin-metrics.test.ts}`: Import production router handlers and test real execution paths.
   - `worker/src/__tests__/orders/loyalty-dual-trigger.test.ts`: Test production order transition path with mock database, asserting idempotency.

---

## Success Criteria
- Zero TypeScript errors, zero ESLint errors.
- 100% Vitest suites pass with real assertions (no tautological mocks or unconstrained status code arrays).
- Revoked JWT tokens are rejected across all admin and subscription endpoints.
