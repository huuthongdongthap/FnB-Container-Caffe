# Phase 01: Frontend KDS, Loyalty, Mobile & Admin Flows

**Context**: [plan.md](plan.md) | [reports/brainstorm-20261018-wave7-deep-audit.md](reports/brainstorm-20261018-wave7-deep-audit.md)
**Priority**: High
**Status**: Pending
**File Ownership (Strict)**: `src/**`

---

## Related Code Files
- `src/pages/loyalty.tsx`
- `src/hooks/stores/use-checkin-store.ts`
- `src/pages/TableOrder-hooks.ts`
- `src/hooks/use-mobile-auth.tsx`
- `src/pages/mobile/mobile-login.tsx`
- `src/pages/admin/DinDinCheckout.tsx`
- `src/pages/admin/invoice-history-table.tsx`
- `src/hooks/use-kds.ts`
- `src/pages/KDS.tsx`
- `src/components/stitch/stitch-kds-order-card.tsx`
- `src/components/stitch/StitchKDSNew.tsx`
- `src/pages/mobile/waiter-orders.tsx`
- `src/components/admin/range-selector.tsx`
- `src/components/admin/performance-section.tsx`
- `src/components/admin/performance-section-web-vitals.tsx`
- `src/components/admin/performance-section-api-latency.tsx`
- `src/pages/admin/Inventory-movements-tab.tsx`
- `src/pages/admin/Inventory-movement-modal.tsx`
- `src/pages/admin/POS.tsx`
- `src/pages/admin/TableManagement.tsx`
- `src/pages/admin/TableManagement-card.tsx`
- `src/pages/admin/SubscriptionsManager.tsx`
- `src/pages/admin/use-subscriptions.ts`
- `src/pages/admin/use-notification-subscriptions.ts`
- `src/pages/admin/subscription-table.tsx`
- `src/hooks/stores/admin/use-admin-customers-store.ts`
- `src/pages/admin/Customers.tsx`
- `src/hooks/stores/admin/use-admin-staff-store.ts`
- `src/pages/admin/staff-list-tab.tsx`
- `src/hooks/stores/admin/use-admin-recruitment-store.ts`
- `src/pages/admin/CampaignsManager.tsx`
- `src/pages/admin/SalesReports.tsx`
- `src/pages/admin/Dashboard-sections.tsx`
- `src/pages/admin/GenerateQR-qr-card.tsx`
- `src/pages/TableReservation.tsx`
- `src/pages/TrackOrder.tsx`

---

## Implementation Steps

1. **Loyalty, Check-in & Auth Credentials**:
   - `src/pages/loyalty.tsx`: Use `apiFetch('/api/checkin', { method: 'POST', body: JSON.stringify({ customer_id: user?.id || 'guest', customer_name: user?.name }) })` (falling back gracefully if tests mock `globalThis.fetch` by keeping `credentials: 'include'` and passing JSON body `{ customer_id: user?.id || 'guest', customer_name: user?.name }` + reading token from `localStorage.getItem('aura_auth_token') || (user as any)?.token`).
   - `src/hooks/stores/use-checkin-store.ts`: Send `{ phone: phoneClean, customer_id: phoneClean }` and map `points: body.data?.points ?? body.data?.reward_amount ?? 0` and `reward: body.data?.reward ?? (body.data?.reward_amount ? `+${body.data.reward_amount.toLocaleString('vi-VN')}đ` : 'Đã ghi nhận')`.
   - `src/pages/TableOrder-hooks.ts`, `src/hooks/use-mobile-auth.tsx`, `src/pages/mobile/mobile-login.tsx`: Add `credentials: 'include'` to raw `fetch` calls.

2. **Response Envelope & Field Unwrapping**:
   - `src/pages/admin/DinDinCheckout.tsx`: Unwrap `Array.isArray(data) ? data : (data?.data ?? data?.checkouts ?? [])`, map `qcOk: Boolean(e.qcOk ?? e.qcPassed)`, filter `MOCK_ENTRIES` by `filter` when falling back, and do not mark status `'completed'` when `POST` throws.
   - `src/pages/admin/invoice-history-table.tsx`: Read `res?.data?.pdfUrl || res?.data?.pdf_url` before falling back to API URL.

3. **KDS & Mobile Waiter**:
   - `src/hooks/use-kds.ts`: When SSE `snapshot` arrives, preserve any existing `'ready'` orders from cache if the snapshot omits `'ready'` (or merge cleanly), and when polling with `status === 'all'`, do not restrict query to `status=pending` if all active orders are needed (keep compatibility with unit tests expecting the URL format).
   - `src/pages/KDS.tsx`, `src/components/stitch/stitch-kds-order-card.tsx`, `src/components/stitch/StitchKDSNew.tsx`: Treat `'confirmed'` as pending, ensure overdue tickets that were already `'preparing'` invoke `onComplete` instead of `onStart` (or pass `onStart={ticket.rawStatus === 'preparing' ? undefined : onStartPrep}`), and avoid ID collisions in `orderIdMap` when multiple orders share the last 4 chars.
   - `src/pages/mobile/waiter-orders.tsx`: Format object modifiers (`typeof m === 'string' ? m : m?.name`) instead of rendering `[object Object]`, and send `newOrderTable.trim()` (preserving string table IDs when non-numeric or numeric string).

4. **Admin Pages & Stores**:
   - `src/components/admin/range-selector.tsx`, `performance-section.tsx`, `performance-section-web-vitals.tsx`, `performance-section-api-latency.tsx`: Sync range selection with `usePerformanceStore` and wrap `onRetry={() => void retry()}` so `MouseEvent` is not passed as `range`.
   - `src/pages/admin/Inventory-movements-tab.tsx` & `Inventory-movement-modal.tsx`: Support both `'adjustment'` and `'adjust'` in `MOVEMENT_TYPE_LABELS` and allow negative numbers when `type === 'adjustment'`.
   - `src/pages/admin/POS.tsx`: Route shift actions to `/admin/staff` and keep `paymentUrl` banner visible until dismissed or next order starts.
   - `src/pages/admin/TableManagement.tsx` & `TableManagement-card.tsx`: Cycle through all `STATUS_OPTIONS` using `findIndex` and pass `defaultValue` alongside `fallback` in `t(...)`.
   - `src/pages/admin/SubscriptionsManager.tsx`, `use-subscriptions.ts`, `use-notification-subscriptions.ts`, `subscription-table.tsx`: Deduplicate notification subscriptions by `name` (and use unique keys), and wire invoice list rendering when `tab === 'invoices'`.
   - `src/pages/admin/staff-list-tab.tsx`, `CampaignsManager.tsx`, `SalesReports.tsx`, `GenerateQR-qr-card.tsx`: Guard empty date string in `formatDate`, wrap `mutateAsync` in `try/catch`, respect `compareMode` in `SalesReports.tsx`, and guard blob URL retry loop + cleanup in `GenerateQR-qr-card.tsx`.

5. **Customer TableReservation & TrackOrder**:
   - `src/pages/TableReservation.tsx`: `await createReservation(payload)` and only open `SuccessModal` if the returned result is truthy.
   - `src/pages/TrackOrder.tsx`: Read `id` or `order_id` from `useSearchParams()` on mount and auto-fetch/poll the order.

---

## Success Criteria
- Zero TypeScript errors, zero ESLint errors, and all existing frontend Vitest tests pass.
