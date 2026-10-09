# Master Audit Plan: Consolidate `/api/orders` Runtime Ownership

**Date:** 2026-10-06  
**Pipeline:** `/audit:plan` (`risk-rank` → `select-audits` → `allocate-resources`)  
**Scope:** Cloudflare Worker Order Routers (`worker/src/routes/`), Domain Engine (`packages/domain/order/`), OpenAPI Contracts  
**Goal:** Consolidate `/api/orders` into one runtime owner, audit route precedence first, keep guest checkout viable, retire/shadow-proof duplicate create/update handlers, preserve existing GET/KDS/payment flows, and guarantee zero parallel order creation paths.  
**Status:** **APPROVED & READY FOR EXECUTION**  

---

## 1. Executive Summary & Routing Topography

### Current Dispersed Architecture (4 Parallel Owners)

In `worker/src/index.ts` and `worker/src/routes/openapi.ts`, four distinct routers declare routes overlapping `/api/orders`:

```text
Incoming HTTP Request
   │
   ├─▶ [Line 75] app.route('/api/orders', ordersCoreRouter)
   │     ├─ POST  /api/orders         (createOrder domain command)
   │     ├─ POST  /api/orders/sync    (offline cart sync + KV idempotency)
   │     ├─ POST  /api/orders/split   (split bill calculation)
   │     ├─ GET   /api/orders/latest  (latest timestamp query)
   │     └─ PATCH /api/orders/:id     (updateOrder domain command)
   │
   ├─▶ [Line 76] app.route('/api/orders', ordersHonoRouter)
   │     ├─ GET   /api/orders/kds              (KDS dashboard orders)
   │     ├─ PATCH /api/orders/:id/status       (status transitions + KV signal)
   │     ├─ PATCH /api/orders/:id/mark-cod-paid (COD payment collection)
   │     ├─ POST  /api/orders/checkout         (staff POS checkout [PARALLEL WRITE])
   │     ├─ POST  /api/orders/guest-checkin    (QR table seating + placeholder)
   │     └─ POST  /api/orders/guest-checkout   (guest direct checkout [PARALLEL WRITE])
   │
   ├─▶ [Line 77] app.route('/api/orders', orderStreamRouter)
   │     └─ GET   /api/orders/:id/events (SSE stream with KV polling)
   │
   └─▶ [Line 98] app.route('/', openApiOrdersRouter)
         ├─ [GLOBAL MIDDLEWARE] requireAuth(['owner', 'manager', 'staff', 'customer'])
         ├─ GET   /api/orders         (order list with scoped customer projection)
         ├─ GET   /api/orders/:id     (single order read with scoped projection)
         ├─ GET   /api/orders/summary (order statistics summary)
         ├─ POST  /api/orders         (OpenAPI create [SHADOWED PARALLEL WRITE])
         ├─ PATCH /api/orders/:id     (OpenAPI update [SHADOWED PARALLEL WRITE])
         └─ POST  /api/orders/:id/cancel (order cancellation)
```

---

## 2. Phase 1: Risk-Rank (`rank`)

### Failure Modes & Threat Matrix

| Risk ID | Domain / Component | Failure Mode / Threat Scenario | Impact (1-5) | Likelihood (1-5) | Risk Score | Exposure | Priority |
|:---|:---|:---|:---:|:---:|:---:|:---|:---:|
| **R-01** | **Guest Checkout Lockout** | Global `requireAuth` on `/api/orders/*` intercepting QR table guests, resulting in `401 Unauthorized` for diners scanning QR codes without login. | 5 | 3 | **15** | Public Table Diners | **CRITICAL** |
| **R-02** | **Split-Brain Order Creation** | Parallel write paths (`/orders`, `/orders/checkout`, `/orders/guest-checkout`, OpenAPI write) diverging on pricing, inventory deduction, and DO events. | 5 | 3 | **15** | Revenue Path | **CRITICAL** |
| **R-03** | **Route Shadowing / Dead Handlers** | Hono route registration order causing handlers in downstream routers to be silently shadowed or never executed. | 4 | 3 | **12** | Core API Gateway | **HIGH** |
| **R-04** | **IDOR Data Leakage on Reads** | Insecure order listing or detail endpoints exposing other customers' PII or staff-only order records. | 4 | 2 | **8** | Customer REST API | **HIGH** |
| **R-05** | **SSE Connection Drop / Auth Failure** | EventSource clients connecting to `/api/orders/:id/events` blocked by JWT requirements or route precedence confusion. | 3 | 2 | **6** | Realtime Web Client | **MEDIUM** |
| **R-06** | **KDS State Transition Breakage** | Broken status transitions (`/status`, `/mark-cod-paid`) on KDS screen disrupting kitchen workflow. | 4 | 1 | **4** | Kitchen Display Screen | **MEDIUM** |

---

## 3. Phase 2: Select-Audits & Single Owner Architecture (`select`)

### Audit Decisions & Invariants

1. **Establish Single Canonical Runtime Owner**:
   - Create a unified orders router `ordersUnifiedRouter` in `worker/src/routes/orders-unified.ts` (or consolidate directly in `orders-core.ts`).
   - In `worker/src/index.ts`, replace the three separate mounts with one single mount:
     ```typescript
     app.route('/api/menu', customerMenuRouter);
     app.route('/api/orders', ordersUnifiedRouter);
     ```
   - In `worker/src/index.ts:80-82`, preserve KDS route alias:
     ```typescript
     app.use('/api/kds/orders/*', requireAuth(['owner', 'staff']));
     app.route('/api/kds/orders', ordersUnifiedRouter);
     app.route('/api/kds/orders', kdsStreamRouter);
     ```

