# Refactor Log — Order Routes & OpenAPI Consolidation

**Date:** 2026-10-07  
**Layer:** Dev Refactor (`/dev:refactor`)  
**Scope:** Order Routing, OpenAPI Route Precedence, and Guest Checkout Viability  

## 1. Objectives & Context
Consolidate runtime ownership of `/api/orders` into `ordersUnifiedRouter` and ensure that:
1. `ordersUnifiedRouter` remains the single authoritative runtime owner mounted at `/api/orders`.
2. Static literal routes strictly precede parameterized routes (`/guest-checkin`, `/guest-checkout`, `/summary`, `/kds`, `/sync`, `/split`, `/latest` before `/:id`).
3. OpenAPI sub-router auth middleware (`openApiOrdersRouter.use('/api/orders')`) eliminates blanket auth locking on `POST /api/orders` to safeguard unauthenticated QR table diners and guest checkout.
4. Zero parallel order creation paths diverged in runtime handling.

## 2. Refactoring Changes Made

### A. OpenAPI Orders Scoped Auth Refinement
- **File:** `worker/src/routes/openapi-orders-handlers/routes.ts`
- **Change:** Refined `/api/orders` route middleware in `openApiOrdersRouter`:
  ```typescript
  // Scoped auth middleware for OpenAPI schema documentation / endpoints
  openApiOrdersRouter.use('/api/orders/summary', requireAuth(['owner', 'manager', 'staff']));
  openApiOrdersRouter.use('/api/orders', async (c, next) => {
    // Allow unauthenticated order creation (POS guest / QR table diners)
    if (c.req.method === 'POST') {
      return next();
    }
    return requireAuth(['owner', 'manager', 'staff', 'customer'])(c, next);
  });
  openApiOrdersRouter.use('/api/orders/:id', requireAuth(['owner', 'manager', 'staff', 'customer']));
  openApiOrdersRouter.use('/api/orders/:id/*', requireAuth(['owner', 'manager', 'staff', 'customer']));
  ```
- **Rationale:** Previously, `openApiOrdersRouter.use('/api/orders', requireAuth(...))` applied unconditionally to all HTTP methods, which would reject unauthenticated `POST /api/orders` requests. The scoped check allows public `POST /api/orders` while keeping `GET /api/orders` (listing orders) properly protected.

### B. Precedence & Gateway Mounting Verification
- **File:** `worker/src/index.ts`
- **Verified:**
  - `app.route('/api/orders', ordersUnifiedRouter)` is mounted at Line 73 as the single runtime owner.
  - Downstream `app.route('/', openApiOrdersRouter)` at Line 94 does not shadow or fragment order creation or status management.
  - In `ordersUnifiedRouter`:
    * Static routes (`/guest-checkin`, `/guest-checkout`, `/sync`, `/split`, `/latest`, `/kds`, `/checkout`, `/summary`) are registered first.
    * Base creation (`POST /`) and listing (`GET /`) follow.
    * Sub-paths (`/:id/events`, `/:id/status`, `/:id/mark-cod-paid`, `/:id/cancel`) precede the generic single record routes (`GET /:id`, `PATCH /:id`).

### C. Test Suite Enhancements
- **File:** `worker/src/__tests__/routes/orders-unified.test.ts`
- **Added:** Automated assertion for unauthenticated guest order creation via `POST /api/orders`.
- **Result:** 6/6 tests passing in `orders-unified.test.ts`.
