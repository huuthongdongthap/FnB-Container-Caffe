# Phase 02: Customer Flows, Mobile Staff App & Domain Shift/KDS/Ownership Policies

## Context Links
- Brainstorm Report: `plans/20261017-wave4-fullstack-contracts-sql-security-ui/reports/brainstorm-20261017-wave4-deep-audit.md`
- Overview Plan: `plans/20261017-wave4-fullstack-contracts-sql-security-ui/plan.md`

## Overview
- **Priority**: P0
- **Status**: Completed
- **Description**: Fix shift cash reconciliation SQL (`method IN ('cash', 'cod')`), Mobile KDS `'confirmed'` status and `'ready' -> 'served'` action, Mobile Login context synchronization (`useMobileAuth().login()`), waiter order `table_number` & item `note`/`notes`, review submission `order_id`, `/contact` (`ContactNew`) API submission, `/table-reservation` (`ReservationNew`) party size & `notes` submission, guest order ownership policy, and VND price mapping in `order-store-mappers.ts`.

## Key Insights
- `packages/domain/shift/src/policies/cash-reconciliation-policy.ts:48-55` queries `WHERE payment_method = 'cash'`, which fails on D1 because the column in `payments` is `method`.
- `src/pages/mobile/mobile-login.tsx` writes directly to `localStorage` without calling `useMobileAuth().login()`, leaving React state `null` until page reload.
- `src/hooks/use-reviews.ts` strips `order_id` in `reviewFormSchema`, causing `POST /api/reviews` to reject every submission with `400`.
- `src/hooks/stores/order-store-mappers.ts` divides VND prices by `100` (`cents / 100`), displaying `450₫` instead of `45.000₫`.

## Requirements
- Update `cash-reconciliation-policy.ts` to query `WHERE method IN ('cash', 'cod')` with fallback to `payment_method` only if needed.
- Support `'confirmed'` in `kds-mobile.ts`, `kitchen-display-types.ts`, `kitchen-display-order-card.tsx`, and `kitchen-display.tsx`, plus a button to advance `'ready' -> 'served'`.
- Update `mobile-login.tsx` to call `useMobileAuth().login(data.token, data.staff)` and display specific error messages for `429`/`500`.
- Include `table_number` in `waiter-orders.tsx` payload and pass staff role to `PushNotificationToggle` in `mobile-layout-notifications.tsx`.
- Preserve `order_id` in `use-reviews.ts` (`reviewFormSchema` + `submitReview`).
- Wire `src/pages/stitch/contact-new/index.tsx` to `POST /api/contact` via `useContactStore`, and only clear `ContactForm.tsx` when submission succeeds.
- Fix `src/pages/stitch/reservation-new/index.tsx`, `use-reservations.ts`, and `use-reservation-store.ts` to preserve `notes`, parse `'Nhóm 10+'` as `10`, await reservation creation, and handle array responses from `/api/reservations/availability`.
- Update `order-ownership-policy.ts` so unauthenticated guest order tracking (`GET /api/orders/:id`) is allowed for recently placed/guest orders without leaking PII, and fix `order-store-mappers.ts` VND formatting and `StitchTrackOrderNew-order-timeline.tsx` status steps.

## Architecture
- Mobile Staff state flows through `MobileAuthProvider` (`useMobileAuth()`).
- Customer forms (`ContactNew`, `ReservationNew`, `ReviewForm`) validate and await Worker API responses before transitioning UI to success state.

## Related Code Files
- Modify:
  - `packages/domain/shift/src/policies/cash-reconciliation-policy.ts`
  - `packages/domain/kitchen/commands/kds-mobile.ts`
  - `packages/domain/customer/policies/order-ownership-policy.ts`
  - `src/pages/mobile/kitchen-display-types.ts`
  - `src/pages/mobile/kitchen-display-order-card.tsx`
  - `src/pages/mobile/kitchen-display.tsx`
  - `src/pages/mobile/mobile-login.tsx`
  - `src/pages/mobile/waiter-orders.tsx`
  - `src/pages/mobile/mobile-layout-notifications.tsx`
  - `src/hooks/use-reviews.ts`
  - `src/hooks/use-reservations.ts`
  - `src/hooks/use-checkout.ts`
  - `src/hooks/stores/use-reservation-store.ts`
  - `src/hooks/stores/order-store-mappers.ts`
  - `src/pages/stitch/contact-new/index.tsx`
  - `src/pages/stitch/reservation-new/index.tsx`
  - `src/components/contact/ContactForm.tsx`
  - `src/components/stitch/StitchTrackOrderNew-order-timeline.tsx`
  - `src/pages/TableOrder.tsx`
  - `src/pages/TableOrder-hooks.ts`
  - `src/pages/checkout.tsx`

## Implementation Steps
1. Fix `cash-reconciliation-policy.ts` (`method IN ('cash', 'cod')`), `kds-mobile.ts` (`'confirmed' -> 'preparing'`), and `order-ownership-policy.ts` (guest read access for order tracking).
2. Update `kitchen-display-types.ts`, `kitchen-display-order-card.tsx` (`'confirmed'`, `'ready' -> 'served'`, `item.note ?? item.notes`), `kitchen-display.tsx`, `mobile-login.tsx` (`useMobileAuth().login`), `waiter-orders.tsx` (`table_number`), and `mobile-layout-notifications.tsx` (staff role).
3. Fix `use-reviews.ts` (`order_id`), `contact-new/index.tsx` & `ContactForm.tsx`, `reservation-new/index.tsx`, `use-reservations.ts`, and `use-reservation-store.ts`.
4. Fix `order-store-mappers.ts` (`formatVndCents`), `StitchTrackOrderNew-order-timeline.tsx` (`STATUS_FLOW`), `use-checkout.ts`, `checkout.tsx`, and `TableOrder*.ts*`.

## Todo List
- [x] Fix `cash-reconciliation-policy.ts` SQL column `method`
- [x] Add `'confirmed'` and `'ready' -> 'served'` to Mobile KDS
- [x] Sync `useMobileAuth().login()` in `mobile-login.tsx`
- [x] Preserve `order_id` in `use-reviews.ts`
- [x] Wire `contact-new` and `reservation-new` to backend endpoints
- [x] Fix `order-store-mappers.ts` VND formatting and guest order tracking

## Success Criteria
- Shift reconciliation, Mobile KDS status transitions, Mobile PIN login, Review submission, Contact submission, Reservation submission, and Guest Order Tracking all succeed without 400/401/500 errors.

## Risk Assessment
- Check existing unit tests for `order-ownership-policy` and `order-store-mappers` to ensure backward compatibility.

## Security Considerations
- Guest order tracking must only allow access by exact unguessable order ID and never expose other customers' order lists.

## Next Steps
- Coordinates with Phase 04 (`orders-unified.ts` `optionalAuth()` and `features-router.ts` `/api/reviews`).
