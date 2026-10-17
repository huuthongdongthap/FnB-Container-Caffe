# Phase 09: Webhook Routing, Simulation Guard & Customer PII Hardening

## Context Links
- [Master Audit Plan](plan.md)
- [Phase 08: Inventory RBAC & ERPNext Auth Hardening](phase-08-inventory-rbac-and-erpnext-auth-hardening.md)
- `worker/src/routes/features-router.ts`
- `worker/src/routes/cal-booking-webhook-handlers/bookings-handler.ts`
- `worker/src/routes/cal-booking-webhook-handlers/webhook-handler.ts`
- `worker/src/routes/zalo-webhook.ts`
- `worker/src/routes/customers-handlers/admin-handlers.ts`

---

## Overview
- **Priority:** P1 (High — Security, PII Protection & Webhook Reliability)
- **Current Status:** Complete
- **Brief Description:** Fix the broken Hono mount for `/api/webhooks/cal-booking` in `features-router.ts`, enforce `requireAuth(['owner', 'manager', 'staff'])` on `GET /api/webhooks/cal-booking/bookings`, gate `POST /api/webhooks/zalo/simulate` against unauthenticated production invocation, enforce production RBAC on `GET /api/customers`, and sanitize raw D1/SQLite HTTP 500 error responses across `webhook-handler.ts` and `customers-handlers/admin-handlers.ts`.

---

## Key Insights (Verified by Code Inspection)
1. **Broken Cal.com Webhook Mount (`worker/src/routes/features-router.ts:140-142`)**:
   - `calBookingWebhookRouter` (`worker/src/routes/cal-booking-webhook-handlers/routes.ts`) is a `Hono` router defining `POST /` and `GET /bookings`.
   - However, `features-router.ts:140-142` rewrote `/api/webhooks/cal-booking` to `/api/cal-booking-webhook` and invoked `calBookingWebhookRouter.fetch(...)` directly without stripping the prefix. Because `calBookingWebhookRouter` has no `/api/cal-booking-webhook` route, all requests through the main Worker `app` to `/api/webhooks/cal-booking` returned `404 Not Found`.
2. **Unauthenticated Booking PII Listing (`worker/src/routes/cal-booking-webhook-handlers/bookings-handler.ts:7`)**:
   - `GET /bookings` queries `SELECT * FROM bookings` (`attendee_name`, `attendee_email`, `metadata`, `cancellation_reason`) without `requireAuth`.
3. **Raw SQLite Error Leakage in Cal.com Webhook (`worker/src/routes/cal-booking-webhook-handlers/webhook-handler.ts:70-73`)**:
   - `catch (e: unknown)` returned `c.json({ success: false, error: msg }, 500)`, exposing raw SQLite/D1 error strings to external callers.
4. **Unguarded Production Zalo Simulation Endpoint (`worker/src/routes/zalo-webhook.ts:96-117`)**:
   - `POST /api/webhooks/zalo/simulate` ("Dev/Test simulation") is mounted publicly without authentication or production environment check, permitting unauthenticated callers in production to trigger `processCustomerQuery` (Workers AI + D1 writes).
5. **Customer Admin List & Segments Hardening (`worker/src/routes/customers-handlers/admin-handlers.ts:20,47,52`)**:
   - `GET /api/customers/segments` excluded `'manager'` role and returned raw `(err as Error).message` on HTTP 500.
   - `GET /api/customers` returns paginated customer PII (`name`, `phone`, `email`, `cashback_balance`, `total_spent`) without authentication in production.
6. **Wall-Clock Time-Dependent Test Flakiness (`worker/src/__tests__/integrations/server-pricing-contract.test.ts`)**:
   - `createPricingMockDB()` seeds an active Happy Hour window on Wednesday (`day_of_week: 3`) from `14:00` to `16:00` (20% off). Non-happy-hour test cases in `server-pricing-contract.test.ts` relied on `new Date()` without pinning system time, causing them to fail whenever the test suite ran on a Wednesday between 14:00 and 16:00 local time. Pinned `vi.setSystemTime(new Date('2026-10-07T10:00:00'))` in `beforeEach` and restored `vi.useRealTimers()` in `afterEach`.

---

## Requirements

### Functional Requirements
1. Mount `calBookingWebhookRouter` via `app.route('/api/webhooks/cal-booking', calBookingWebhookRouter)` and `app.route('/api/cal-booking-webhook', calBookingWebhookRouter)` in `worker/src/routes/features-router.ts`.
2. Protect `GET /bookings` in `worker/src/routes/cal-booking-webhook-handlers/bookings-handler.ts` with `requireAuth(['owner', 'manager', 'staff'])` and sanitize D1 errors.
3. Sanitize HTTP 500 responses in `worker/src/routes/cal-booking-webhook-handlers/webhook-handler.ts` while logging structured error details server-side.
4. Gate `POST /api/webhooks/zalo/simulate` in `worker/src/routes/zalo-webhook.ts` with `requireAuth(['owner', 'manager', 'staff'])` when running in production (`ENVIRONMENT === 'production' || NODE_ENV === 'production'`), and isolate D1/AI errors.
5. In `worker/src/routes/customers-handlers/admin-handlers.ts`, include `'manager'` in `/segments` RBAC, sanitize HTTP 500 error responses, and enforce `owner`/`manager`/`staff` JWT auth on `GET /api/customers` in production (or when `Authorization` header is present).

### Non-Functional Requirements
- Maintain 100% compatibility with existing local unit tests (`tests/customers.test.ts`, `worker/src/__tests__/routes/customers.test.ts`, `worker/src/__tests__/integrations/autonomous-edge-ops.test.ts`, `tests/cal-booking-webhook.test.ts`).
- Respect strict git state preservation (no `git reset`, `git stash`, `git commit`, `git push`, or live deployment).

---

## Related Code Files
- **Modify:**
  - `worker/src/routes/features-router.ts`
  - `worker/src/routes/cal-booking-webhook-handlers/bookings-handler.ts`
  - `worker/src/routes/cal-booking-webhook-handlers/webhook-handler.ts`
  - `worker/src/routes/zalo-webhook.ts`
  - `worker/src/routes/customers-handlers/admin-handlers.ts`
  - `worker/src/__tests__/integrations/autonomous-edge-ops.test.ts`
  - `worker/src/__tests__/routes/customers.test.ts`

---

## Todo List
- [x] Fix `calBookingWebhookRouter` mount in `worker/src/routes/features-router.ts`
- [x] Add `requireAuth(['owner', 'manager', 'staff'])` and error sanitization to `bookings-handler.ts`
- [x] Sanitize HTTP 500 error response in `webhook-handler.ts`
- [x] Gate `POST /api/webhooks/zalo/simulate` with `requireAuth(['owner', 'manager', 'staff'])` in production and add fault isolation in `zalo-webhook.ts`
- [x] Harden `customers-handlers/admin-handlers.ts` (production auth on `GET /`, `manager` role on `/segments`, and 500 error sanitization)
- [x] Add regression tests in `autonomous-edge-ops.test.ts` and `customers.test.ts`
- [x] Run `npm run lint`, `npm run typecheck:all`, `npm run verify:gates`, and `npx vitest run`
