# Phase 01: Frontend Stitch UI, Hooks, Admin Ops & SaaS Contracts

## Context Links
- Brainstorm Report: [reports/brainstorm-20261018-wave6-deep-audit.md](reports/brainstorm-20261018-wave6-deep-audit.md)
- Plan Overview: [plan.md](plan.md)

## Overview
- **Priority**: High
- **Status**: Pending
- **Scope**: Fix React runtime warnings (`key={day}`, `<img src="">`), add auth headers & envelope unwrapping in hooks, and align Admin/SaaS/Order frontend contracts.

## Related Code Files (Strict Ownership)
- `src/components/stitch/StitchReservationNew-form.tsx`
- `src/components/stitch/StitchReservationNew.tsx`
- `src/components/stitch/stitch-reviews-new-card.tsx`
- `src/components/stitch/StitchAdminTerminalNew-sidebar.tsx`
- `src/components/stitch/StitchAccountDashNew-profile.tsx`
- `src/components/stitch/StitchAccountNew-profile-section.tsx`
- `src/components/stitch/StitchReferralNew1-friends.tsx`
- `src/components/stitch/StitchReferralNew2-rewards.tsx`
- `src/components/pwa/push-notification-toggle.tsx`
- `src/components/staff/notification-settings.tsx`
- `src/hooks/use-offline-sync.ts`
- `src/hooks/use-split-bill.ts`
- `src/hooks/use-push-notifications.ts`
- `src/hooks/use-reports.ts`
- `src/hooks/stores/admin/use-admin-orders-store.ts`
- `src/pages/order/index.tsx`
- `src/pages/stitch/customer-reviews/index.tsx`
- `src/pages/admin/Orders.tsx`
- `src/pages/admin/CheckinApprove-hooks.ts`
- `src/pages/admin/use-subscription-plans.ts`
- `src/pages/admin/GenerateQR.tsx`
- `src/pages/admin/ERPNExtSync.tsx`
- `src/pages/saas/dashboard/invoice-table-card.tsx`
- `src/pages/saas/dashboard/cancel-dialog.tsx`
- `src/pages/saas/onboard/index.tsx`

## Implementation Steps
1. **`StitchReservationNew-form.tsx` & `StitchReservationNew.tsx`**:
   - In `StitchReservationNew-form.tsx:41`, use `dayLabels.map((day, idx) => <span key={`${day}-${idx}`} ...>)`.
   - In `StitchReservationNew.tsx:45-47`, update `handleSubmit` to call `onConfirmReservation?.()` after `e.preventDefault()`.
2. **Guard Empty `src=""` on `<img>` Tags**:
   - In `stitch-reviews-new-card.tsx`, `StitchAdminTerminalNew-sidebar.tsx`, `StitchAccountDashNew-profile.tsx`, `StitchAccountNew-profile-section.tsx`, `StitchReferralNew1-friends.tsx`, and `StitchReferralNew2-rewards.tsx`, only render `<img src={url} ... />` when `url` is truthy (`Boolean(url?.trim())`); otherwise render a clean fallback avatar icon/initials span.
3. **`src/pages/stitch/customer-reviews/index.tsx`**:
   - Handle `'Mới nhất'` filter chip by sorting a shallow copy of reviews (`[...REVIEWS]`) so it does not silently fall through.
4. **Hooks Auth Headers & Envelope Unwrapping**:
   - `use-offline-sync.ts`: Attach `Authorization: Bearer <token>` when `localStorage.getItem('aura_auth_token')` is present and `credentials: 'include'`.
   - `use-split-bill.ts`: Attach `Authorization: Bearer <token>` when present, `credentials: 'include'`, and unwrap `body.data ?? body`.
   - `use-push-notifications.ts` & `push-notification-toggle.tsx`: Accept and forward `role` and `token` props in `PushNotificationToggle` (`subscribe(props.role)`), and attach `Authorization: Bearer <token>` when available in `usePushNotifications`.
   - `src/components/staff/notification-settings.tsx`: Use `API_BASE` and attach `Authorization: Bearer <token>` from `localStorage.getItem('aura_auth_token')`.
   - `use-reports.ts`: Unwrap `(res as { data?: T })?.data ?? res` in `useDailyReport`, `useTopProducts`, `usePeakHours`, and `useCustomerMetrics`.
5. **Admin & SaaS Pages**:
   - `Orders.tsx` & `use-admin-orders-store.ts`: Add `'cancelled': 'cancelled'` to `ACTION_TO_STORE` in `Orders.tsx`; in `use-admin-orders-store.ts`, update `updateOrderStatus` to call `/api/orders/${orderId}/status` (with fallback to `/api/orders/${orderId}`).
   - `CheckinApprove-hooks.ts`: Use `method: 'PATCH'` on `/api/admin/checkins/${id}/approve` and `/api/admin/checkins/${id}/reject`, and only apply state mutation + success toast when the request succeeds (or surface error toast on failure).
   - `use-subscription-plans.ts`: Include both `price: payload.monthly_price_vnd` and `monthly_price_vnd: payload.monthly_price_vnd` in `saveMutation`.
   - `GenerateQR.tsx`: Render either `<ZoneGroupedTables />` (when `Object.keys(grouped).length > 1`) OR the flat `filteredTables.map(...)` grid (`else`), never both simultaneously.
   - `ERPNExtSync.tsx`: Initialize `syncLogs` as empty array `[]` (falling back to `MOCK_LOGS` only when offline/dev fallback is needed) and read `data.logs` from `/api/admin/erpnext-sync/status`.
   - `src/pages/saas/dashboard/invoice-table-card.tsx` & `cancel-dialog.tsx`: Use `apiFetch('/api/subscriptions/invoices/' + invoiceId + '/pay', { method: 'POST', body: JSON.stringify({ payment_method: 'payos' }) })` in `handlePay` (redirecting if `payment_url` is returned), and invalidate both `['my-subscriptions']` and `['my-active-subscription']` in `cancel-dialog.tsx`.
   - `src/pages/saas/onboard/index.tsx`: Pass `customer_id: user?.id` when calling `createSubMutation.mutateAsync`.
   - `src/pages/order/index.tsx`: Unwrap `(raw as { order?: ActiveOrderData; data?: ActiveOrderData })?.order ?? (raw as { data?: ActiveOrderData })?.data ?? raw` when fetching `/api/orders/${activeOrderId}`.

## Success Criteria
- Zero React duplicate key or empty `src=""` warnings in tests.
- All existing and updated frontend unit tests pass.
