---
phase: 2
title: "Revenue Path: Index/Menu/Checkout/Success/Failure"
status: pending
priority: P1
dependencies: [1]
effort: "10h"
---

# Phase 2: Revenue Path — Index, Menu, Checkout, Success, Failure

## Overview

Migrate 5 revenue-critical pages from static HTML (~1,780 total lines) to React components. These form the primary customer flow: Home → Menu → Checkout → Success/Failure.

**Red-team corrections:** Happy hour removed (doesn't exist in codebase). Payment methods: COD + PayOS only (MoMo/VNPay disabled). Referral: flat 10,000đ cashback. Cart: Zustand must read old `aura_cart` localStorage format from vanilla JS cart for seamless transition.

## Pages

| Page | Current | Lines | New Component |
|------|---------|-------|---------------|
| Home | `index.html` | 626 | `src/pages/Home.tsx` |
| Menu | `menu.html` | 105 | `src/pages/Menu.tsx` |
| Checkout | `checkout.html` | 318 | `src/pages/Checkout.tsx` |
| Success | `success.html` | 497 | `src/pages/OrderSuccess.tsx` |
| Failure | `failure.html` | 234 | `src/pages/OrderFailure.tsx` |

## Architecture

```
src/
├── pages/
│   ├── Home.tsx, Menu.tsx, Checkout.tsx
│   ├── OrderSuccess.tsx, OrderFailure.tsx
├── components/
│   ├── menu/
│   │   ├── MenuGrid.tsx, MenuCard.tsx, CategoryFilter.tsx, MenuSearch.tsx
│   ├── order/
│   │   ├── CartDrawer.tsx, CartItem.tsx, CheckoutForm.tsx, OrderSummary.tsx
│   │   ├── DeliveryInfo.tsx, PaymentMethodSelector.tsx (COD + PayOS only), TipInput.tsx
│   └── home/
│       ├── HeroSection.tsx, FiveZoneShowcase.tsx
│       ├── FeaturedMenu.tsx, TestimonialCarousel.tsx, LocationMap.tsx
├── hooks/
│   ├── useMenu.ts              # TanStack Query: GET /api/menu
│   ├── useCart.ts              # Zustand + old aura_cart migration layer
│   ├── useCheckout.ts          # POST /api/orders mutation
│   └── useOrder.ts             # GET /api/orders/:id
└── lib/
    └── validators.ts           # Zod schemas for checkout form
```

## Critical Cross-Layer Coordination

**PayOS return URL:** `worker/src/routes/payment.js:86-87` hardcodes `checkout.html?payment=pending`. After migration, this URL returns 404. Resolution: Phase 2 MUST implement `/checkout.html` as a redirect to `/checkout?payment=pending` (preserving query params), OR Phase 6 MUST update return URL paths in `payment.js`. Coordinate between phases.

**Cart migration:** `js/cart.js` persists to `localStorage['aura_cart']` with custom serialization. Zustand `useCart` hook MUST:
1. On first mount, attempt to read and parse `localStorage['aura_cart']` (old format)
2. If successful, hydrate Zustand store and migrate to new key `aura_cart_v3`
3. If old format not found, initialize empty

## TDD: Tests to Write First

1. `src/components/menu/__tests__/menu-grid.test.tsx` — renders items, filters by category, search, empty state
2. `src/components/menu/__tests__/menu-card.test.tsx` — name/price/description, availability badge, add-to-cart
3. `src/components/order/__tests__/cart-drawer.test.tsx` — opens/closes, items list, quantity update, total, empty state
4. `src/components/order/__tests__/checkout-form.test.tsx` — validates required fields, shows COD+PayOS options, submits order, loading state
5. `src/components/order/__tests__/payment-method-selector.test.tsx` — renders COD + PayOS only, keyboard nav, aria-checked
6. `src/components/home/__tests__/hero-section.test.tsx` — headline/CTA, water ripple animation, responsive image
7. `src/components/home/__tests__/five-zone-showcase.test.tsx` — all 5 zones, links to menu
8. `src/hooks/__tests__/use-cart.test.ts` — add/remove/quantity/total, old aura_cart format migration, free delivery threshold (300K)
9. `src/hooks/__tests__/use-checkout.test.ts` — form submission, success redirect, error handling
10. `src/lib/__tests__/validators.test.ts` — phone format (VN), delivery address required, payment method enum (cod|payos only)

## Implementation Steps

### 2.1 Menu Components
- MenuGrid + MenuCard with category filter, search, availability badges
- Wire TanStack Query to GET /api/menu with category/available/search params
- Skeleton loading states matching `fnb-shimmer` pattern

### 2.2 Cart + Checkout
- Zustand cart store with old `aura_cart` migration layer
- CartDrawer slide-in with item list, quantity controls, total
- CheckoutForm: delivery info, payment method (COD + PayOS only), tip, notes
- Zod validation matching existing backend API contract
- Free delivery threshold (300K VND) — verify this exists in backend before implementing

### 2.3 Home Page
- HeroSection with water ripple animation (ported from index.html)
- FiveZoneShowcase: Jade Counter / Sky Deck / Noir Cabin / Aura Lounge / VIP Steel Nest
- FeaturedMenu grid (top 6 items from API)
- TestimonialCarousel
- LocationMap with Google Maps embed

### 2.4 Success/Failure Pages
- OrderSuccess: order ID, items summary, estimated time, loyalty points earned, share CTA
- OrderFailure: error message, retry CTA, support contact

### 2.5 Checkout.html Redirect
- Implement `/checkout.html` → `/checkout` redirect with query param preservation
- This is a temporary bridge until Phase 6 updates PayOS return URLs

## Success Criteria

- [ ] All 10 TDD test files written and passing
- [ ] All 5 pages render at 375/768/1024/1440 breakpoints
- [ ] Menu: category filter, search, add-to-cart functional
- [ ] Checkout: form validates, submits to API, redirects on success
- [ ] Cart: add/remove/quantity/total/free-delivery-threshold correct
- [ ] Old aura_cart → new Zustand cart migration works (integration test)
- [ ] Home: water ripple animation works, 5 zones clickable
- [ ] PaymentMethodSelector: COD + PayOS only, keyboard accessible
- [ ] checkout.html → /checkout redirect functional
- [ ] 0 TypeScript errors, 0 lint errors
- [ ] API contract matches existing Cloudflare Worker responses

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| PayOS return URL breaks revenue path | Implement checkout.html redirect; coordinate with Phase 6 |
| Cart state lost during old→new transition | Dual-read migration layer; integration test with real old cart data |
| Water ripple animation port fails | Extract as standalone canvas component; CSS animation fallback |
| Free delivery threshold may not exist in backend | Grep backend before implementing; remove from scope if absent |
