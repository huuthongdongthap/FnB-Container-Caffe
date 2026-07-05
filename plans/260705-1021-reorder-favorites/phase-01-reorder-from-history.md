---
phase: 1
title: "Reorder from History"
status: pending
priority: P2
dependencies: []
---

# Phase 1: Reorder from History

## Overview

Add a "Reorder" button to past orders in the account dashboard. Clicking it populates the cart with all items from that order and navigates to checkout.

## Architecture

Data flow:
1. useAccount() hook fetches GET /api/orders/my-orders
2. Each OrderSummary has items: string (JSON stringified array of name, price, quantity)
3. Reorder button -> cartStore.clearCart() -> for each item cartStore.addItem() -> navigate('/checkout')

OrderSummary.items is typed as string in use-account.ts. Parse with JSON.parse().

## Related Code Files

- Modify: src/components/stitch/StitchAccountDashNew.tsx (add Reorder button)
- Read: src/hooks/use-account.ts (OrderSummary type)
- Read: src/hooks/stores/use-cart-store.ts (addItem API)

## Implementation Steps

1. Read StitchAccountDashNew.tsx for order list render
2. Add Reorder button (text variant) next to each order
3. handleReorder(order): clearCart() -> JSON.parse(order.items) -> addItem() -> navigate('/checkout')
4. Add i18n keys for "Reorder" label
5. Handle empty items / parse error gracefully

## Success Criteria

- [ ] Reorder button on all past orders with items
- [ ] Click reorder clears cart and adds items from order
- [ ] User lands on checkout after reorder
- [ ] Orders with empty items show no reorder button
- [ ] i18n en + vi
- [ ] Build 0 TS errors
- [ ] Tests 1,091+ passing
