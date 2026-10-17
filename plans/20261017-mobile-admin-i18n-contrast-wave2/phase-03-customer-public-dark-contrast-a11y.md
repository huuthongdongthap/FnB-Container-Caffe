# Phase 03: Customer/Public Dark Contrast, WCAG 4.1.2/ARIA & Promo/Loyalty Math

## Context Links
- Overview Plan: `plans/20261017-mobile-admin-i18n-contrast-wave2/plan.md`
- Contrast Gate: `scripts/contrast-check.mjs`

## Overview
- **Priority**: P1 (High — Customer UX, Accessibility & Financial Accuracy)
- **Current Status**: Pending
- **Description**: Eliminate white-on-white (`bg-white text-foreground`) and pastel light-mode contrast violations on Customer/Public pages, fix WCAG 4.1.2 nested-interactive `<div role="button"><button>` violations, add missing `aria-pressed`/`aria-label`/Escape handlers, filter out inactive/expired promotions in `use-promotions.ts`, and fix the double `/100` cashback calculation bug in `use-loyalty-store.ts`.

## Key Insights
1. `ReservationForm.tsx:44` (`bg-white text-sm text-foreground`), `TableMap.tsx`, `TimeSlotPicker.tsx`, `OrderTimeline.tsx`, `StatusBadge.tsx`, `CategoryCarousel.tsx`, and `QRCodeOverlay.tsx` use light-mode `bg-white`/`bg-gray-100` surfaces on dark pages.
2. `use-promotions.ts:47-70` ignores `is_active`, `starts_at`, and `expires_at`, displaying deactivated/expired `AURA20` and `AURA10` promos on the customer Promotions page.
3. `use-loyalty-store.ts:121` calculates `Math.round(amount * (cashbackRate / 100))`, even though `cashback_rate` from `/api/loyalty/tiers` is already a decimal fraction (`0.03`, `0.05`, `0.07`, `0.10`), under-calculating cashback by 100x.
4. `StitchPOSNew-menu-item-card.tsx:21` and `loyalty-reward-card.tsx:14` wrap inner `<button>` elements inside `<div role="button" tabIndex={0}>` (WCAG 4.1.2 violation).

## Requirements
- **Functional**:
  - Filter customer promotions in `use-promotions.ts` so `is_active === 0` or expired (`expires_at < now`) promotions are excluded (or marked inactive) when `activeOnly` is true.
  - Fix `calculateCashback` in `use-loyalty-store.ts` to handle decimal rates (`cashbackRate <= 1 ? cashbackRate : cashbackRate / 100`).
  - Wire `src/pages/loyalty.tsx` to read tier thresholds from `useLoyaltyStore` instead of hardcoded `15000` / `'Black Tier'`.
  - Fix `subscriptions/index.tsx` unaccented Vietnamese strings and light-mode error banners.
- **Non-Functional**:
  - Replace `bg-white`/`bg-gray-100` in `ReservationForm`, `TableMap`, `TimeSlotPicker`, `OrderTimeline`, `StatusBadge`, `CategoryCarousel`, `QRCodeOverlay`, `Checkin.tsx` with M3 dark surface tokens.
  - Remove outer `role="button" tabIndex={0}` when inner `<button>` exists, and add `aria-pressed` / `aria-label` / `Escape` listener on customer interactive controls.

## Related Code Files
- `src/components/reservation/ReservationForm.tsx`
- `src/components/reservation/TableMap.tsx`
- `src/components/reservation/TimeSlotPicker.tsx`
- `src/components/tracking/OrderTimeline.tsx`
- `src/components/tracking/StatusBadge.tsx`
- `src/components/tv-menu/CategoryCarousel.tsx`
- `src/components/tv-menu/QRCodeOverlay.tsx`
- `src/pages/Checkin.tsx`
- `src/pages/TableCheckin.tsx`
- `src/pages/subscriptions/index.tsx`
- `src/pages/subscriptions/subscriptions-helpers.tsx`
- `src/pages/loyalty.tsx`
- `src/hooks/use-promotions.ts`
- `src/hooks/stores/use-loyalty-store.ts`
- `src/components/stitch/StitchPOSNew-menu-item-card.tsx`
- `src/components/stitch/loyalty-reward-card.tsx`
- `src/pages/stitch/gallery-new/index.tsx`
- `src/pages/stitch/reservation-new/party-size-selector.tsx`
- `src/pages/stitch/reservation-new/date-time-picker.tsx`

## Implementation Steps
1. Replace `bg-white` / `bg-gray-100` / light pastel badges in `ReservationForm.tsx`, `TableMap.tsx`, `TimeSlotPicker.tsx`, `OrderTimeline.tsx`, `StatusBadge.tsx`, `CategoryCarousel.tsx`, `QRCodeOverlay.tsx`, `Checkin.tsx`, and `subscriptions/*` with dark M3 tokens (`bg-surface`, `border-border`, `text-foreground`, semantic status badges).
2. Update `src/hooks/use-promotions.ts` to map `is_active` and `expires_at` and filter out inactive/expired promotions for customer views.
3. Fix `calculateCashback` in `src/hooks/stores/use-loyalty-store.ts` so decimal `cashbackRate` (`0.03`–`0.10`) is not divided by `100` a second time, and update `src/pages/loyalty.tsx` to use real tier names/thresholds (`Bronze / Silver / Gold / Platinum`).
4. Remove nested `role="button"` on outer card `<div>` in `StitchPOSNew-menu-item-card.tsx` and `loyalty-reward-card.tsx`; add `aria-pressed` and `Escape` key handling to `gallery-new/index.tsx`, `party-size-selector.tsx`, and `date-time-picker.tsx`; fix `TableCheckin.tsx` navigation and input `id`/`htmlFor`.

## Todo List
- [ ] Dark-theme conversion for `ReservationForm`, `TableMap`, `TimeSlotPicker`, `OrderTimeline`, `StatusBadge`, `CategoryCarousel`, `QRCodeOverlay`, `Checkin`, `subscriptions`
- [ ] Filter inactive/expired promotions in `use-promotions.ts`
- [ ] Fix `calculateCashback` decimal math in `use-loyalty-store.ts` and tier display in `loyalty.tsx`
- [ ] Resolve WCAG 4.1.2 nested buttons and add `aria-pressed` / `Escape` handlers

## Success Criteria
- Zero `bg-white text-foreground` contrast collisions across Customer & Public components.
- Active promotions filter excludes `is_active: 0` or expired items.
- `calculateCashback(100000)` at `0.03` rate returns `3000` VND (not `30` VND).
