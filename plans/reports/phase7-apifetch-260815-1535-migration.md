---
phase: 7
title: fetch → apiFetch migration
status: done
ts_errors_introduced: 0
tests_updated: 10
tests_passing: 74/74
---

## Summary

Migrated all store files from raw `fetch()` calls to centralized `apiFetch()` from `src/lib/api-client.ts`. Auth header injection (`Bearer ${token}`) is now handled by `apiFetch` instead of duplicated in every store.

## Changes

### apiFetch call sites added/changed (13 files, 21 calls)

**Public stores (5 files, 8 calls):**
- `use-checkin-store.ts` — `submitCheckin()` x1
- `use-contact-store.ts` — `submitContact()` x1
- `use-reservation-store.ts` — `fetchSlots()` x1, `createReservation()` x1
- `use-menu-store.ts` — `fetchMenu()` x1, `fetchDailySpecials()` x1
- `use-order-store.ts` — `createOrder()` x1, `fetchOrder()` x1, `flushQueuedOrders()` x1

**Admin stores (8 files, 13 calls):**
- `use-admin-dashboard-store.ts` — `fetchDashboard()` x1
- `use-admin-customers-store.ts` — `fetchCustomers()` x1
- `use-admin-orders-store.ts` — `fetchOrders()` x1, `updateOrderStatus()` x1
- `use-admin-reservations-store.ts` — `fetchReservations()` x1, `approveReservation()` x1, `rejectReservation()` x1
- `use-admin-staff-store.ts` — `fetchStaff()` x1, `registerStaff()` x1
- `use-admin-inventory-store.ts` — `fetchInventory()` x1, `updateStock()` x1
- `use-admin-promotions-store.ts` — `fetchPromotions()` x1, `savePromotion()` x1
- `use-metrics-store.ts` — `fetchMetrics()` x1

### Test files updated (10 files)
All store test files updated to mock `@/lib/api-client` instead of `vi.stubGlobal('fetch', ...)`. Removed "no token" tests (auth is now handled by apiFetch internally). All 74 store tests passing.

### Import cleanup
- Removed `API_BASE` and `import.meta.env.VITE_API_BASE_URL` from all store files
- `use-order-store.ts` still uses `API_BASE` for SSE `EventSource` (not migrated — SSE doesn't use apiFetch)

### Key decisions
- `useOrderStore.fetchOrder()` now catches all errors uniformly instead of special-casing 404
- `useMenuStore.fetchMenu()` now throws on failure instead of returning `{ menu: [], categories: [] }` — callers already handle the error state
- Removed `API_BASE` constant from public stores (only admin store `use-admin-inventory-store.ts` kept it for one legacy `fetch` call that needs raw body parsing)
