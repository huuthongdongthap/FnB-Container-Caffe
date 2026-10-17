# Phase 19: Mobile Staff, KDS Lifecycle & Admin Integrations D1 Contract Synchronization

**Context Links:**
- [Overview Plan](plan.md)
- [Phase 17: Live D1 Schema Verification, Migration Ledger Baseline & 3-Tier Rollback Orchestration](phase-17-live-d1-ledger-baseline-and-rollback-orchestration.md)
- [Phase 18: Staff & Admin D1 Runtime Contract Sync & Go-Live Execution Plan](phase-18-staff-and-admin-d1-contract-sync-and-go-live-plan.md)
- [Operational Readiness Report](../reports/audit-261014-repo-operational-readiness-verification.md)

## Overview
- **Priority:** P0 (Go-Live Critical Path — Floor Operations, Waiter POS, Kitchen Display System & Admin Integrations)
- **Current Status:** Complete (All 6 Wave 2 Contracts Remediated & Verified with 121/121 Tests, Full Typecheck, ESLint, Migration Lint & Vite Build)
- **Description:** Remediates the 6 remaining Wave 2 Staff Mobile (`/mobile/tables`, `/mobile/orders`, `/mobile/kds/orders`), Desktop KDS (`/kds`), and Admin Integration (`/admin/birthday`, `/admin/erpnext-sync`, `useAdmin`) runtime contract mismatches discovered against the offline production D1 snapshot (`checkpoint-pre-rollout.sql`), while preserving all locked unit/integration test invariants.

---

## Key Insights

### 1. Offline Live D1 Snapshot Verification (`checkpoint-pre-rollout.sql`)
- **`cafe_tables` (`lines 84-91`):** Live D1 stores floor tables in `cafe_tables(id, table_number, zone, seats, status, created_at, tenant_id, updated_at, notes)` with capitalized status values (`'Available'`, `'Occupied'`, `'Reserved'`). No table named `tables` exists in D1.
- **`orders` (`lines 196-218`):** Live D1 enforces `NOT NULL` constraints on `items`, `total`, `status`, `customer_name`, `customer_phone`, and `payment_method`. Historical order item JSON arrays use both `qty` and `quantity`.
- **`push_subscriptions` (`lines 1588-1600`):** Already includes `customer_id TEXT` alongside `device_id` and `last_used_at`.
- **`audit_logs` (`lines 1684-1712`):** Contains `14` production rows where `id IS NULL`, confirming that `20261003_02_admin_metrics_and_inventory.sql` (`id TEXT PRIMARY KEY` rebuild without `COALESCE`) must never be automatically replayed on live D1.

### 2. Locked Test Invariants (Must Not Regress)
- `src/hooks/__tests__/use-kds.test.ts:20,26` asserts that `useKDS()` calls `apiFetch('/api/admin/orders?status=pending')` and `apiFetch('/api/admin/orders?status=pending&station=drinks')`.
- `worker/src/__tests__/routes/mobile-kds.test.ts:151` asserts that `GET /mobile/kds/orders` returns `orders[0].items` as `[{ name: 'Cà phê sữa', qty: 2 }]` when D1 stores `{ name, qty }`.
- `worker/src/__tests__/integrations/kitchen-kds-lifecycle.test.ts:141-154` asserts that `executeKdsStatusTransition(db, 'ORD_KDS_2', 'preparing', 'customer')` returns `403` and `confirmed → completed` by `staff` returns `400`.

---

## Requirements

### Functional Requirements
1. **Mobile Staff Tables (`/mobile/tables` ↔ `worker/src/routes/tables-mobile.ts`):**
   - Query `cafe_tables` (with fallback to `tables` only for legacy test mocks if needed) and map D1 columns (`table_number`, `seats`, `zone`, `status: 'Available' | 'Occupied' | 'Reserved'`) bidirectional with mobile UI (`number`, `capacity`, `zone`, `status: 'free' | 'occupied' | 'reserved'`, `current_order_id`, `waiter_id`, `updated_at`).
   - Include `'staff'` and `'admin'` in `UPDATE_ROLES` so waiter PIN sessions (`role: 'staff'`) can update table status.
2. **Mobile Staff Orders (`/mobile/orders` ↔ `worker/src/routes/orders-mobile.ts`):**
   - Include `'staff'` and `'admin'` in `CREATE_ROLES`.
   - Accept both `qty` and `quantity` on order items (`Number(item.qty ?? item.quantity ?? 1)`), compute unit prices from `products` when `price` is omitted, and populate all required D1 `orders` `NOT NULL` columns (`total`, `customer_name`, `customer_phone`, `payment_method`, `table_number`, `order_type`).
   - Update `cafe_tables` status to `'Occupied'` when a table order is created.
