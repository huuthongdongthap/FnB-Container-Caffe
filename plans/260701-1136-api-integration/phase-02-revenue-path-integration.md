---
phase: 2
title: "Revenue Path Integration"
status: completed
priority: P1
effort: "5h"
dependencies: [1]
---

# Phase 2: Revenue Path Integration

## Overview

Wire the 5 revenue-critical pages (Home, Menu, Checkout, OrderSuccess, OrderFailure) to real worker APIs. Users can browse menu, add to cart, place orders with COD or PayOS payment, and see order confirmations.

## Requirements

- Functional: Browse real menu data, add items to cart, create order via POST /api/orders, generate PayOS payment link via POST /api/payment/create-link, view order success/failure with real data
- Non-functional: Menu loads on mount with loading skeleton, cart persists across navigation, order creation handles validation errors, payment link opens in new tab/modal

## Architecture

```
use-menu-store.ts
  State: { items[], categories[], loading, error }
  Actions: fetchMenu(), fetchMenuItem(id), searchMenu(query)

use-order-store.ts
  State: { currentOrder, orderHistory[], loading, error }
  Actions: createOrder(cart, deliveryInfo, paymentMethod), fetchOrder(id)

use-payment-store.ts
  State: { paymentLink, loading, error }
  Actions: createPaymentLink(orderId, amount) — **requires JWT auth (Bearer token)**
  Note: Payment endpoint is /api/payment/create-link (no 's' in 'payment')

Pages wired:
  Home → HeroSection (static) + FeaturedMenu (use-menu-store)
  Menu → MenuGrid, MenuCard, MenuSearch, CategoryFilter (use-menu-store)
  Checkout → CartDrawer (use-cart-store), CheckoutForm (use-order-store + use-payment-store)
  OrderSuccess → use-order-store (read currentOrder)
  OrderFailure → use-order-store (read currentOrder, error message)
```

## Related Code Files

- Create: `src/hooks/stores/use-menu-store.ts`
- Create: `src/hooks/stores/use-order-store.ts`
- Create: `src/hooks/stores/use-payment-store.ts`
- Create: `src/hooks/stores/__tests__/use-menu-store.test.ts`
- Create: `src/hooks/stores/__tests__/use-order-store.test.ts`
- Create: `src/hooks/stores/__tests__/use-payment-store.test.ts`
- Modify: `src/components/home/featured-menu.tsx` — fetch from store
- Modify: `src/components/menu/menu-grid.tsx` — fetch from store
- Modify: `src/components/menu/menu-card.tsx` — pass real data
- Modify: `src/components/menu/menu-search.tsx` — call store search
- Modify: `src/components/order/cart-drawer.tsx` — pass real cart data
- Modify: `src/components/order/checkout-form.tsx` — wire createOrder + createPaymentLink
- Modify: `src/pages/home.tsx` — pass store data
- Modify: `src/pages/menu.tsx` — pass store data
- Modify: `src/pages/checkout.tsx` — wire full flow
- Modify: `src/pages/order-success.tsx` — display real order
- Modify: `src/pages/order-failure.tsx` — display real error

## Implementation Steps

### TDD: Write tests first

1. **`use-menu-store.test.ts`**
   - `fetchMenu()`: populates items[] and categories[], loading=false
   - `fetchMenu()`: sets error on network failure
   - `fetchMenuItem(id)`: returns single item by ID
   - `searchMenu(query)`: filters items by name match

2. **`use-order-store.test.ts`**
   - `createOrder()`: POST /api/orders with cart + delivery → returns order with ID
   - `createOrder()`: sets error on validation failure (400)
   - `createOrder()`: sets error on network failure
   - `fetchOrder(id)`: GET /api/orders/:id → populates currentOrder
   - `fetchOrder(id)`: sets error on 404

3. **`use-payment-store.test.ts`**
   - `createPaymentLink()`: POST /api/payment/create-link (no 's' in 'payment') → returns payment URL
   - `createPaymentLink()`: sets error on failure
   - `createPaymentLink()`: requires auth token — sets error with redirect hint if no token

### Implement

4. Create `use-menu-store.ts` — Zustand store, fetches GET /api/menu on `fetchMenu()`, caches items + categories in state

5. Create `use-order-store.ts` — Zustand store, `createOrder()` POSTs order data, stores response in `currentOrder`, `fetchOrder(id)` for tracking

6. Create `use-payment-store.ts` — Zustand store, `createPaymentLink()` POSTs to PayOS, returns checkout URL

7. Wire featured-menu.tsx — import `useMenuStore`, call `fetchMenu()` in useEffect, display first 4 items as featured

8. Wire menu-grid.tsx + menu-card.tsx + menu-search.tsx — import `useMenuStore`, populate grid from store, search calls `searchMenu()`, category filter from store.categories

9. Wire checkout-form.tsx — import `useOrderStore` + `usePaymentStore`, on submit:
   - Validate cart is NOT empty (disable submit when 0 items, show "Vui lòng thêm món")
   - Call `createOrder()` with cart items + delivery info
   - For PayOS: call `createPaymentLink()` with order ID (requires auth — redirect to login if unauthenticated)
   - For COD: skip payment step, go directly to success
   - Payment link failure: order exists but unpaid (acceptable — orders have status field)

10. Wire order-success.tsx + order-failure.tsx — read `useOrderStore.currentOrder`, display order ID prominently (large text, copy button), items, total, payment status. Include "Theo dõi đơn hàng" link to /track-order. Customer manually saves order ID for tracking.

### Verify

11. Run all 268 existing tests — must pass
12. New store tests — all pass
13. `npm run build` — 0 TypeScript errors

## Success Criteria

- [ ] Menu page loads real items from `/api/menu` (was: static/mock data)
- [ ] Checkout: empty cart shows disabled submit with "Vui lòng thêm món" message
- [ ] Checkout creates real order via POST /api/orders
- [ ] PayOS payment link generated via POST /api/payment/create-link (requires auth)
- [ ] COD orders skip payment step, go directly to order success
- [ ] Order success page displays real order ID + items + total
- [ ] Order failure page displays error message from API
- [ ] Loading skeletons shown while API calls in progress
- [ ] Empty state shown when menu returns no items
- [ ] Error state with retry button on API failure
- [ ] Cart persists across navigation (existing use-cart-store behavior preserved)
- [ ] 268 existing tests still pass + new store tests pass
- [ ] `npm run build` — 0 TypeScript errors