2. **Strict Route Precedence Matrix inside `ordersUnifiedRouter`**:
   Order of handler registration matters fundamentally in Hono. Registration MUST proceed from most specific to least specific:
   - **Step A: Realtime SSE Stream**
     - `GET /:id/events` — Unauthenticated SSE stream (handles `Last-Event-ID` reconnection).
   - **Step B: Guest QR Diners (NO AUTH REQUIRED)**
     - `POST /guest-checkin` — Unauthenticated QR check-in & table seating (rate-limited).
     - `POST /guest-checkout` — Unauthenticated QR checkout, unified to call canonical creation logic.
   - **Step C: Canonical Order Creation & Offline Sync**
     - `POST /` — Public/Guest order creation via `createOrder` (rate-limited, server price evaluation, KV idempotency).
     - `POST /sync` — Offline order batch sync (`order:idempotency:offline:${localId}`).
     - `POST /split` — Bill splitting calculation.
     - `GET /latest` — Latest order timestamp.
   - **Step D: KDS & Kitchen Operations (STAFF AUTH)**
     - `GET /kds` — Kitchen board query (`requireAuth(['owner', 'staff'])`).
     - `PATCH /:id/status` — Status transition (`requireAuth(['owner', 'staff'])`).
     - `PATCH /:id/mark-cod-paid` — COD collection (`requireAuth(['owner'])`).
     - `POST /checkout` — POS staff checkout (`requireAuth(['owner', 'staff'])`).
   - **Step E: Order Reads & Customer Queries (SCOPED AUTH)**
     - `GET /summary` — Order revenue & status statistics (`requireAuth(['owner', 'manager', 'staff'])`).
     - `GET /` — Paginated order list with `resolveCustomerScope()` projection (`requireAuth(['owner', 'manager', 'staff', 'customer'])`).
     - `GET /:id` — Single order detail with `resolveCustomerScope()` projection (`requireAuth(['owner', 'manager', 'staff', 'customer'])`).
   - **Step F: Updates & Cancellation (SCOPED AUTH)**
     - `PATCH /:id` — Order field update via `updateOrder` domain command (`requireAuth(['owner', 'staff', 'customer'])`).
     - `POST /:id/cancel` — Order cancellation with state machine transition (`requireAuth(['owner', 'staff', 'customer'])`).

3. **Retire / Shadow-Proof Duplicate Create Handlers**:
   - In `openApiOrdersRouter` (`order-write-handlers.ts`):
     - Remove the parallel raw SQL `INSERT INTO orders` that bypassed `createOrder`.
     - Wire `OrderRoutes.create` to delegate to `createOrder` or retire direct binding in favor of the canonical domain command.
     - Eliminate blanket wildcard `openApiOrdersRouter.use('/api/orders/*')` that endangered guest checkout.
   - In `checkout-handlers.ts` & `guest-handlers.ts`:
     - Standardize order records to ensure consistent schema invariants (`items` JSON, `total_amount`, inventory deduction, DO broadcast).

4. **Preserve Guest Checkout Viability**:
   - `POST /api/orders`, `POST /api/orders/guest-checkin`, `POST /api/orders/guest-checkout`, and `GET /api/orders/:id/events` MUST remain accessible without JWT Bearer tokens.
   - Table QR guests can check in, place orders, and receive live status updates without an account.

---

## 4. Phase 3: Allocate-Resources & Execution Plan (`allocate`)

### Task Work Breakdown

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Task 1: Route Precedence Audit & Specification                          │
│ File: reports/audit/plan/order-route-consolidation-audit.md            │
├─────────────────────────────────────────────────────────────────────────┤
│ Task 2: Create Canonical Unified Orders Router                          │
│ File: worker/src/routes/orders-unified.ts                               │
│ Delegates: orders-core, kds-handlers, guest-handlers, order-read        │
├─────────────────────────────────────────────────────────────────────────┤
│ Task 3: Shadow-Proof & De-Duplicate Write Handlers                      │
│ Files: worker/src/routes/openapi-orders-handlers/routes.ts              │
│        worker/src/routes/openapi-orders-handlers/order-write-handlers.ts│
├─────────────────────────────────────────────────────────────────────────┤
│ Task 4: Mount Unified Router in Gateway                                 │
│ File: worker/src/index.ts                                               │
├─────────────────────────────────────────────────────────────────────────┤
│ Task 5: Automated Regression & Verification Gates                       │
│ Suites: order-lifecycle-e2e, orders-hono, openapi-orders, vitest        │
│ Commands: npm test → npm run typecheck:all → npm run lint               │
└─────────────────────────────────────────────────────────────────────────┘
```

### Verification Gates & Acceptance Criteria

1. **Test Gate**: All existing order tests (11 tree test suites, 51 worker route test suites, 413+ tests) pass with 100% green.
2. **Typecheck Gate**: `npm run typecheck:all` (frontend + worker) returns 0 errors.
3. **Lint Gate**: `npm run lint` passes with 0 errors and 0 warnings.
4. **Single Owner Proof**: In `worker/src/index.ts`, exactly ONE router is mounted at `/api/orders`.
5. **Guest Checkout Proof**: `POST /api/orders`, `POST /api/orders/guest-checkin`, and `POST /api/orders/guest-checkout` succeed with 200/201 without Authorization headers.
6. **No Parallel Creation Paths**: All order creation routes flow through the canonical pricing and domain persistence logic.
