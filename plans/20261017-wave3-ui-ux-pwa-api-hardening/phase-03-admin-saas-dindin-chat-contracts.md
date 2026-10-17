# Phase 03: Admin Staff/Orders/DinDin/Chat/CSV/QR & SaaS Dashboard Contracts

## Context Links
- [Plan Overview](plan.md)

## Overview
- **Priority**: P1 (Admin Operations & B2B SaaS Flows)
- **Status**: Pending
- **Description**: Align Admin stores and hooks (`use-admin-staff-store`, `Orders.tsx`, `ChatInbox-detail-view.tsx`, `DinDinMenu-hooks.ts`, `use-dindin-cart.ts`, `SalesReports.tsx`, `use-sales-report-data.ts`, `use-analytics-data.ts`, `GenerateQR-*`) and SaaS Dashboard (`use-subscriptions.ts`, `saas/dashboard/*`, `PricingCard.tsx`) with Worker API contracts and M3 Dark theme tokens.

## Key Insights
- `use-admin-staff-store.ts` calls `PATCH /api/auth/staff/:id` instead of `PATCH /api/staff/:id` (`{ isActive }`).
- `ChatInbox-detail-view.tsx` posts admin replies without `direction: 'admin'`, overwriting customer name to `'Admin'`.
- `Orders.tsx` sends `status=served` to `GET /api/admin/orders`, whereas backend stores `'delivered'`.
- `use-sales-report-data.ts` calls `/api/reports/export?type=sales` without auth headers (backend expects `type=orders|revenue|customers`), and `use-analytics-data.ts` parses `text/csv` as JSON via `apiFetch`.
- `saas/dashboard/*` has P0 dark-on-dark contrast (`text-gray-600`, unstyled `<textarea>`) and calls `/api/subscriptions/invoices` (shadowed by `:id`) instead of `/api/subscriptions/invoices/list`.

## Related Code Files
- `src/hooks/stores/admin/use-admin-staff-store.ts`
- `src/pages/admin/Orders.tsx`
- `src/components/stitch/StitchOrderMgmtNew-order-card.tsx`
- `src/pages/admin/ChatInbox-detail-view.tsx`
- `src/pages/admin/DinDinMenu-hooks.ts`
- `src/pages/admin/use-dindin-cart.ts`
- `src/pages/admin/SalesReports.tsx`
- `src/pages/admin/use-sales-report-data.ts`
- `src/hooks/use-analytics-data.ts`
- `src/pages/admin/GenerateQR-utils.ts`
- `src/pages/admin/GenerateQR-hooks.ts`
- `src/hooks/use-subscriptions.ts`
- `src/pages/saas/dashboard/index.tsx`
- `src/pages/saas/dashboard/cancel-dialog.tsx`
- `src/pages/saas/dashboard/invoice-table-card.tsx`
- `src/pages/saas/dashboard/subscription-summary-card.tsx`
- `src/pages/saas/dashboard/receipt-download.tsx`
- `src/pages/saas/dashboard/dashboard-utils.tsx`
- `src/components/saas/PricingCard.tsx`

## Implementation Steps
1. **Staff Store (`use-admin-staff-store.ts`)**: Update `toggleStaffActive` to call `PATCH /api/staff/${encodeURIComponent(id)}` with `{ isActive: nextActive, is_active: nextActive ? 1 : 0 }`.
2. **Admin Orders (`Orders.tsx` & `StitchOrderMgmtNew-order-card.tsx`)**:
   - Map `activeFilter === 'served'` to backend query `status: 'delivered'`.
   - Ignore `'details'` action in `handleOrderAction` so clicking `"Details"` does not mutate order status.
3. **Admin Chat (`ChatInbox-detail-view.tsx`)**: Pass `direction: 'admin'` in `POST /api/chat/messages` payload.
4. **Admin DinDin (`DinDinMenu-hooks.ts` & `use-dindin-cart.ts`)**:
   - Unwrap `data?.data?.menu?.sections || data?.menu?.sections || data?.sections` in `DinDinMenu-hooks.ts` and send `{ menu: { sections } }` in `saveConfig`.
   - Support adding new items when `editingItem` has an empty `id` or via `addItem`.
   - Unwrap `res?.data ?? res` in `use-dindin-cart.ts` and send `{ action: op, item: { id: targetItemId, quantity: Number(qty) } }` alongside `{ sessionId, op, itemId: targetItemId, qty }`.
5. **Sales & Analytics CSV Exports (`SalesReports.tsx`, `use-sales-report-data.ts`, `use-analytics-data.ts`)**:
   - Call `fetchOrders()` on mount in `SalesReports.tsx`.
   - Include `getAuthHeaders()` and `type=revenue` in `use-sales-report-data.ts`.
   - Fetch raw text with `getAuthHeaders()` in `downloadAnalyticsCsv` (`use-analytics-data.ts`) instead of `apiFetch` JSON parsing.
6. **Admin QR (`GenerateQR-utils.ts`)**: Include `getAuthHeaders()` when downloading QR PNG.
7. **SaaS Dashboard & Pricing (`use-subscriptions.ts`, `saas/dashboard/*`, `PricingCard.tsx`)**:
   - Convert `saas/dashboard/*` dark-on-dark classes (`text-gray-600`, `bg-green-100 text-green-800`, unstyled `<textarea>`) to M3 dark tokens (`text-muted`, `bg-surface text-foreground`, `bg-emerald-500/15 text-emerald-300`).
   - Include `getAuthHeaders()` in `cancel-dialog.tsx` and `receipt-download.tsx`, and use `GET /api/subscriptions/invoices/list` (with fallback to `/api/subscriptions/invoices`) in `useMyInvoices`.
   - Fix `PricingCard.tsx` navigation to `tier.ctaLink` (e.g. `/register`) instead of `/${locale}${tier.ctaLink}`.

## Todo List
- [ ] Fix `use-admin-staff-store.ts` `PATCH /api/staff/:id`
- [ ] Fix `Orders.tsx` `served` → `delivered` filter & `details` action guard
- [ ] Pass `direction: 'admin'` in `ChatInbox-detail-view.tsx`
- [ ] Align `DinDinMenu-hooks.ts` and `use-dindin-cart.ts` envelopes
- [ ] Fix CSV exports in `SalesReports.tsx`, `use-sales-report-data.ts`, `use-analytics-data.ts`
- [ ] Fix SaaS dashboard dark contrast, auth headers & `PricingCard.tsx` route
