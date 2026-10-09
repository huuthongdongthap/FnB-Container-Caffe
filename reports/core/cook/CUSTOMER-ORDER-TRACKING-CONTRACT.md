# Canonical Customer Order Tracking Contract Specification

**Contract Version**: 1.0.0  
**Status**: LOCKED & VERIFIED  
**Date**: 2026-10-08  
**Domain Modules**: `@aura/domain-order`, `worker/src/routes/order-stream.ts`, `worker/src/routes/order-stream-log.ts`

---

## 1. Executive Summary & Canonical Flow

The Customer Order Tracking Contract establishes a single canonical, tamper-proof, and real-time order tracking pipeline across AURA Edge Worker, Cloudflare KV, and Frontend Client Stores:

```
┌─────────────────────┐
│     ORDER STATE     │ (D1 Database: orders, order_items)
│ (Canonical Source)  │ State Machine: canTransition, canActorTransition
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     ORDER EVENT     │ Fast-path KV key: order_event:<orderId> (TTL 60s)
│  (publishOrderEvent)│ Replay buffer: order_events_log:<orderId> (TTL 3600s)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│     SSE STREAM      │ GET /api/orders/:id/events (text/event-stream)
│(handleOrderStream)  │ Replay via Last-Event-ID, poll loop, terminal cutoff
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│SPACE ORDER TRACKING │ EventSource listeners ('update_order')
│ (useOrderStore / UI)│ Customer-safe allowlist projection, zero catalog lookups
└─────────────────────┘
```

---

## 2. Customer Order Tracking Contract Rules

### 2.1 Space Reads Canonical Order State Only
- **Zero Client Mutations**: Clients (Web, Space Mobile, POS Guests) cannot directly mutate or override order status. All state changes originate from server-side order transitions (`executeKdsStatusTransition`, `handleCancelOrder`, `handleMarkCodPaid`).
- **Single Source of Truth**: Space tracking views (`useOrderStore`, `StitchTrackOrderNew`) consume updates exclusively from the SSE event stream or the canonical read endpoint (`GET /api/orders/:id`), which enforce uniform projections.

### 2.2 Customer-Safe Allowlist Projection
- **Information Leak Prevention**: Raw database rows are **never emitted directly** over SSE. The `projectCustomerOrderPayload` utility applies a strict allowlist:
  - **Included**: `id`, `orderNumber`, `status`, `paymentStatus`, `channel`, `table`, `items` (with frozen line item attributes: `name`, `quantity`, `unitPriceCents`, `subtotalCents`, `modifiers`, `notes`, `status`), `subtotal`, `discountAmount`, `taxAmount`, `totalAmount`, `notes`, `createdAt`, `updatedAt`.
  - **Excluded / Redacted**: `customer_phone`, `customer_email`, `customer_address`, staff notes, `created_by`, `staff_id`, payment secrets/raw payloads, supplier costs, and ERPNext integration metadata.

### 2.3 Strict IDOR Protection & Guest Scoping
- **Staff Roles (`owner`, `manager`, `staff`)**: Authorized to inspect all orders and order streams across the enterprise.
- **Authenticated Customers (`role: 'customer'`)**: Can access order streams only if `order.customer_id === user.id` (or if accessing an unassigned guest order they hold the explicit ID for). Attempting to access another customer's order returns HTTP 403 Forbidden.
- **Anonymous Guests**: Can track guest orders (`order.customer_id IS NULL`) using the explicit CSPRNG order identifier. If a guest attempts to access an order registered to an authenticated customer, access is rejected with HTTP 403 Forbidden (`This order belongs to a registered customer. Please sign in.`).

### 2.4 Terminal States Stop Unnecessary Streaming
- Orders reaching terminal states (`completed`, `cancelled`, `failed`, `expired`) cannot transition further (`isTerminal(status) === true`).
- Upon dispatching the terminal `update_order` event, the server-side stream immediately closes (`controller.close()`), terminating the background polling loop and releasing Edge Worker CPU/memory resources.

### 2.5 Resilient Reconnect & Event Replay
- When a client reconnects with the `Last-Event-ID` header or `?lastEventId=` query parameter:
  - The server reads the replay buffer from KV (`order_events_log:<orderId>`).
  - Events occurring after `Last-Event-ID` are replayed in deterministic sequence with original event IDs.
  - If no replay is needed, the current canonical state is emitted immediately.
- Duplicate events are harmless and processed idempotently by client stores (`mapSseEventToOrder`).

### 2.6 Zero Catalog Lookup Decoupling
- Historical and active order tracking views read directly from the frozen snapshot in `orders.items` or `order_items`.
- If products are repriced, renamed, recategorized, or deleted in the Catalog, tracking views remain fully functional without any runtime JOINs to `products` or `menu_items`.

---

## 3. Event / State Mapping Matrix

