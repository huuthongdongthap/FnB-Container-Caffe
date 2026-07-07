# Phase 3: Guest Ordering Frontend

**Date:** 2026-07-08 (completed during earlier sessions)
**Status:** complete

## Overview

Guest ordering frontend for QR Table Ordering. Guest scans QR code → lands on `/order?table=<id>` → enters name/phone → browses menu → adds to cart → submits order → redirected to `/order-success`.

## Files

| File | Status | Description |
|------|--------|-------------|
| `src/pages/[locale]/order.tsx` | existed | Locale-prefixed entry point (`/[locale]/order` → `<TableOrder />`) |
| `src/pages/TableOrder.tsx` | implemented | Main guest ordering component |
| `src/App.tsx` | modified | Routes `/order` and `/[locale]/order` → `<TableOrder />` |
| `src/hooks/stores/use-order-store.ts` | existed | `createOrder` POSTs to `/api/orders`; handles offline queue |
| `src/components/stitch/StitchMobileOrderNew.tsx` | existed | Menu display + cart drawer + `onViewCart` callback |
| `worker/db/migrations/20260708_01_orders_table_extensions.sql` | Phase 1 | Added `table_id`, `customer_id`, `order_source`, `payment_url`, `paid_at` |
| `worker/src/routes/orders-hono.ts` | Phase 2+ | `POST /checkout` + `POST /guest-checkin` + `GET /` endpoints |
| `worker/src/index.ts` | Phase 2 | `app.route('/api/orders', ordersHonoRouter)` mount |
| `worker/__tests__/routes/orders-hono.test.ts` | created | 5 test cases, all pass |
| `src/hooks/stores/__tests__/use-order-store.test.ts` | existed | Store tests, all pass |

## Flow

1. **Route:** `/order?table=t01-indoor` or `/vi/order?table=t01-indoor`
2. **Validation:** `TABLE_SLUG_RE = /^[a-zA-Z0-9_-]+$/` — invalid/missing → error page
3. **Guest info:** Name + phone input (fixed header bar)
4. **Menu browsing:** `<StitchMobileOrderNew tableId={tableId} onViewCart={handleViewCart} />`
5. **Checkout (onViewCart):**
   - Step 1: `POST /api/orders/guest-checkin` → reserve table (404→invalid, 409→occupied)
   - Step 2: `createOrder(payload)` via store → `POST /api/orders` (uses `/api/orders`—second mount point)
   - Step 3: `flushQueuedOrders()` → redirect to `/order-success?order_id=<id>`

## Payload Shape

**guest-checkin:**
```json
{ "customer_name": "Nguyen Van A", "customer_phone": "0912345678", "table_id": "t01-indoor" }
```

**createOrder:**
```json
{
  "items": [{ "id": "1", "name": "...", "price": 35000, "quantity": 2 }],
  "total": 70000,
  "customer_name": "Nguyen Van A",
  "customer_phone": "0912345678",
  "payment_method": "cod",
  "table_id": "t01-indoor"
}
```

## Contracts

- **Backend:** `createOrderInputSchema` accepts `items[{product_id, quantity, price}, ...]`, `customer_name`, `customer_phone`, `payment_method`, `table_id` (optional)
- **Frontend:** `OrderItem = { id, name, price, quantity }` (mapped to `product_id` in payload)
- **Offline:** `navigator.onLine` check in `createOrder` → queues to IndexedDB via `offlineDb.saveOrder` → auto-flush on reconnect

## Acceptance Criteria

- [x] Guest scans QR → lands on `/order?table=t01-indoor` → full ordering flow works
- [x] Invalid/missing table param → graceful "invalid QR" error page
- [x] 404 on non-existent table → "Mã QR này không hợp lệ" error
- [x] 409 on occupied table → "Bàn này đang được sử dụng" error
- [x] Online ordering → order created + redirect to `/order-success`
- [x] Offline → queued to IndexedDB with indicator
- [x] All existing tests pass (430/430)
- [x] No breaking changes to existing API contracts

## Notes

- `items[].product_id` field required by backend `createOrderInputSchema`. Frontend sends `product_id` (mapped from `item.id` at line 201). Resolved 2026-07-08.
- Phone normalization strips non-digits; backend also accepts min 8 digits.
- Table namespace: client-side `TABLE_SLUG_RE` allows alphanumeric/underscore/dash; backend `guestCheckinSchema` requires non-empty string.