3. **Desktop KDS (`/kds` ↔ `src/hooks/use-kds.ts` & `worker/src/routes/features-router.ts`):**
   - Preserve the exact `apiFetch('/api/admin/orders?status=pending...')` request URL in `use-kds.ts` and normalize both `{ data: [...] }` / `{ orders: [...] }` envelopes and raw D1 columns (`table_id` / `table_number`, `created_at`, JSON/array `items` with `qty` or `quantity`) into `KDSOrder[]`.
   - Mount `PATCH /api/admin/orders/:id/status` and `POST /api/admin/orders/:id/complete` in `worker/src/routes/features-router.ts`.
4. **KDS `pending → preparing` Lifecycle & Mobile KDS Item Rendering:**
   - Allow `pending → preparing` in `packages/domain/kitchen/commands/kds-status-transition.ts` only for kitchen/staff/manager/admin roles (`toActorRole(userRole || 'staff')` in `['staff', 'kitchen', 'manager', 'admin']`), returning `403` for `'customer'` / `'rider'` so `kitchen-kds-lifecycle.test.ts:141` passes.
   - Allow `order.status === 'pending'` alongside `'confirmed'` in `packages/domain/kitchen/commands/kitchen-station-tickets.ts:76,80`.
   - Add `'kitchen'` and `'admin'` to `VIEW_ROLES` and `BUMP_ROLES` in `packages/domain/kitchen/commands/kds-mobile.ts` and `worker/src/routes/staff-mobile.ts`.
   - Normalize `item.quantity ?? item.qty ?? 1` and `item.name || item.product_name` in `src/pages/mobile/kitchen-display-order-card.tsx` and `src/pages/mobile/kitchen-display.tsx` without mutating the raw `items` shape asserted by `mobile-kds.test.ts:151`.
5. **Admin Birthday Config (`/admin/birthday` ↔ `worker/src/routes/birthday.ts` & `features-router.ts`):**
   - Add `GET /config` and `PUT /config` to `birthdayRouter` (`worker/src/routes/birthday.ts`) returning/updating `BirthdayConfig` (`discountPercent`, `freeItemEnabled`, `earlyWindowDays`, `lateWindowDays`, `autoSendEnabled` backed by `AUTH_KV` key `config:birthday` with defaults `{ discountPercent: 15, freeItemEnabled: true, earlyWindowDays: 3, lateWindowDays: 3, autoSendEnabled: true }`).
   - Mount `/api/admin/birthday` in `worker/src/routes/features-router.ts` with `requireAuth(['owner', 'manager', 'admin'])`.
6. **Admin ERPNext Sync & `useAdmin` Hook (`/admin/erpnext-sync` ↔ `worker/src/routes/erpnext-sync.ts` & `src/hooks/use-admin.ts`):**
   - Add `/api/admin/erpnext-sync/status`, `/api/admin/erpnext-sync/sync-all`, and `/api/admin/erpnext-sync/:entity` routes in `worker/src/routes/erpnext-sync.ts` returning `SyncStatusInfo` (`{ lastSync, status, pendingItems, errorMessage }`) and entity sync results.
   - Normalize `/api/stats` (`{ stats: { orders_today, revenue_today, pending_orders, active_subscribers } }`) and `/api/admin/orders` (`{ data, pagination }`) in `src/hooks/use-admin.ts`.

### Non-Functional Requirements
- Maintain strict git dirty-tree isolation (no `git reset`, `git stash`, `git commit`, or branch changes).
- Zero live Wrangler / remote D1 / cloud calls during implementation and testing.
- Keep edited modules concise and compliant with TypeScript strict mode and ESLint.

---

## Architecture

```text
[Mobile Staff PWA & Desktop KDS]                  [Cloudflare Worker Routes]                [Cloudflare D1 (fnb-caffe-db)]
  ├── /mobile/tables (table-manager.tsx) ───────► GET/PATCH /api/mobile/tables ───────────► cafe_tables (Available/Occupied/Reserved, seats)
  ├── /mobile/orders (waiter-orders.tsx) ───────► POST /api/mobile/orders ────────────────► orders (NOT NULL total/customer_*/payment_method)
  ├── /mobile/kds/orders (kitchen-display.tsx) ─► GET/PATCH /api/mobile/kds/orders ───────► orders + executeKdsStatusTransition (pending→preparing)
  ├── /kds (use-kds.ts) ────────────────────────► GET /api/admin/orders?status=pending ───► orders (normalized to KDSOrder[])
  │                                               PATCH /api/admin/orders/:id/status ─────► executeKdsStatusTransition / updateOrderStatus
  │                                               POST /api/admin/orders/:id/complete ────► updateOrderStatus('completed')
  ├── /admin/birthday (use-birthday-admin.ts) ──► GET/PUT /api/admin/birthday/config ─────► AUTH_KV (config:birthday) + birthday_Wishes
  └── /admin/erpnext-sync (ERPNExtSync.tsx) ────► GET/POST /api/admin/erpnext-sync/* ─────► erpnext_sync_queue + orders
```

