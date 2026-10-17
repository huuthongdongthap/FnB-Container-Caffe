# Phase 04: Admin M3 Dark Cards/Modals, Customer/Order/Cart Contracts & Rollback Gate

## Context Links
- Overview Plan: `plans/20261017-mobile-admin-i18n-contrast-wave2/plan.md`
- Gate Verifier: `scripts/verify-staging-gates.mjs`, `scripts/lint-d1-migrations.mjs`, `scripts/deploy-rollback.sh`

## Overview
- **Priority**: P0/P1 (Admin Operations & Release Gate Readiness)
- **Current Status**: Pending
- **Description**: Replace hardcoded `bg-white` / `bg-gray-100/200` light surfaces across Admin modals, tables, and KDS ticket components with M3 dark surface tokens; fix Admin Customers tier filter (`bronze|silver|gold|platinum`) and mount `POST/PATCH/DELETE /api/admin/customers`; preserve order line items in `use-admin-orders-store.ts`; fix `Cart.tsx` stale `itemId` bug; and align `deploy-rollback.sh` project/DB defaults.

## Key Insights
1. 15 Admin/KDS files (`Customers.tsx`, `CustomerModal.tsx`, `product-modal.tsx`, `Devices-register-modal.tsx`, `range-selector.tsx`, `ChatInbox*.tsx`, `GenerateQR-qr-card.tsx`, `TableManagement*.tsx`, `BroadcastPage*.tsx`, `CheckinApprove*.tsx`, `OrderTicket.tsx`, `TicketQueue.tsx`) use `bg-white` with `text-foreground` (`#F5F5F5`), producing white-on-white unreadable text.
2. `Customers.tsx:31` and `CustomerModal.tsx:134` use `'REGULAR' | 'LOYAL' | 'VIP' | 'PLATINUM'` whereas D1 `customers.loyalty_tier` uses `'bronze' | 'silver' | 'gold' | 'platinum'`, and `features-router.ts:116` only mounts `GET /api/admin/customers` (missing `POST`, `PATCH /:id`, `DELETE /:id`).
3. `use-admin-orders-store.ts:30-55` overwrites `items` array with scalar `itemsCount`, causing `Orders.tsx:63` to display `"N items"` instead of actual product names/quantities, and calls `PATCH /api/orders/:id` instead of `PATCH /api/admin/orders/:id/status`.
4. `Cart.tsx:48-68` and `cart-active-view.tsx:37-38` call `onItemIdChange(item.id); onPatch('update')` synchronously, reading stale `itemId` state.

## Requirements
- **Functional**:
  - Replace all `bg-white` / `bg-gray-100/200` / light-mode alerts across Admin and KDS components with M3 dark tokens (`bg-surface`, `bg-[var(--aura-bg-card)]`, `bg-[var(--aura-bg-input)]`, `text-foreground`, `border-border`).
  - Align `Customers.tsx`, `CustomerModal.tsx`, `CustomerTable.tsx`, and `worker/src/routes/admin-handlers.ts` to support `bronze | silver | gold | platinum` (case-insensitive) and mount `POST /api/admin/customers`, `PATCH /api/admin/customers/:id`, and `DELETE /api/admin/customers/:id` in `worker/src/routes/features-router.ts`.
  - Preserve `itemsList` in `use-admin-orders-store.ts` (`AdminOrder.itemsList`) so `Orders.tsx` renders real order line items, and use `PATCH /api/admin/orders/${orderId}/status` with fallback.
  - Pass `overrideItemId?: string` to `handlePatchCart(action, overrideItemId)` in `Cart.tsx` / `cart-active-view.tsx`.
  - Wire `handleToggleActive` in `staff-list-tab.tsx` to update staff active state via `useAdminStaffStore`.
  - Update `scripts/deploy-rollback.sh` default project name to `fnb-caffe-container` and D1 DB name to `fnb-caffe-db`.

