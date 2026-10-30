# Phase 03: Delivery PayOS-Prepaid Policy Test Convergence

## Context Links
- [Brainstorm Report](../reports/brainstorm-261030-full-monorepo-typecheck-and-test-suite-zero-failure-convergence.md)
- `worker/src/__tests__/lib/validators.test.ts`
- `worker/src/__tests__/integrations/order-persistence-tamper-schema.test.ts`
- `worker/src/__tests__/routes/orders-snapshot.test.ts`

## Overview
- **Priority:** P1
- **Current Status:** Complete
- **Description:** Align the 3 legacy delivery order test fixtures with the `createOrderSchema` business rule requiring `payment_method: 'payos'` for `order_type: 'delivery'`, and add an explicit negative test for `delivery` + `cod`.

## Key Insights
- `worker/src/lib/validators/order.ts:49-55` enforces `if (data.order_type === 'delivery' && data.payment_method !== 'payos')` → `'Đơn giao tận nơi yêu cầu thanh toán trả trước qua PayOS'`.
- Three tests constructed `delivery` orders before this refinement was added and still pass `payment_method: 'cod'`.

## Requirements
- **Functional:**
  - In `worker/src/__tests__/lib/validators.test.ts`, pass `payment_method: 'payos'` in `accepts delivery order when customer_address is provided`, and add `rejects delivery order when payment_method is not payos`.
  - In `worker/src/__tests__/integrations/order-persistence-tamper-schema.test.ts`, pass `payment_method: 'payos'` in `persists guest checkout using canonical orders and order_items schema`.
  - In `worker/src/__tests__/routes/orders-snapshot.test.ts`, pass `payment_method: 'payos'` in `createOrder — response shape snapshot` and update the expected `payment_method` assertion to `'payos'`.
- **Non-Functional:**
  - Preserve `createOrderSchema` delivery PayOS-prepaid enforcement untouched.

## Related Code Files
- Modify: `worker/src/__tests__/lib/validators.test.ts`
- Modify: `worker/src/__tests__/integrations/order-persistence-tamper-schema.test.ts`
- Modify: `worker/src/__tests__/routes/orders-snapshot.test.ts`

## Implementation Steps
1. Edit `worker/src/__tests__/lib/validators.test.ts` (`lines 154-162`) to include `payment_method: 'payos'` on the positive delivery test and add a negative test for `delivery` + `cod`.
2. Edit `worker/src/__tests__/integrations/order-persistence-tamper-schema.test.ts` (`line 141`) to use `payment_method: 'payos'`.
3. Edit `worker/src/__tests__/routes/orders-snapshot.test.ts` (`lines 60, 74`) to use `payment_method: 'payos'`.

## Todo List
- [ ] Update `worker/src/__tests__/lib/validators.test.ts`
- [ ] Update `worker/src/__tests__/integrations/order-persistence-tamper-schema.test.ts`
- [ ] Update `worker/src/__tests__/routes/orders-snapshot.test.ts`

## Success Criteria
- `npx vitest run worker/src/__tests__/lib/validators.test.ts worker/src/__tests__/integrations/order-persistence-tamper-schema.test.ts worker/src/__tests__/routes/orders-snapshot.test.ts` passes with 0 failures.
