# Phase 03: Customer Flows, Single Shell, Currency Fix & WCAG 2.1 AA

## Context Links
- Audit Report: [`plans/reports/ui-ux-deep-audit-20261017.md`](../reports/ui-ux-deep-audit-20261017.md)

## Overview
- **Priority:** P0/P2 (Customer Conversion Flow & WCAG 2.1 AA Compliance)
- **Current Status:** Completed
- **Description:** Fix the 100x VND currency division bug (`unitPriceCents / 100` rendering `$450.00`), unify `CustomerShell` / `shell-config.ts` so pages do not render duplicate stacked headers/bottom navs, fix `DrinkCustomizerModal` state reset and accessibility, fix `/account` Reorder and `/order-success` live status steps, fix `SWUpdatePrompt` dismiss bug, and enforce WCAG 2.1 AA (`role="dialog"`, `inert`, `aria-label`, `>=44px` touch targets, `env(safe-area-inset-bottom)`).

## Key Insights
- `src/pages/stitch/track-order/index.tsx:58,65` and `src/components/stitch/StitchAccountDashNew-orders.tsx:76` divide VND prices by `100`, turning `45.000₫` into `450` -> `$450.00`.
- `CustomerShell.tsx:13-14` defaults unconfigured routes to `showNav = true, showTop = true` while `hasM3NavBar()` (`shell-config.ts:43-45`) defaults to `false`, causing `CartBottomBar` and `MD3NavigationBar` to collide.
- `menu-page.tsx:53` omits `onCheckout={() => navigate('/checkout')}`.
- `DrinkCustomizerModal.tsx:41-46` never resets state when `item` or `open` changes and lacks `role="dialog"`, `aria-modal="true"`, and `Escape` handling.
- `md3-app-shell.tsx:82-89` and `StitchLandingNew-nav.tsx:71-78` clip the AURA logo with `rounded-full object-cover`.

## Requirements
### Functional Requirements
1. **Currency & Reorder Fix:** Remove `/ 100` on VND amounts in `src/pages/stitch/track-order/index.tsx:58,65` and `src/components/stitch/StitchAccountDashNew-orders.tsx:76`; fallback `const items = order.items?.length ? order.items : order.rawItems ?? []` in `StitchAccountDashNew-orders.tsx:56` so Reorder works; wire "QUICK ORDER" and "View All" buttons on `/account`.
2. **Menu & Order Tracking Flow Fix:** Pass `onCheckout={() => navigate('/checkout')}` in `src/pages/menu-page.tsx:53`; reset state via `useEffect([item, open])` in `DrinkCustomizerModal.tsx`; pass real order status into `StitchOrderSuccessNew` (`src/pages/order-success.tsx:144-160`) and fix `ThreeRingOverlay` resize listener cleanup (`StitchOrderSuccessNew-tracking.tsx:99`).
3. **Single Unified Shell & Navigation Fix:**
   - Synchronize `SHELL_ROUTES` in `src/components/stitch/shell-config.ts` and `CustomerShell.tsx` so routes with their own headers/navs or `MD3AppShell` never stack two top bars or two bottom navbars simultaneously.
   - Fix 404 bottom-nav links (`/orders` -> `/track-order`, `/profile` -> `/account`) in `StitchTrackOrderNew-bottom-nav.tsx:29,39` and `StitchAccountDashNew-footer.tsx:59,64,69`.
   - Fix `SWUpdatePrompt.tsx:48` so "Để sau" calls `setDismissed(true)` instead of `window.location.reload()`.
