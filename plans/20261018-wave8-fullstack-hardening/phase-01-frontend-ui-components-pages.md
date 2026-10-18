# Phase 01: Frontend UI Components, Pages & Visual Integrity

**Context**: [plan.md](plan.md) | [reports/brainstorm-20261018-wave8-deep-audit.md](reports/brainstorm-20261018-wave8-deep-audit.md)
**Priority**: High
**Status**: Pending
**File Ownership (Strict)**:
- `src/components/home/testimonial-carousel.tsx`
- `src/components/events/event-card.tsx`
- `src/components/admin/CustomerMetrics.tsx`
- `src/components/admin/StuckPaymentsCard.tsx`
- `src/components/stitch/StitchOrderMgmtNew-order-card.tsx`
- `src/components/stitch/StitchOrderMgmtNew-table.tsx`
- `src/components/admin/OrderTable.tsx`
- `src/pages/admin/POS.tsx`
- `src/pages/admin/SubscriptionsManager.tsx`
- `src/pages/checkout.tsx`
- `src/pages/TrackOrder.tsx`
- `src/pages/order-success.tsx`
- `src/pages/loyalty.tsx`

---

## Requirements & Implementation Steps

1. **Avatar and Icon Rendering Fixes**:
   - `src/components/home/testimonial-carousel.tsx`: Look up avatar component via `REVIEW_AVATARS[testimonial.avatar] || Star` instead of rendering `{testimonial.avatar}` as a raw string.
   - `src/components/events/event-card.tsx`: Replace literal string `'coffee'` with unicode coffee emoji `\u{2615}` in `EVENT_ICONS['Tasting']`.

2. **Metrics & Formatting Resilience**:
   - `src/components/admin/CustomerMetrics.tsx`: Map response properties safely (`data.new_customers_30d ?? (data as any).new_30d ?? 0` and `data.avg_spend_per_customer ?? (data as any).avg_order_value ?? 0`) to prevent `TypeError: undefined.toLocaleString` and `NaN₫`.
   - `src/components/admin/StuckPaymentsCard.tsx`: Guard currency formatting by checking whether amount is numeric (`typeof s.dbAmount === 'number' ? ... : s.dbAmount`), avoiding `'***₫'`.

3. **Admin POS PayOS QR Presentation**:
   - `src/pages/admin/POS.tsx`: When `paymentMethod === 'payos'` and checkout returns `paymentUrl`, render a modal/dialog with QR code and link so the cashier can display it to customers.

4. **Stitch Order Actions & OrderTable Reactivity**:
   - `src/components/stitch/StitchOrderMgmtNew-order-card.tsx`: Only trigger `onViewDetails` on click of the Details button; remove `?? (isServed ? undefined : onAction)` fallback that accidentally advances order status.
   - `src/components/admin/OrderTable.tsx`: Select `userRole` reactively via `const userRole = useAuthStore((s) => s.user?.role)` instead of calling `useAuthStore.getState().user?.role` during render.

5. **Subscriptions Manager Invoices Tab**:
   - `src/pages/admin/SubscriptionsManager.tsx`: Mount `InvoiceTable` (from `InvoiceHistory.tsx` or dedicated component) when `activeTab === 'invoices'` instead of showing a static placeholder.

6. **Guest Checkout & Order Tracking Integration**:
   - `src/pages/checkout.tsx`: Handle digital wallet requests gracefully without 401 failures for unauthenticated guests, or prompt guest login before presenting Apple/Google Pay.
   - `src/pages/TrackOrder.tsx` & `src/pages/order-success.tsx`: Allow public tracking with token or fallback to guest tracking endpoint so guests do not receive 401 error cards.
   - `src/pages/loyalty.tsx`: Use `apiFetch` (preserving `API_BASE`) and require phone number/member identification before checkin rather than sending generic `customer_id: 'guest'`.

---

## Success Criteria
- Zero TypeScript errors (`tsc --noEmit`), zero ESLint errors.
- Visual elements render correct icons and formatted currency strings.
- PayOS checkout URL renders accessible payment dialog for cashiers.
