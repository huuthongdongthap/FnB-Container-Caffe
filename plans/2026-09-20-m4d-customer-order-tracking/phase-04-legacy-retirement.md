# Phase 04: Legacy Endpoint Retirement & Cleanup

## Overview
- **Goal:** Retire the unauthenticated legacy `GET /api/orders/:id` and phone-based `GET /api/orders/my-orders` from `orders-hono-handlers/query-handlers.ts`, allowing all customer-facing order reads to resolve through the OpenAPI router and `resolveCustomerScope()`.
- **Status:** COMPLETED (2026-09-29)
- **Dependency:** Phases 02 and 03 (all frontend consumers migrated).

## Current Issue & Threat Model
In `worker/src/routes/orders-hono-handlers/query-handlers.ts`:
1. `app.get('/:id', ...)`:
   - Queries `SELECT * FROM orders WHERE id = ?`
   - Has **NO authentication**
   - Returns full internal order record (including customer phone, staff notes, internal totals)
   - Contradicts the IDOR-scoped `openApiOrdersRouter` handler which requires a matching customer JWT
   - Because `app.route('/api/orders', ordersHonoRouter)` is mounted at `worker/src/index.ts:227` *before* `openApiApp` (L377), any `GET /api/orders/:id` hits the insecure legacy handler instead of OpenAPI!
2. `app.get('/my-orders', ...)`:
   - Queries by `customer_phone` rather than `customer_id`
   - Returns `items` as unprojected JSON string

## Tasks
1. **Reconcile `worker/src/routes/orders-hono-handlers/query-handlers.ts`:**
   - Remove `app.get('/my-orders', ...)` completely (replaced by canonical `GET /api/orders`).
   - Remove `app.get('/:id', ...)` from `ordersHonoRouter` so `GET /api/orders/:id` flows to `openApiOrdersRouter.openapi(OrderRoutes.get, ...)`.
   - If admin dashboard needs `GET /api/orders`, either:
     - Keep `app.get('/', ...)` with `requireAuth(['owner', 'manager', 'staff'])`
     - Or deprecate in favor of canonical `openApiOrdersRouter.openapi(OrderRoutes.list, ...)`.
2. **Mount Order Verification:**
   - Verify in `worker/src/index.ts` that route resolution for `/api/orders/:id` and `/api/orders` reaches `openApiOrdersRouter` for authenticated guest/staff sessions.
3. **Verify Pure Core / Domain Boundaries:**
   - Ensure `@aura/domain-order` and `formatCustomerOrder()` mappers remain pure.

## Security & Verification
- Verify that calling `GET /api/orders/:id` without Authorization header returns 401.
- Verify that calling `GET /api/orders/:id` with Customer A's token for Customer B's order returns 404 (IDOR prevention via `resolveCustomerScope`).
- Verify that calling `GET /api/orders/:id` with matching token returns 200 with `CustomerOrderResponse` (no staff/procurement fields).

## Success Criteria
- Insecure legacy handlers eliminated.
- IDOR boundary 100% enforced across all order read paths.
- All existing tests pass.