4. **Master Logo Unclipped in Shell & Nav:** Replace `rounded-full ... object-cover` with `rounded-xl ... object-contain p-0.5` in `src/components/md3/md3-app-shell.tsx:82-89` and `src/components/stitch/StitchLandingNew-nav.tsx:71-78`.
5. **WCAG 2.1 AA & Touch Targets (>=44px):**
   - Add `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `Escape` handler to `DrinkCustomizerModal.tsx`, `ItemDetailDrawer.tsx`, and `ChatWidget.tsx`.
   - Add `inert={!drawerOpen || undefined}` and `aria-hidden={!drawerOpen}` to `StitchLandingNew-nav.tsx:163`.
   - Add `role="button" tabIndex={0} onKeyDown` to `zone-selector.tsx:42` and `gallery-new/index.tsx:207`.
   - Add `aria-label` to icon-only buttons and expand sub-44px mobile controls (`DrinkCustomizerModal`, `StitchCheckoutNew-order-summary`, `StitchMenuNew-search-bar`, `StitchMobileOrderNew-header`, `StitchTrackOrderNew-top-bar`) to `min-h-[44px] min-w-[44px]`.
   - Add `pb-[env(safe-area-inset-bottom)]` to `MD3NavigationBar` and `CartBottomBar`.

## Related Code Files
- **Files to Modify:**
  - `src/components/md3/md3-app-shell.tsx`
  - `src/components/md3/md3-navigation-bar.tsx`
  - `src/components/md3/md3-top-app-bar.tsx`
  - `src/components/stitch/CustomerShell.tsx`
  - `src/components/stitch/shell-config.ts`
  - `src/components/stitch/StitchLandingNew-nav.tsx`
  - `src/components/stitch/StitchMenuNew-header.tsx`
  - `src/components/stitch/StitchMenuNew-search-bar.tsx`
  - `src/components/stitch/StitchMenuNew-menu-card.tsx`
  - `src/components/stitch/StitchTrackOrderNew-top-bar.tsx`
  - `src/components/stitch/StitchTrackOrderNew-bottom-nav.tsx`
  - `src/components/stitch/StitchOrderTrackingNew.tsx`
  - `src/components/stitch/StitchOrderSuccessNew-tracking.tsx`
  - `src/components/stitch/StitchAccountDashNew.tsx`
  - `src/components/stitch/StitchAccountDashNew-orders.tsx`
  - `src/components/stitch/StitchAccountDashNew-footer.tsx`
  - `src/components/stitch/StitchCheckoutNew-field.tsx`
  - `src/components/stitch/StitchCheckoutNew-order-summary.tsx`
  - `src/components/stitch/StitchMobileOrderNew-header.tsx`
  - `src/components/menu/DrinkCustomizerModal.tsx`
  - `src/components/menu/ItemDetailDrawer.tsx`
  - `src/components/cart/cart-bottom-bar.tsx`
  - `src/components/chat/ChatWidget.tsx`
  - `src/components/chat/LiveChatWidget.tsx`
  - `src/components/pwa/SWUpdatePrompt.tsx`
  - `src/pages/menu-page.tsx`
  - `src/pages/order-success.tsx`
  - `src/pages/TableOrder.tsx`
  - `src/pages/TableOrder-components.tsx`
  - `src/pages/stitch/track-order/index.tsx`
  - `src/pages/stitch/reservation-new/zone-selector.tsx`
  - `src/pages/stitch/gallery-new/index.tsx`

## Implementation Steps
1. Fix `md3-app-shell.tsx:82-89`, `md3-top-app-bar.tsx:51-57`, `md3-navigation-bar.tsx:46,78`, and `StitchLandingNew-nav.tsx:71-78,163` (unclip logo, fix `aria-label`, add safe-area inset, add `inert` when mobile drawer is closed).
2. Align `shell-config.ts` and `CustomerShell.tsx` route config so `hasM3NavBar` matches `CustomerShell` and duplicate headers/bottom bars are suppressed when rendered inside `CustomerShell`.
3. Fix 100x VND division in `src/pages/stitch/track-order/index.tsx:58,65` and `src/components/stitch/StitchAccountDashNew-orders.tsx:56,76`, plus wire `onCheckout` in `src/pages/menu-page.tsx:53`.
4. Fix `DrinkCustomizerModal.tsx` state reset (`useEffect` on `[item, open]`), dialog ARIA attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`), Escape key handler, and 44x44px touch targets.
5. Fix `SWUpdatePrompt.tsx:48` dismiss action, `ThreeRingOverlay` resize listener cleanup in `StitchOrderSuccessNew-tracking.tsx:99`, and WCAG AA attributes (`role="dialog"`, `aria-label`, `htmlFor`/`id`, `min-h-[44px] min-w-[44px]`) across remaining customer components.

## Todo List
- [x] Fix 100x VND price division on Track Order and Account Reorder
- [x] Fix `CustomerShell` / `shell-config.ts` mismatch and eliminate duplicate headers/bottom navs
- [x] Unclip Master Logo in `md3-app-shell.tsx` and `StitchLandingNew-nav.tsx`
- [x] Reset `DrinkCustomizerModal` state on item change and add `role="dialog"`, `aria-modal="true"`, Escape key
- [x] Fix `SWUpdatePrompt.tsx` dismiss button and `ThreeRingOverlay` resize listener leak
- [x] Add `aria-label`, keyboard support, and `>=44px` touch targets to customer controls

## Success Criteria
- Prices on `/track-order` and `/account` Reorder display in VND (`45.000₫`), not `$450.00`.
- `DrinkCustomizerModal` resets state when switching items and closes on `Escape`.
- Closed drawers (`StitchLandingNew-nav`, `drawer.tsx`) have `inert` and `aria-hidden="true"`.

## Risk Assessment
- **Risk:** Unit tests for `DrinkCustomizerModal` or `StitchTrackOrderNew` may assert specific DOM roles or props.
- **Mitigation:** Preserve existing prop interfaces and add backward-compatible defaults.

## Security Considerations
- No sensitive data exposed; remove external Three.js script leak on unmount.

## Next Steps
- Verify in Phase 05 with Vitest.
