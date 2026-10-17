# Phase 02: POS, KDS, TableCheckin, Account & Customer Checkout Flows

## Context Links
- [Plan Overview](plan.md)

## Overview
- **Priority**: P0 (Core Operational & Customer Revenue Flows)
- **Status**: Pending
- **Description**: Fix broken POS PayOS QR generation, POS cart premature clearing, KDS status polling & bump transitions, TableOrder duplicate guest-checkin 409 conflict, Customer Account order history envelope parsing, Customer Checkout productId preservation, and Loyalty/TrackOrder display logic.

## Key Insights
- `POS.tsx` never calls `payOSMutation.mutateAsync` when `paymentMethod === 'qr'`, and `StitchPOSNew.tsx` clears the cart before `onCompleteOrder` resolves.
- `use-kds.ts` fetches `/api/admin/orders?status=pending`, causing orders moved to `preparing` or `ready` to vanish on the next 5s poll, and `bumpOrder('ready')` calls `/complete` which jumps straight to `completed`.
- `use-account.ts` checks `if (ordersData.success)` on `GET /api/orders`, which returns `{ orders, total }` without `success: true`.
- `checkout.tsx` splits `productId` on `[-_]`, corrupting canonical product IDs like `prod_01` into `prod`.

## Related Code Files
- `src/pages/admin/POS.tsx`
- `src/components/stitch/StitchPOSNew.tsx`
- `src/components/stitch/StitchPOSNew-types.ts`
- `src/hooks/use-kds.ts`
- `src/components/stitch/stitch-kds-order-card.tsx`
- `src/pages/TableOrder.tsx`
- `src/pages/TableOrder-hooks.ts`
- `src/pages/order/index.tsx`
- `src/hooks/use-account.ts`
- `src/pages/checkout.tsx`
- `src/pages/order-success.tsx`
- `src/components/stitch/StitchAccountDashNew-orders.tsx`
- `src/pages/stitch/checkin-new/index.tsx`
- `src/pages/stitch/track-order/index.tsx`
- `src/components/stitch/StitchLoyaltyNew.tsx`
- `src/pages/referral.tsx`

## Implementation Steps
1. **POS (`POS.tsx` & `StitchPOSNew.tsx`)**:
   - Make `onCompleteOrder` async in `StitchPOSNew.tsx` and only clear cart after `await onCompleteOrder(...)` succeeds.
   - In `POS.tsx`, when `paymentMethod === 'qr'` and `POST /api/orders` returns an order without `payment_url`, invoke `payOSMutation.mutateAsync({ orderId, amount: total, description })` to open the PayOS QR modal.
   - Pass `service_fee: Math.round(total - subtotal)` or align POS tax rate so frontend and backend totals match.
2. **KDS (`use-kds.ts` & `stitch-kds-order-card.tsx`)**:
   - In `use-kds.ts`, fetch active orders without restricting to `status=pending` (or map active statuses `pending`, `confirmed`, `preparing`, `ready`), and in `bumpOrder(orderId, 'ready')` call `PATCH /api/admin/orders/${orderId}/status` with `{ status: 'ready' }` before falling back to `/complete`.
   - In `stitch-kds-order-card.tsx`, keep `onStart` for overdue `pending` orders instead of jumping to `onComplete`.
3. **Table Order (`TableOrder.tsx`, `TableOrder-hooks.ts`, `src/pages/order/index.tsx`)**:
   - Support `:tableId` from `useParams()` in `TableOrder.tsx`.
   - In `TableOrder-hooks.ts` and `src/pages/order/index.tsx`, treat HTTP 409 on `POST /api/orders/guest-checkin` as non-fatal (table already checked in by `TableCheckin.tsx`) and proceed to `POST /api/orders`.
4. **Customer Account, Checkout, Reorder & Track Order**:
   - In `use-account.ts`, accept both `{ success: true, data: { orders } }` and `{ orders: [...] }` from `GET /api/orders`.
   - In `checkout.tsx`, preserve `i.productId` verbatim when present, and only strip composite cart key suffixes when `i.productId` is absent.
   - In `order-success.tsx` and `StitchAccountDashNew-orders.tsx`, preserve `item.product_id || item.productId || item.id` when reordering.
   - In `StitchLoyaltyNew.tsx`, only show `LoyaltyEmpty` when `!data` (allow 0-point members to view their dashboard).
   - In `referral.tsx`, use `store.cashbackEarned` when available and navigate to `/account` on `onViewProfile`.

## Todo List
- [ ] Fix POS PayOS QR link creation & async cart clearing
- [ ] Fix KDS active status polling & `ready` bump transition
- [ ] Handle TableOrder 409 already-checked-in state & `:tableId` route param
- [ ] Fix `use-account.ts` order history envelope & `checkout.tsx` `productId` handling
- [ ] Fix `StitchLoyaltyNew.tsx` 0-point empty gate & `referral.tsx` cashback display
