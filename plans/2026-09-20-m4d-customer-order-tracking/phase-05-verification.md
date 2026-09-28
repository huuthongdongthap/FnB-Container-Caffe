# Phase 05: Verification & Acceptance Tests

## Overview
- **Goal:** Verify the entire M4-D milestone against real endpoints, tests, and type checking.
- **Status:** PENDING
- **Dependency:** Phases 01-04.

## Tasks
1. **Type Check:** `npx tsc --noEmit` → 0 errors
2. **Unit/Integration Tests:** `npx vitest run` → all pass
3. **Add Contract Tests:**
   - `tests/m4d-customer-order-projection.test.ts`:
     - GET `/api/orders/:id` without auth → 401
     - GET `/api/orders/:id` with foreign customer token → 404 (assert `resolveCustomerScope` fail-closed)
     - GET `/api/orders/:id` with matching token → 200 + `CustomerOrderResponse` shape
     - Assert absence of `customer_phone`, `customer_name`, `source`, `locationId`, `payments`, `margin_percent`, `server_staff_id`
   - `tests/m4d-order-history.test.ts`:
     - GET `/api/orders` with customer token → only that customer's orders
     - Assert items are `CustomerOrderItem[]` (not JSON string)
4. **Frontend Verification:**
   - TrackOrder page renders `orderNumber`, status timeline, line items, `totalAmount`
   - Account dashboard renders order history list with `items[0].name`
   - OrderSuccess page renders from canonical DTO
5. **State Synchronization:** Update `.ai/state/progress.md` and `.ai/state/decisions.md` (D-12: Customer Order Reads Unified on Canonical OpenAPI Projection).

## Success Criteria
- All tests green; no regression in M4-C canonical contracts.
- No IDOR surface remains.
- Docs/state updated.