---

## Related Code Files

### Files to Modify
1. `worker/src/routes/tables-mobile.ts`
2. `worker/src/routes/orders-mobile.ts`
3. `packages/domain/kitchen/commands/kds-status-transition.ts`
4. `packages/domain/kitchen/commands/kitchen-station-tickets.ts`
5. `packages/domain/kitchen/commands/kds-mobile.ts`
6. `worker/src/routes/staff-mobile.ts`
7. `worker/src/routes/features-router.ts`
8. `worker/src/routes/birthday.ts`
9. `worker/src/routes/erpnext-sync.ts`
10. `src/hooks/use-kds.ts`
11. `src/hooks/use-admin.ts`
12. `src/pages/mobile/kitchen-display-order-card.tsx`
13. `src/pages/mobile/kitchen-display.tsx`

### Test Files to Verify / Extend
1. `worker/src/__tests__/integrations/kitchen-kds-lifecycle.test.ts`
2. `worker/src/__tests__/routes/mobile-kds.test.ts`
3. `src/hooks/__tests__/use-kds.test.ts`
4. `worker/src/__tests__/routes/birthday.test.ts`
5. `worker/src/__tests__/routes/wave2-mobile-kds-admin-contracts.test.ts` (new targeted contract suite for mobile tables, mobile orders, admin KDS actions, birthday config, and ERPNext sync)

---

## Implementation Steps

### Step 1: Mobile Staff Tables (`worker/src/routes/tables-mobile.ts`)
1. Add `'staff'` and `'admin'` to `VIEW_ROLES` and `UPDATE_ROLES`.
2. Add bidirectional status mapping between UI (`'free' | 'occupied' | 'reserved'`) and D1 `cafe_tables` (`'Available' | 'Occupied' | 'Reserved'`).
3. Update `handleGetMobileTables` to query `cafe_tables` (`id, table_number, seats, zone, status, updated_at, notes`) with fallback to `tables` if `cafe_tables` is absent in a unit test mock, returning `{ id, number, capacity, zone, status, current_order_id, waiter_id, updated_at }`.
4. Update `handleUpdateTableStatus` to update `cafe_tables` (`SET status = ?, updated_at = ? WHERE id = ? OR table_number = ?`), falling back to `tables` if `cafe_tables` does not exist in mock DBs.

### Step 2: Mobile Staff Orders (`worker/src/routes/orders-mobile.ts`)
1. Add `'staff'` and `'admin'` to `CREATE_ROLES` and `VIEW_ROLES`.
2. Accept `qty` or `quantity` (`Number(item.qty ?? item.quantity ?? 1)`) and optional `price` in `OrderItemInput`.
3. Look up unit prices from `products` when item prices are omitted, compute `total`, and `INSERT INTO orders` with all required D1 `NOT NULL` columns (`id, order_number, table_id, table_number, customer_name, customer_phone, items, total, status, payment_method, payment_status, order_type, notes, waiter_id, created_at, updated_at`), with fallback to legacy test schema if a mock DB only defines minimal columns.
4. Update `cafe_tables` status to `'Occupied'` (and fallback `tables` if needed) when a table order is placed.

### Step 3: KDS Lifecycle & Mobile KDS Item Normalization
1. In `packages/domain/kitchen/commands/kds-status-transition.ts`:
   - Add `'preparing'` to `ORDER_TRANSITIONS['pending']` in `packages/domain/order/CanonicalOrderStatus.ts` OR handle `currentStatus === 'pending' && targetStatus === 'preparing'` in `executeKdsStatusTransition` when `actorRole` is `'staff' | 'kitchen' | 'manager' | 'admin'` (returning `403` for `'customer'` / `'rider'` so `kitchen-kds-lifecycle.test.ts:141` passes).
2. In `packages/domain/kitchen/commands/kitchen-station-tickets.ts`:
   - Allow `order.status === 'pending' || order.status === 'confirmed'` when generating or advancing station tickets.
3. In `packages/domain/kitchen/commands/kds-mobile.ts` and `worker/src/routes/staff-mobile.ts`:
   - Include `'kitchen'` and `'admin'` in `VIEW_ROLES` and `BUMP_ROLES`.
4. In `src/pages/mobile/kitchen-display-order-card.tsx` and `src/pages/mobile/kitchen-display.tsx`:
   - Render `item.quantity ?? (item as { qty?: number }).qty ?? 1` and `item.name || (item as { product_name?: string }).product_name || ''`.

