# Phase 03: Worker Routes, Middleware & Safe ExecutionContext

## Overview
- Priority: High
- Current status: Pending
- Description: Secure worker middleware context, guard asynchronous execution context calls against harness throws, harmonize order column fallbacks, and ensure inventory handlers return dual-field responses.

## Requirements
- `staff-auth.ts` middleware must attach `tenantId` and `tier` onto context `user` state so downstream multi-tenant and tier-gating logic functions correctly.
- Background task scheduling via `c.executionCtx.waitUntil(...)` must be wrapped in safe execution helpers that prevent unhandled crashes when running in sub-requests or testing harnesses.
- Purchase order endpoints must return both `total_amount` and `total` fields to support both legacy and typed frontend consumers.
- Order listing queries must support both `total` and `total_amount` columns.
- Webhook handlers must remain atomic and resilient.

## Related Code Files
- `worker/src/middleware/staff-auth.ts`
- `worker/src/routes/webhooks-handlers/payos.ts`
- `worker/src/routes/orders.ts`
- `worker/src/routes/openapi-inventory-handlers/purchase-order-handlers.ts`
- `worker/src/routes/openapi-inventory-handlers/movement-handlers.ts`
- `worker/src/routes/tables-mobile.ts`
- `worker/src/routes/features-router.ts`

## Implementation Steps
1. In `staff-auth.ts`, preserve `tenantId` and `tier` on `c.set('user', ...)`.
2. In `payos.ts` and related webhook handlers, wrap `c.executionCtx?.waitUntil` in a try/catch helper function.
3. In `purchase-order-handlers.ts`, normalize output objects to include `total` alongside `total_amount`.
4. Add column fallbacks in `orders.ts` for order totals.
5. Ensure role validation in `tables-mobile.ts` and `features-router.ts` accurately matches domain roles.

## Success Criteria
- Zero runtime crashes when accessing execution context in test or edge environments.
- Context user data contains all multi-tenant attributes.
- Full unit test pass across all worker routes.