| Domain State Transition | Triggering Handler / Command | Published Event Payload | SSE Event Type | Terminal Stream Cutoff? |
| :--- | :--- | :--- | :--- | :---: |
| `pending` → `confirmed` | `createOrder` / payment confirmation | `{ orderId, status: 'confirmed', timestamp }` | `update_order` | No (active) |
| `confirmed` → `preparing` | `executeKdsStatusTransition` | `{ orderId, status: 'preparing', timestamp }` | `update_order` | No (active) |
| `preparing` → `ready` | `executeKdsStatusTransition` / tickets | `{ orderId, status: 'ready', timestamp }` | `update_order` | No (active) |
| `ready` → `completed` | `executeKdsStatusTransition` / COD paid | `{ orderId, status: 'completed', timestamp }` | `update_order` | **Yes (closed)** |
| `pending` → `cancelled` | `handleCancelOrder` | `{ orderId, status: 'cancelled', timestamp }` | `update_order` | **Yes (closed)** |
| `preparing` → `cancelled` | `handleCancelOrder` (staff only) | `{ orderId, status: 'cancelled', timestamp }` | `update_order` | **Yes (closed)** |
| `*` → `failed` / `expired` | System timeout / payment failure | `{ orderId, status: 'failed', timestamp }` | `update_order` | **Yes (closed)** |

---

## 4. Canonical Owners & Route Precedence

```
┌──────────────────────────────────────┬───────────────────────────────┬────────────────────────────────────────────────────────┐
│ Endpoint / Feature                   │ Canonical Handler / File      │ Authorization & Policy                                 │
├──────────────────────────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────┤
│ GET /api/orders/:id/events           │ handleOrderStreamEvents       │ canAccessOrder (Staff, Customer own, Guest unassigned) │
│ GET /api/orders/:id                  │ handleGetOrderById            │ resolveCustomerScope, customer-safe projection         │
│ PATCH /api/orders/:id/status         │ handleUpdateOrderStatus       │ requireAuth(['owner', 'staff']), emits order_event     │
│ PATCH /api/orders/:id/cancel         │ handleCancelOrder             │ Customer own or staff, emits order_event cancelled     │
│ PATCH /api/orders/:id/mark-cod-paid  │ handleMarkCodPaid             │ requireAuth(['owner']), emits order_event completed    │
│ Client Order Subscription            │ useOrderStore (Zustand)       │ EventSource(/api/orders/:id/events), idempotent merge  │
└──────────────────────────────────────┴───────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 5. Changed Files & LOC Compliance

All modified and newly created modules strictly obey the `< 200 LOC` constraint:

| File Path | LOC | Responsibility |
| :--- | :---: | :--- |
| `packages/domain/order/policies/customer-order-payload.ts` | 177 | Customer-safe allowlist projection, IDOR checks, event publisher |
| `packages/domain/order/index.ts` | 40 | Bounded context re-exports |
| `worker/src/routes/order-stream.ts` | 171 | Canonical SSE router, IDOR gate, and terminal stream cutoff |
| `worker/src/routes/order-stream-log.ts` | 64 | KV replay buffer (`Last-Event-ID`) & resilient order record fetcher |
| `worker/src/routes/openapi-orders-handlers/order-cancel-handlers.ts` | 90 | Order cancellation handler wired to `publishOrderEvent` |
| `worker/src/routes/orders-hono-handlers/kds-handlers.ts` | 154 | KDS handlers & COD mark paid wired to `publishOrderEvent` |
| `worker/src/__tests__/integrations/customer-order-tracking.test.ts` | 191 | Full test coverage for customer tracking contract invariants |
| `worker/src/__tests__/routes/order-stream.test.ts` | 135 | Unit tests for SSE stream establishment and replay |

---

## 6. Verification Results

1. **Dedicated Tracking & Lifecycle Integration Tests**:
   - `npx vitest run worker/src/__tests__/integrations/customer-order-tracking.test.ts`: **8/8 passed**.
   - `npx vitest run worker/src/__tests__/routes/order-stream.test.ts`: **4/4 passed**.
   - `npx vitest run worker/src/__tests__/integrations/order-*.test.ts`: **30/30 passed**.
   - `npx vitest run worker/src/__tests__/integrations/kitchen-*.test.ts`: **7/7 passed**.
2. **Full Workspace Regression Suite**:
   - `npx vitest run`: **3,756 passed across 415 test files (100% green)**.
3. **TypeScript Compilation**:
   - `npm run typecheck:all`: **0 errors**.
4. **Static Analysis & Linting**:
   - `npm run lint`: **0 errors, 0 warnings**.
5. **Invariant Safeguards**:
   - Catalog, pricing, modifiers, payments, inventory, ERPNext, and UI remained untouched.

---

## 7. Blockers

**None.** The Customer Order Tracking Contract is fully locked, verified, and operational.
