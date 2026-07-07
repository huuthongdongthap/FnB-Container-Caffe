# QR Table Ordering — End-to-End

**Status:** complete
**Date:** 2026-07-08
**Workflow:** cook (next --auto --deep --parallel)

## Core Problem

| What | Path | Issue |
|------|------|-------|
| Router mount | `worker/src/index.ts:145-148` | `ordersRouter` (has `/checkout`) only at `/api/kds/orders`. Frontend POSTs to `/api/orders` → 404 |
| D1 schema | No migration | `orders` table lacks `table_id`, `customer_id`, `order_source`, `payment_url` |
| Frontend | `use-order-store.ts:91` | POSTs to `/api/orders` (correct target, but mounted wrong) |

## Phases

### P1: D1 Migration
**File:** `worker/db/migrations/20260708_01_orders_table_extensions.sql`
Columns: `table_id`, `customer_id`, `order_source DEFAULT 'app'`, `payment_url`, `paid_at`.

### P2: Router Mount
**File:** `worker/src/index.ts` (line ~145)
Add: `app.route('/api/orders', ordersHonoRouter)` (existing mount at `/api/kds/orders` stays).

### P3: Enrich /checkout Response
**File:** `worker/src/routes/orders-hono.ts`
After INSERT + inventory + ERPNext, optionally create MoMo payment record and return `payment_url`.

### P4: Frontend Payment Redirect
**File:** `src/hooks/stores/use-order-store.ts`
Handle `payment_url` from response — redirect to MoMo link. Return to `/order-success`.

### P5: Tests
- `worker/src/__tests__/routes/orders-qr.test.ts`
- Update `use-order-store.test.ts`

## Acceptance
- [ ] POST /api/orders works → order created + payment_url returned
- [ ] /guest-checkin atomic batch works
- [ ] D1 columns exist + tests pass (zero regressions)
