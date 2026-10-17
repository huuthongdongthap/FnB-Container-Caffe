# Phase 03: Admin Inventory, Staff, Tables, QR, Reservations, CRM & Subscriptions Contracts

## Context Links
- Brainstorm Report: `plans/20261017-wave4-fullstack-contracts-sql-security-ui/reports/brainstorm-20261017-wave4-deep-audit.md`
- Overview Plan: `plans/20261017-wave4-fullstack-contracts-sql-security-ui/plan.md`

## Overview
- **Priority**: P0
- **Status**: Completed
- **Description**: Align Admin frontend modules (`Inventory*`, `Staff*`, `Recruitment*`, `TableManagement`, `GenerateQR*`, `Reservations`, `Customers`, `CheckinApprove`, `SubscriptionsManager`, `Orders`) with Worker API contracts, fix dark-on-dark contrast in owned admin files, and eliminate silent error swallowing / fake client IDs.

## Key Insights
- `Inventory.tsx` and `Inventory-movement-modal.tsx` send `movementType: 'adjust'`, whereas the backend validator requires `'adjustment'`.
- `TableManagement.tsx` iterates `for (const o of res.data)` on `GET /api/orders?limit=20`, which returns `data: { orders: [...], meta: {...} }`, throwing `TypeError: rows is not iterable`.
- `use-admin-recruitment-store.ts` and `use-admin-customers-store.ts` discard server-generated IDs in favor of client-generated `APP_${Date.now()}` and `c_${Date.now()}`, breaking subsequent PATCH/PUT/DELETE calls.
- `SubscriptionsManager.tsx` sets `deletePlanId` on click but never triggers `deleteMutation.mutate(id)`.

## Requirements
- Update `Inventory.tsx` and `Inventory-movement-modal.tsx` to use `'adjustment'` (and replace `text-black` with `text-[var(--md-sys-color-on-primary)]`), and support both `{ id, sku, name, recommended_reorder_qty }` and `{ item_id, item_sku, item_name, suggested_reorder_qty }` in `Inventory-forecast-tab.tsx`.
- Update `use-admin-recruitment-store.ts` to omit `status=all` / `position=all` query params and use the `id` returned by `POST /api/recruitment/apply`.
- Update `staff-list-tab.tsx` and `use-admin-staff-store.ts` to use a `<select>` with valid staff roles (`'staff' | 'cashier' | 'kitchen' | 'manager' | 'admin'`), enforce `password.length >= 8`, keep the modal open on error without wiping the staff list, and remove the non-existent `/api/auth/staff/${id}` fallback.
- Fix `TableManagement.tsx` to extract `Array.isArray(res.data) ? res.data : (res.data?.orders ?? [])`.
- Fix `GenerateQR-hooks.ts` and `GenerateQR-qr-card.tsx` to fetch QR SVG/PNG with auth headers (or use `API_BASE` / inline SVG) so QR previews render without `401`.
- Update `use-admin-customers-store.ts` and `Customers.tsx` to use `res.customer?.id ?? res.data?.id`, propagate API errors (`return false` on error unless in offline test fallback with no backend), and preserve pagination state.
- Wire `SubscriptionsManager.tsx` delete plan action to confirm and call `plansHook.deleteMutation.mutate(id)`.
- Fix `Orders.tsx`, `StitchOrderMgmtNew-order-card.tsx`, and `stitch-order-mgmt-default.tsx` so `'Serve'` maps to `'served'`/`'delivered'` and the `Details` button does not mutate order status when clicked on a `'served'` order.
- Replace `-600` dark-on-dark classes in `Reservations.tsx`, `staff-list-tab.tsx`, `invoice-history-table.tsx`, and `subscription-table.tsx`.

## Architecture
- Admin Zustand stores must preserve server-assigned entity IDs and return accurate boolean/error results to callers.

## Related Code Files
- Modify:
  - `src/pages/admin/Inventory.tsx`
  - `src/pages/admin/Inventory-movement-modal.tsx`
  - `src/pages/admin/Inventory-forecast-tab.tsx`
  - `src/pages/admin/staff-recruitment-tab.tsx`
  - `src/pages/admin/staff-list-tab.tsx`
  - `src/pages/admin/TableManagement.tsx`
  - `src/pages/admin/GenerateQR-hooks.ts`
  - `src/pages/admin/GenerateQR-qr-card.tsx`
  - `src/pages/admin/Reservations.tsx`
  - `src/pages/admin/Customers.tsx`
  - `src/pages/admin/CheckinApprove-hooks.ts`
  - `src/pages/admin/SubscriptionsManager.tsx`
  - `src/pages/admin/use-subscription-plans.ts`
  - `src/pages/admin/invoice-history-table.tsx`
  - `src/pages/admin/subscription-table.tsx`
  - `src/pages/admin/Orders.tsx`
  - `src/hooks/stores/admin/use-admin-recruitment-store.ts`
  - `src/hooks/stores/admin/use-admin-staff-store.ts`
  - `src/hooks/stores/admin/use-admin-customers-store.ts`
  - `src/components/stitch/StitchOrderMgmtNew-order-card.tsx`
  - `src/components/stitch/stitch-order-mgmt-default.tsx`

## Implementation Steps
1. Fix `Inventory.tsx`, `Inventory-movement-modal.tsx`, and `Inventory-forecast-tab.tsx`.
2. Fix `use-admin-recruitment-store.ts`, `staff-recruitment-tab.tsx`, `use-admin-staff-store.ts`, and `staff-list-tab.tsx`.
3. Fix `TableManagement.tsx`, `GenerateQR-hooks.ts`, `GenerateQR-qr-card.tsx`, and `Reservations.tsx`.
4. Fix `use-admin-customers-store.ts`, `Customers.tsx`, `CheckinApprove-hooks.ts`, `SubscriptionsManager.tsx`, `invoice-history-table.tsx`, `subscription-table.tsx`, `Orders.tsx`, `StitchOrderMgmtNew-order-card.tsx`, and `stitch-order-mgmt-default.tsx`.

## Todo List
- [x] Align `Inventory` movement type `'adjustment'` and forecast fields
- [x] Fix `Recruitment` `'all'` filter and server `id` assignment
- [x] Fix `StaffListTab` role select, password validation, and `toggleStaffActive`
- [x] Unwrap `res.data.orders` in `TableManagement.tsx`
- [x] Fix `GenerateQR` preview and `SubscriptionsManager` plan deletion
- [x] Fix `useAdminCustomersStore` server `id` and `Orders.tsx` `'Serve'` mapping

## Success Criteria
- All Admin Inventory, Staff, Recruitment, TableManagement, QR, Customers, Subscriptions, and Orders unit tests pass with 0 TypeScript/ESLint errors.

## Risk Assessment
- Ensure `use-admin-customers-store` and `use-admin-recruitment-store` existing unit tests continue to pass when mocking API responses.

## Security Considerations
- Authenticated QR and invoice fetches prevent leaking tokens in public URLs.

## Next Steps
- Coordinates with Phase 04 backend D1/OpenAPI fixes.
