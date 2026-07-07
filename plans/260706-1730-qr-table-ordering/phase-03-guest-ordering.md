# Phase 3: Guest QR Ordering Frontend

## Context

Customer scans QR code → opens `https://app.aura.com/?table=t01-indoor` → places order without login. This phase builds the guest-facing ordering page.

## Requirements

- Guest ordering page: `/[locale]/order?table=t01-indoor` (no auth required)
- Auto-detect table from URL param, show table number in UI
- Full menu browsing: categories, items, search
- Cart management (add/remove/qty)
- Guest checkout: name + phone (no account needed)
- Auto-assign `table_id` from QR slug
- Order confirmation → `/order-success?order_id=xxx`
- Mobile-first, PWA offline-friendly
- Bilingual UI (Vietnamese + English)

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| `src/pages/TableOrder.tsx` | CREATE | Main guest ordering page (query param ?table=) |
| `worker/src/routes/guest-order.ts` | CREATE | Guest order endpoint: `POST /api/guest/order` |
| `worker/src/tree/orders/create-order.ts` | MODIFY | Parameterize by `table_id`, `customer_name`, `customer_phone` |
| `worker/src/index.ts` | MODIFY | Mount `guestOrderRouter` at `/api/guest` |
| `worker/src/types/env.ts` | MODIFY | `guestOrderSchema` exists from Phase 1 — verify |
| `worker/src/__tests__/routes/guest-order.test.ts` | CREATE | TDD: guest order creation |
| `src/hooks/stores/__tests__/use-guest-order-store.test.ts` | CREATE | TDD: guest order state |

## Architecture Notes

- **URL param detection**: `new URLSearchParams(window.location.search).get('table')`
  - If no `table` param → show "invalid QR" error with link to menu
  - If table param present → show "Table X (zone)" header

- **Order flow for guests**:
  1. Resolve slug → table_id via `GET /api/qr/:slug?...` (Phase 1 endpoint) OR embed table_id in slug cache
  2. Add items to cart (same `useOrderStore` as logged-in users)
  3. Checkout: name + phone + payment method (cash/card)
  4. POST to `/api/guest/order` with `{ table_id, customer_name, customer_phone, items, payment_method }`
  5. On success → redirect to `/order-success?order_id=xxx`

- **guest-order endpoint**: `POST /api/guest/order`
  - Input: `guestOrderSchema` (already in validators.ts)
  - Output: same as `orders-hono.ts` `/checkout` — `{ id, status, total }`
  - Notification: reuse `notifyOrderStatus` from tree/orders

- **PWA offline**: Order page should work offline — cache menu + cart in IndexedDB
  - Use existing `useOfflineQueue` pattern
  - Defer to Phase 5 for full offline if needed; this phase: online-only with graceful error

## UX Flow

```
Scan QR → https://app.aura.com/order?table=t01-indoor
         → Auto-fill table "T01 (indoor)"
         → Browse menu, add to cart
         → Enter name + phone
         → Place order → Confirmation →
         → Track order (SSE polling)
```

## Tests

- Valid table param → order succeeds with table_id set
- Invalid/missing table param → 400 error
- Missing name/phone → 400 validation error
- Order success → correct DB insert with table_id
- SSE tracking works for guest orders

## Dependencies

- Phase 1 ✅ (QR endpoint, DB schema, signer)
- Phase 2 (slug resolution via `/api/qr/:slug`)
- Existing: `useOrderStore`, `StitchMobileOrderNew`, orders DB insert logic

## Effort: 5h