## Related Code Files
- `src/pages/admin/Customers.tsx`
- `src/components/admin/CustomerModal.tsx`
- `src/components/admin/CustomerTable.tsx`
- `src/pages/admin/product-modal.tsx`
- `src/pages/admin/Devices-register-modal.tsx`
- `src/components/admin/range-selector.tsx`
- `src/pages/admin/ChatInbox.tsx`
- `src/pages/admin/ChatInbox-detail-view.tsx`
- `src/pages/admin/GenerateQR-qr-card.tsx`
- `src/pages/admin/TableManagement.tsx`
- `src/pages/admin/TableManagement-card.tsx`
- `src/pages/admin/BroadcastPage-form.tsx`
- `src/pages/admin/BroadcastPage-confirm-modal.tsx`
- `src/pages/admin/BroadcastPage-result-view.tsx`
- `src/pages/admin/subscription-add-form.tsx`
- `src/pages/admin/CampaignsManager-edit-modal.tsx`
- `src/pages/admin/CheckinApprove-history-list.tsx`
- `src/pages/admin/CheckinApprove-detail-panel.tsx`
- `src/components/admin/checkin-row.tsx`
- `src/pages/admin/sync-entity-card.tsx`
- `src/pages/admin/staff-list-tab.tsx`
- `src/pages/admin/Cart.tsx`
- `src/pages/admin/cart-active-view.tsx`
- `src/pages/admin/Orders.tsx`
- `src/components/kds/OrderTicket.tsx`
- `src/components/kds/TicketQueue.tsx`
- `src/components/kds/OrderCompleteButton.tsx`
- `src/hooks/stores/admin/use-admin-orders-store.ts`
- `src/hooks/stores/admin/use-admin-customers-store.ts`
- `worker/src/routes/admin-handlers.ts`
- `worker/src/routes/features-router.ts`
- `scripts/deploy-rollback.sh`

## Implementation Steps
1. Convert `bg-white` and `bg-gray-100/200` surfaces in all listed Admin and KDS components to M3 dark surface tokens (`bg-surface`, `bg-surface/80`, `border-border`, `text-foreground`).
2. Align tier values in `Customers.tsx`, `CustomerModal.tsx`, and `CustomerTable.tsx` with `bronze | silver | gold | platinum`; add `tier` query filter + `createAdminCustomer`, `updateAdminCustomer`, `deleteAdminCustomer` in `worker/src/routes/admin-handlers.ts` and mount them in `worker/src/routes/features-router.ts`.
3. Update `use-admin-orders-store.ts` to retain parsed `itemsList` array alongside `items` count and use `/api/admin/orders/${orderId}/status` in `updateOrderStatus`; update `Orders.tsx` (`mapAdminOrder`) to render `ao.itemsList` when available.
4. Fix `Cart.tsx` and `cart-active-view.tsx` so `onPatch('update' | 'remove', item.id)` passes `item.id` directly without relying on stale state.
5. Update `scripts/deploy-rollback.sh` default project (`fnb-caffe-container`) and database (`fnb-caffe-db`).

## Todo List
- [ ] Replace `bg-white` / light-mode classes across all 15 Admin & KDS components
- [ ] Align Admin Customers tier filter & mount `POST/PATCH/DELETE /api/admin/customers`
- [ ] Preserve `itemsList` in `use-admin-orders-store.ts` and render real items in `Orders.tsx`
- [ ] Fix `Cart.tsx` stale `itemId` on update/remove and wire `staff-list-tab.tsx` active toggle
- [ ] Update `scripts/deploy-rollback.sh` project/DB defaults

## Success Criteria
- Zero white-on-white (`bg-white` + `text-foreground`) elements across `src/pages/admin/`, `src/components/admin/`, and `src/components/kds/`.
- Admin Customer CRUD (`POST/PATCH/DELETE /api/admin/customers`) and tier filtering work end-to-end against D1.
- Admin Orders view displays real ordered product names and quantities.