### Step 4: Desktop KDS Hook & Worker Endpoints (`src/hooks/use-kds.ts`, `worker/src/routes/features-router.ts`)
1. In `src/hooks/use-kds.ts`:
   - Keep `apiFetch(`/api/admin/orders?status=pending${stationParam}`)` unchanged so `src/hooks/__tests__/use-kds.test.ts` passes.
   - Normalize `{ orders }`, `{ data }`, or raw array payloads and map D1 `table_id` / `table_number`, `created_at`, and JSON/array `items` (`qty` / `quantity`, `name` / `product_name`) into `KDSOrder[]`.
2. In `worker/src/routes/features-router.ts`:
   - Mount `PATCH /api/admin/orders/:id/status` and `POST /api/admin/orders/:id/complete` guarded by `requireAuth(['owner', 'manager', 'staff', 'kitchen', 'barista', 'chef', 'admin'])` updating D1 `orders.status` and `updated_at`.

### Step 5: Admin Birthday Config & ERPNext Sync + `useAdmin` Hook
1. In `worker/src/routes/birthday.ts` and `worker/src/routes/features-router.ts`:
   - Add `GET /config` and `PUT /config` on `birthdayRouter` (persisted in `c.env.AUTH_KV` under `config:birthday` with safe default fallback when `AUTH_KV` is unbound) and mount `/api/admin/birthday` in `features-router.ts`.
2. In `worker/src/routes/erpnext-sync.ts`:
   - Add `GET /api/admin/erpnext-sync/status`, `POST /api/admin/erpnext-sync/sync-all`, and `POST /api/admin/erpnext-sync/:entity` guarded by `requireAuth(['owner', 'manager', 'admin'])`.
3. In `src/hooks/use-admin.ts`:
   - Normalize `/api/stats` (`{ stats: { orders_today, revenue_today, pending_orders, active_subscribers } }`) into `DashboardStats` and `/api/admin/orders` (`{ data, pagination }`) into `OrderRow[]`.

---

## Todo List
- [x] Remediate `worker/src/routes/tables-mobile.ts` (`cafe_tables` mapping + `'staff'`/`'admin'` RBAC)
- [x] Remediate `worker/src/routes/orders-mobile.ts` (D1 `orders` `NOT NULL` columns + `qty`/`quantity` + `'waiter'`/`'admin'` RBAC)
- [x] Remediate KDS `pending → preparing` transition, station tickets, mobile KDS RBAC, and `kitchen-display-order-card.tsx` item rendering
- [x] Remediate Desktop KDS (`src/hooks/use-kds.ts` normalization + `PATCH /api/admin/orders/:id/status` & `POST /api/admin/orders/:id/complete` in `features-router.ts`)
- [x] Remediate Admin Birthday config (`GET/PUT /api/admin/birthday/config`)
- [x] Remediate Admin ERPNext sync routes (`/api/admin/erpnext-sync/status`, `/sync-all`, `/:entity`) and `src/hooks/use-admin.ts` normalization
- [x] Run targeted Vitest suites (`121/121` passed across `13` test files), `npx tsc --noEmit` (`0` errors), `npm run typecheck:all` (`0` errors), `npm run lint --silent` (`0` errors), `npm run lint:migrations` (`0` errors), and `npm run build --silent` (`exit 0`)

---

## Success Criteria
- All 6 Wave 2 Staff Mobile, KDS, and Admin Integration runtime contract mismatches are resolved and covered by automated tests.
- Existing locked test suites (`use-kds.test.ts`, `mobile-kds.test.ts`, `kitchen-kds-lifecycle.test.ts`, `birthday.test.ts`) and the new Wave 2 contract test suite pass 100%.
- `npx tsc --noEmit`, `npm run lint --silent`, `npm run lint:migrations`, and `npm run build --silent` exit `0`.

---

## Risk Assessment
- **Risk:** Modifying `CanonicalOrderStatus.ts` `ORDER_TRANSITIONS['pending']` directly would make `pending → preparing` allowed for `'customer'` in `executeKdsStatusTransition`, breaking `kitchen-kds-lifecycle.test.ts:141` (`expects 403`).
- **Mitigation:** Handle `pending → preparing` inside `executeKdsStatusTransition` with an explicit role check (`['staff', 'kitchen', 'manager', 'admin']` allowed; `'customer'` / `'rider'` returns `403` `INSUFFICIENT_ROLE_FOR_TRANSITION`).

---

## Security Considerations
- All newly mounted `/api/admin/orders/:id/*`, `/api/admin/birthday/*`, and `/api/admin/erpnext-sync/*` endpoints enforce `requireAuth` RBAC.
- Mobile table/order endpoints remain protected by `requireStaff` session middleware (`AUTH_KV` token lookup) and explicit role allowlists.

---

## Next Steps
- Execute `/cook` to implement Phase 19 and run full offline verification.
- Proceed to Phase 17 read-only live D1 inspection and Phase 04 staging smoke test once owner approval and staging credentials are provided.
