# Phase 01: POS, DinDin, Loyalty, Referral, Account, Events, Pricing, OurStory & Offline/PWA

## Context Links
- Brainstorm Report: `plans/20261018-wave5-pos-loyalty-admin-d1-domain-hardening/reports/brainstorm-20261018-wave5-deep-audit.md`
- Overview Plan: `plans/20261018-wave5-pos-loyalty-admin-d1-domain-hardening/plan.md`

## Overview
- **Priority**: P0
- **Status**: Completed
- **Description**: Fix frontend bugs across POS (`StitchPOSNew`), DinDin (`DinDinMenu`, `DinDinCart`, `DinDinCheckout`), Loyalty (`src/pages/loyalty.tsx`, `use-loyalty.ts`), Referral (`src/pages/referral.tsx`, `use-referral-store.ts`, `StitchReferralNew1`), Account (`useReorder`, `sanitizeCartItem`, `mapOrderStatus`), Events (`useEvents`, `StitchEventsNew2`), Pricing (`/pricing`), OurStory (`StitchStoryNew` contrast), `formatCurrency`, and Offline/PWA sync.

## Key Insights
- `StitchPOSNew` defaults to USD add-ons (`1.00`, `2.00`, `0.75`), multiplies unit price by quantity twice in `StitchPOSNew-cart-sidebar.tsx:106`, and slices the first character off VND subtotal strings (`45.000₫` -> `4` + `5.000₫`).
- `DinDinMenu-hooks.ts:123` sends `{ sections }` instead of `{ menu: { sections } }` to `PUT /api/admin/dindin/config`, causing HTTP 400 `D07`.
- `src/pages/loyalty.tsx` omits the `Authorization: Bearer` header, reads `summary.points` instead of `summary.total_points`, passes object `summary.next_tier` into string prop `nextTierName` (`[object Object]`), and reads `r.pointsCost` instead of `r.points_required`.
- `sanitizeCartItem` in `src/hooks/stores/use-cart-store.ts:52` runs `rawPid.split(/[-_]/)[0]`, corrupting any product ID containing `-` or `_` (such as `prod_123` -> `prod`).
- `src/pages/[locale]/pricing.tsx` returns `null` when mounted at `/pricing` without a `:locale` route param.
- `src/lib/format.ts` formats VND amounts with `currency: 'USD'` when `i18n.language` is `'en'`, turning `45000` VND into `$45,000.00`.

## Requirements
- Fix POS add-ons, CartSidebar line-item unit price & subtotal rendering, paymentMethod active state, post-discount tax calculation, and header/footer actions.
- Fix `DinDinMenu-hooks.ts` `{ menu: { sections } }` payload & `toggleAvailable` wiring, and `cart-active-view.tsx` `price`/`qty`/`updatedAt` normalization.
- Fix `src/pages/loyalty.tsx` Bearer auth, `total_points` / `next_tier` / `points_required` mapping, `POST /api/checkin` call, and `useLoyaltyQuery` (`/api/loyalty/summary`).
- Fix `use-referral-store.ts` code provisioning fallback & `applyReferralCode` error check, and wire `onShareVia` in `StitchReferralNew1`.
- Preserve full product IDs in `use-cart-store.ts:52` (`sanitizeCartItem`), check `rawItem.menuItemId` in `StitchAccountDashNew-orders.tsx`, map `'cancelled'` in `account-constants.ts`, and fetch menu for favorites in `StitchAccountDashNew.tsx`.
- Unwrap `res.data.results` and compare `YYYY-MM-DD` dates in `src/hooks/use-events.ts`, filter `featuredEvents` by `activeMonth` in `StitchEventsNew2.tsx`, and fix i18n keys in `src/pages/events.tsx`.
- Resolve fallback locale (`i18n.resolvedLanguage || 'vi'`) in `src/pages/[locale]/pricing.tsx` and register `/:locale/pricing` in `src/routes/public-routes.tsx`.
- Fix `StitchStoryNew-hero.tsx` and `StitchStoryNew-footer.tsx` dark-on-dark contrast (`text-[var(--aura-chrome-bright)]`).
- Keep `currency: 'VND'` in `src/lib/format.ts`, and fix partial offline sync cleanup in `use-order-store.ts`, `offline-db.ts`, `OrderQueueIndicator.tsx`, `use-offline-sync.ts`, and `SWUpdatePrompt.tsx`.

## Related Code Files
- Modify:
  - `src/pages/admin/POS.tsx`
  - `src/components/stitch/StitchPOSNew.tsx`
  - `src/components/stitch/StitchPOSNew-types.ts`
  - `src/components/stitch/StitchPOSNew-add-on-chip.tsx`
  - `src/components/stitch/StitchPOSNew-cart-sidebar.tsx`
  - `src/components/stitch/StitchPOSNew-header.tsx`
  - `src/components/stitch/StitchPOSNew-footer.tsx`
  - `src/pages/admin/DinDinMenu.tsx`
  - `src/pages/admin/DinDinMenu-hooks.ts`
  - `src/pages/admin/DinDinMenu-section-list.tsx`
  - `src/pages/admin/cart-active-view.tsx`
  - `src/pages/loyalty.tsx`
  - `src/hooks/use-loyalty.ts`
  - `src/pages/referral.tsx`
  - `src/hooks/stores/use-referral-store.ts`
  - `src/components/stitch/StitchReferralNew1.tsx`
  - `src/components/stitch/StitchReferralNew1-form.tsx`
  - `src/components/stitch/StitchAccountDashNew.tsx`
  - `src/components/stitch/StitchAccountDashNew-orders.tsx`
  - `src/pages/account/account-constants.ts`
  - `src/hooks/stores/use-cart-store.ts`
  - `src/hooks/use-events.ts`
  - `src/pages/events.tsx`
  - `src/components/stitch/StitchEventsNew2.tsx`
  - `src/pages/[locale]/pricing.tsx`
  - `src/routes/public-routes.tsx`
  - `src/components/saas/PricingCard.tsx`
  - `src/components/stitch/StitchStoryNew-hero.tsx`
  - `src/components/stitch/StitchStoryNew-footer.tsx`
  - `src/lib/format.ts`
  - `src/lib/offline-db.ts`
  - `src/hooks/stores/use-order-store.ts`
  - `src/hooks/use-offline-sync.ts`
  - `src/hooks/use-sw-registration.ts`
  - `src/components/pwa/OrderQueueIndicator.tsx`
  - `src/components/pwa/SWUpdatePrompt.tsx`

## Todo List
- [x] Fix POS add-ons, CartSidebar unit price/subtotal, paymentMethod prop, and post-discount tax
- [x] Fix DinDinMenu `{ menu: { sections } }`, `toggleAvailable`, and `cart-active-view.tsx` guards
- [x] Fix `loyalty.tsx` Bearer auth, `total_points`/`next_tier`/`points_required` mapping, `useLoyaltyQuery`, and `referral` share/code wiring
- [x] Fix `use-cart-store.ts` ID truncation, Account Reorder `menuItemId`, Events `.results` & date comparison, `/pricing` locale fallback, and `StitchStoryNew` contrast
- [x] Fix `format.ts` VND currency, offline sync partial removal, `useOfflineSync` online check, and `SWUpdatePrompt` keys
