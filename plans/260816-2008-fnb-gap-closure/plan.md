# Sprint 24 — F&B Gap Closure Plan

**Date:** 2026-08-16 | **Branch:** main | **Goal:** Close top gaps vs F&B cafe standard 2026

## Context

Deep research identified app at ~85% vs F&B standard. Top gaps to close:

## Phase 1: Persistent Cart Bottom Bar (HIGH) ✅
**Why**: Cart hidden on many pages → conversion drop. Standard F&B apps show persistent cart.
- Add `CartBottomBar` component to `src/components/cart/`
- Render in `App.tsx` (below Routes, above footer)
- Show when cart has items: total items + total price + "View Cart" CTA
- Animated slide-up entrance
- **Files**: `src/components/cart/cart-bottom-bar.tsx`, `src/App.tsx`

## Phase 2: Checkout 3-Tap Optimization (HIGH) ✅
**Why**: Current checkout flow >3 taps. F&B standard: select → customize → pay.
- Add "Quick Reorder" button on order-success page (reorder previous items)
- Add "Add to Cart" snackbar feedback (currently no visual feedback)
- Streamline checkout: remove unnecessary confirmations
- **Files**: `src/pages/order-success.tsx`, `src/hooks/stores/use-cart-store.ts`

## Phase 3: Web Push Notifications (HIGH) ✅
**Why**: No order status push → customer must poll. Critical for F&B operations.
- Register service worker push subscription in `use-auth-store.ts`
- Add push notification handler for order status changes
- Add notification preferences in account page
- **Files**: `src/lib/push-notifications.ts`, `src/pages/account/index.tsx`, worker push route

## Phase 4: Apple Pay / Google Pay (MEDIUM) ✅
**Why**: One-tap payment = conversion booster. Missing payment diversity.
- Add Payment Request API integration in payment flow
- Detect browser support, show Apple Pay / Google Pay buttons when available
- **Files**: `src/pages/checkout.tsx`, `src/components/payment/`

## Phase 5: Order Prep Time Display (MEDIUM) ✅
**Why**: Customers want estimated wait time. Standard in F&B apps.
- Add `estimated_prep_time` field to menu items (backend)
- Display on menu card and checkout
- Show countdown on track-order page
- **Files**: `src/components/menu/menu-card.tsx`, `src/pages/track-order/`

## Phase 6: KDS Multi-Station Routing (MEDIUM) ✅
**Why**: Kitchen display doesn't route to specific stations (espresso/food/pastry).
- Add station filter tabs to KDS page
- Color-code by station type
- **Files**: `src/pages/mobile/kitchen-display.tsx`

## Phase 7: Personalized Recommendations (LOW) ✅
**Why**: "You might also like" increases average order value.
- Add recommendation section to menu page (based on order history)
- Simple collaborative filtering: "Customers who ordered X also ordered Y"
- **Files**: `src/pages/menu.tsx`, `src/hooks/stores/use-order-store.ts`

## Execution Order

```
Phase 1 (Cart Bar) → Phase 2 (3-Tap) → Phase 4 (Payments)
Phase 3 (Push) → Phase 6 (KDS)
Phase 5 (Prep Time) → Phase 7 (Recommendations)
```

Phases 1-2 + 3 + 5 can run in parallel.

## Verification
1. `npx tsc --noEmit` — zero errors
2. `npx vitest run` — all tests pass
3. `npx vite build --mode production` — successful build
4. Deploy + verify on live site
