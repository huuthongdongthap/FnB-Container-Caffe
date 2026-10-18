# Phase 04: Frontend Stores, Hooks & Offline Storage Resilience

## Overview
- Priority: High
- Current status: Pending
- Description: Standardize API response envelope unwrapping, implement optimistic rollback on failure, fix offline IndexedDB order preservation and connection leaks, and stabilize offline sync intervals.

## Requirements
- `useRefundStore` must unwrap both enveloped (`body.data`) and raw response objects, and properly URL-encode route parameters.
- `useLoyaltyStore` must persist auth tokens under `aura_auth_token` and update persistent storage on reward redemption.
- `useTVMenu` must safely extract items from nested category structures.
- `useOrderStore` must handle partial SSE updates without clobbering existing order items, and safely flush queued orders.
- `offline-db.ts` must never delete unsynced pending orders in `clearOrders()`, and must close IndexedDB connections cleanly.
- `use-offline-sync.ts` must stabilize timer hooks by avoiding self-invalidating callback dependencies.

## Related Code Files
- `src/lib/offline-db.ts`
- `src/hooks/use-offline-sync.ts`
- `src/hooks/stores/use-refund-store.ts`
- `src/hooks/stores/use-loyalty-store.ts`
- `src/hooks/use-tv-menu.ts`
- `src/hooks/stores/use-order-store.ts`
- `src/hooks/stores/admin/use-admin-orders-store.ts`

## Implementation Steps
1. In `src/lib/offline-db.ts`, filter `clearOrders()` to delete only where `val?.synced === true` and close DB handles.
2. In `src/hooks/use-offline-sync.ts`, refactor `syncAll` dependencies to avoid recreating timers on state change.
3. In `use-refund-store.ts`, unwrap nested API envelopes and encode URL parameters.
4. In `use-loyalty-store.ts`, align token storage key to `aura_auth_token` and persist loyalty state on redemption.
5. In `use-tv-menu.ts`, support nested `categories[].items` resolution.
6. In `use-order-store.ts`, defensively merge partial SSE order events.
7. In `use-admin-orders-store.ts`, preserve active filters across order status transitions.

## Success Criteria
- Offline orders remain intact until successfully synced to server.
- Zero IDB connection leaks in long-running PWA sessions.
- All store mutations handle network errors with proper optimistic rollback.
