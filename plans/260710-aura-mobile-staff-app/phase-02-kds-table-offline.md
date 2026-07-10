# Phase 2: KDS + Table Management + Offline Sync

**Duration:** 4h | **Agents:** 3 parallel

## Context

KDS page exists at `/kds` (desktop, admin-only). Table management exists at `/admin/table-management`. Staff need mobile versions with offline support.

## Requirements

1. **Mobile KDS routes** (`kds-mobile.ts`):
   - `GET /mobile/kds` — orders ready for kitchen (elapsed timer, priority sort)
   - `PATCH /mobile/kds/:id/status` — status transitions: pending → preparing → served
   - `GET /mobile/kds/stats` — counts per status

2. **Mobile Table routes** (`tables-mobile.ts`):
   - `GET /mobile/tables` — all tables with status + active order info
   - `PATCH /mobile/tables/:id/status` — available → occupied → paid → available
   - `POST /mobile/tables/:id/merge` — merge table for group guests (optional)

3. **Mobile Orders routes** (`orders-mobile.ts`):
   - `GET /mobile/orders/today` — today's orders (waiter view)
   - `POST /mobile/orders` — create order (inline, no customer auth)
   - `PATCH /mobile/orders/:id/status` — any staff status update

4. **Offline sync**: extend existing `offline-db.ts` to queue mutations:
   - Queue status updates when offline
   - Replay queue on reconnect (dedup by `order_id + timestamp`)
   - Conflict: last-write-wins with server timestamp check

## Key Rules

- Role enforcement: `staff` can only see/update KDS; `waiter` can only see/update tables + orders
- `owner` + `manager` see all
- Never expose customer PII (phone, email) to staff that don't need it
- Status transitions validated: illegal jumps (e.g., served → pending) return 422

## Files

- `worker/src/routes/kds-mobile.ts` (new)
- `worker/src/routes/tables-mobile.ts` (new)
- `worker/src/routes/orders-mobile.ts` (new)
- `src/lib/offline-db.ts` (extend: add OrderSyncQueue, TableSyncQueue classes)
- `worker/src/lib/validators.ts` (add status transition enum)

## Risk

- `ordersRouter` exists twice in index.ts (legacy + hono). Staff routes use hono at `/mobile` → no collision.
- Table status must be atomic with order creation (QR guest checkin already uses D1 batch — reuse pattern).
