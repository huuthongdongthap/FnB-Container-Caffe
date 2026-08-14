---
phase: 0
title: "Regression Snapshot — POST /api/orders Response Shape"
status: pending
priority: P0
effort: "2h"
dependencies: []
---

# Phase 0: Regression Snapshot — Freeze Response Shape

## Overview
Before touching `create-order.ts`, freeze the current `POST /api/orders` response shape in a snapshot test. This is the prerequisite for all subsequent phases — without it, "preserve response shape" is unverifiable.

## Requirements
- Functional: Capture every key in the `order` object returned by `POST /api/orders`
- Non-functional: Test must pass before Phase 1 starts, fail if any key is removed/renamed

## Related Code Files
- Modify: `worker/src/__tests__/routes/orders.test.ts` — add snapshot test

## Implementation Steps
1. Read the current response shape from `worker/src/tree/orders/create-order.ts:179-194`:
   ```
   {
     success: true,
     order: {
       id, status, payment_status, items, total,
       customer: { full_name, phone, address },
       customer_name, customer_phone, customer_address,
       payment_method, shipping_fee, discount, notes,
       delivery_time, table_id, created_at
     },
     message: 'Order created successfully'
   }
   ```
2. Add a test that:
   - Calls `POST /api/orders` with a minimal valid payload
   - Asserts every expected key exists in `data.order`
   - Asserts key types (string, number, object, array, null allowed)
   - Fails if any key is missing or renamed
3. Verify it passes against current code — this is the baseline

## Success Criteria
- [ ] Snapshot test enumerates ALL keys in the `order` response object
- [ ] Test passes against current `create-order.ts` (green baseline)
- [ ] If any key is removed from `create-order.ts`, test fails
- [ ] Test is in `orders.test.ts` alongside existing integration tests
