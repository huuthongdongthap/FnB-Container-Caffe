# Phase 02: Promotions `/redeem` & Order Transition Test Alignment

## Context Links
- [Brainstorm Report](../reports/brainstorm-261030-full-monorepo-typecheck-and-test-suite-zero-failure-convergence.md)
- `tests/promotions.test.ts`
- `worker/src/__tests__/tree/orders/update-order.test.ts`

## Overview
- **Priority:** P1
- **Current Status:** Complete
- **Description:** Align `tests/promotions.test.ts` and `worker/src/__tests__/tree/orders/update-order.test.ts` with the hardened order-existence check on `POST /api/promotions/redeem` and the unpaid-delivery kitchen gate on `confirmed → preparing`.

## Key Insights
- `worker/src/routes/promotions-handlers/validation-handlers.ts:261-269` queries `SELECT id, tenant_id, status FROM orders WHERE id = ? LIMIT 1` before redeeming a promo code. `tests/promotions.test.ts` `createMockD1` only seeded `promotions` and `promotion_redemptions`, causing `orders` lookup to return `null` (`404 Order not found`).
- `packages/domain/order/policies/order-status-transition.ts:58-74` queries `SELECT order_type, payment_status FROM orders WHERE id = ? AND tenant_id = ?` when `targetStatus === 'preparing'`. In `worker/src/__tests__/tree/orders/update-order.test.ts:104-112`, the positional `makeDB` queue lacked a chain for this `SELECT`, shifting the `UPDATE` call onto a chain with `changes: 0` (`409`).

## Requirements
- **Functional:**
  - Seed default test orders (`ord_1`, `ord_2`, `o1`) in `tests/promotions.test.ts` `createMockD1` and add an explicit test verifying `404` when `order_id` does not exist in `orders`.
  - Add the `SELECT order_type, payment_status` chain to `confirmed → preparing` in `worker/src/__tests__/tree/orders/update-order.test.ts` and add a test verifying `409` when an unpaid `delivery` order transitions to `preparing`.
- **Non-Functional:**
  - Do not weaken `validation-handlers.ts` or `order-status-transition.ts`.

## Related Code Files
- Modify: `tests/promotions.test.ts`
- Modify: `worker/src/__tests__/tree/orders/update-order.test.ts`

## Implementation Steps
1. Update `createMockD1` in `tests/promotions.test.ts` to include `orders: [...(seedData.orders || [{ id: 'ord_1', tenant_id: 'default', status: 'pending' }, { id: 'ord_2', tenant_id: 'default', status: 'pending' }, { id: 'o1', tenant_id: 'default', status: 'pending' }])]`, and add a test for non-existent `order_id` returning `404`.
2. Update `allows valid transition: confirmed → preparing` in `worker/src/__tests__/tree/orders/update-order.test.ts` to include the `SELECT order_type, payment_status` chain, and add a test for unpaid `delivery` order rejection (`409`).

## Todo List
- [ ] Update `tests/promotions.test.ts` `createMockD1` and add non-existent order `404` test
- [ ] Update `worker/src/__tests__/tree/orders/update-order.test.ts` `confirmed → preparing` chain and add unpaid delivery `409` test

## Success Criteria
- `npx vitest run tests/promotions.test.ts worker/src/__tests__/tree/orders/update-order.test.ts` passes with 0 failures.
