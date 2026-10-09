# Canonical Kitchen / KDS Contract Specification

**Contract Version**: 1.0.0  
**Status**: LOCKED & VERIFIED  
**Date**: 2026-10-08  
**Domain Modules**: `@aura/domain-kitchen`, `@aura/domain-order`, `worker/src/routes/`

---

## 1. Executive Summary & Canonical Flow

The Kitchen / Kitchen Display System (KDS) contract enforces a deterministic, decoupled, and role-authorized kitchen fulfillment pipeline across the AURA Cloudflare Worker and Edge D1 architecture.

```
┌─────────────────┐
│     ORDER       │ (Status: pending / confirmed)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ ORDER SNAPSHOT  │ Immutable JSON record stored in orders.items
│   (Producer)    │ Frozen attributes: id, name, unitPriceCents, category_id
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ KITCHEN ROUTING │ Server-side policy mapping category_id → station_id
│ (station-policy)│ Fallback station for unmapped/custom categories
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    STATIONS     │ Station-isolated queues & order_item_stations tracking
│ (Coffee/Bakery) │ Non-blocking parallel line production
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    KDS VIEWS    │ Unified endpoints: /api/orders/kds, /api/kds/orders
│  (Web / Mobile) │ Real-time SSE / KV stream updates (/api/kds/orders/stream)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PREPARING     │ Item-level or order-level preparation started
│ (State Machine) │ Validated via canTransition + canActorTransition
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     READY       │ Multi-item coordination: ALL order items marked ready_at
│   (Fulfillment) │ Idempotent execution (from === to returns 200 idempotent)
└─────────────────┘
```

---

## 2. Kitchen & KDS Contract Rules

### 2.1 Immutable Order Item Snapshot Decoupling
- **Decoupling Invariant**: KDS read operations and kitchen ticket displays **must never query or join** the runtime `products` or `menu_items` tables.
- **Canonical Producer**: `calculateOrderSnapshot` in `@aura/domain-order` is the single source of truth for freezing order items. It guarantees that `category_id` is permanently captured in the item JSON within `orders.items`.
- **Historical Resilience**: If a product is renamed, recategorized, repriced, or deleted in the Catalog, existing historical orders and active in-flight kitchen tickets maintain their original categories and continue to route deterministically.

### 2.2 Server-Side Deterministic Routing
- **Policy Invariant**: Station routing is governed strictly by server-side policy (`category_stations` and `station-policy.ts`). Clients (POS, Web, Mobile) cannot override or inject station assignments.
- **Station Indexing**: `buildCategoryStationIndex` and `buildIndexFromDbRows` compile fast lookup maps (`category_id → station_id`).
- **Deterministic Fallback**: If an order item contains an unmapped or missing `category_id`, it is deterministically routed to designated fallback stations (`isFallbackStation: true`) rather than dropped or silently ignored.

### 2.3 Multi-Item Multi-Station Coordination
- **No Premature Completion**: For orders with items split across multiple stations (e.g., Espresso at Coffee Bar, Croissant at Bakery), individual item preparation is tracked in `order_item_stations`.
- **Atomic Transition to READY**: An order only transitions from `preparing` → `ready` when **every item** belonging to that order has recorded `ready_at IS NOT NULL`.

### 2.4 Canonical Order State Machine & Role Authorization
- **Status Coordinator**: All status transitions (Web KDS, Mobile KDS, Station Ticket endpoints) execute exclusively via `executeKdsStatusTransition` (`@aura/domain-kitchen`).
- **Enforcement Rules**:
  1. **Order Existence**: Returns HTTP 404 if order does not exist.
  2. **Idempotency**: If `current_status === target_status`, returns HTTP 200 with `{ success: true, idempotent: true }`.
  3. **Terminal Protection**: Terminal statuses (`completed`, `cancelled`) cannot be mutated (HTTP 400).
  4. **State Machine Validation**: Validated via `canTransition(from, to)`.
  5. **Role Authorization**: Validated via `canActorTransition(role, from, to)`. Kitchen mutations require `staff`, `manager`, or `owner` roles (customer mutations reject with HTTP 403).
  6. **Persistence & Streaming**: Updates `orders.status` and `orders.updated_at`, then schedules event delivery to SSE/KV streams via `waitUntil`.

---

## 3. Station Routing Matrix

| Category ID | Default Station ID | Station Name | Fallback Routing Policy |
| :--- | :--- | :--- | :--- |
| `cat_beverage`, `cat_coffee`, `cat_tea` | `KS_COFFEE` | Barista / Coffee Bar | Station filter matches `category_id` |
| `cat_pastry`, `cat_food`, `cat_bakery` | `KS_BAKERY` | Bakery & Kitchen | Station filter matches `category_id` |
| *Unmapped / Null Category* | `KS_EXPEDITE` | Expediter / General | Handled by designated fallback station |

---

## 4. Canonical Owners & Route Precedence

```
┌──────────────────────────────────────┬───────────────────────────────┬────────────────────────────────────────────────────────┐
│ Endpoint / Feature                   │ Canonical Handler / File      │ Authorization & Policy                                 │
├──────────────────────────────────────┼───────────────────────────────┼────────────────────────────────────────────────────────┤
│ GET /api/orders/kds                  │ handleGetKdsOrders            │ requireAuth(['owner', 'staff']), filters by station_id  │
│ GET /api/kds/orders                  │ handleGetKdsOrders            │ requireAuth(['owner', 'staff']), unified route alias   │
│ GET /mobile/kds/orders               │ getKdsMobile                  │ VIEW_ROLES (owner, manager, staff)                     │
│ PATCH /api/orders/:id/status         │ handleUpdateOrderStatus       │ requireAuth(['owner', 'staff']), audit log, canonical  │
│ PATCH /api/kds/:id/status            │ handleUpdateOrderStatus       │ Unified alias to handleUpdateOrderStatus               │
│ PATCH /mobile/kds/orders/:id/status  │ updateKdsStatus               │ UPDATE_ROLES, delegates to executeKdsStatusTransition  │
│ POST /tickets/:id/items/:it/start    │ stationTicketsRouter          │ Marks started_at, transitions order to preparing       │
│ POST /tickets/:id/items/:it/ready    │ stationTicketsRouter          │ Marks ready_at, multi-item ready check → order ready   │
│ GET /api/kds/orders/stream           │ handleKdsOrdersStream         │ Server-Sent Events stream for real-time ticket display │
└──────────────────────────────────────┴───────────────────────────────┴────────────────────────────────────────────────────────┘
```

---

## 5. Changed Files & LOC Compliance

All modified and newly created modules strictly obey the `< 200 LOC` constraint:

| File Path | LOC | Responsibility |
| :--- | :---: | :--- |
| `packages/domain/kitchen/src/policies/station-policy.ts` | 133 | Pure category station mapping & item filtering |
| `packages/domain/kitchen/commands/kds-status-transition.ts` | 115 | Canonical server-side transition executor |
| `packages/domain/kitchen/commands/kitchen-station-tickets.ts` | 119 | Station tickets & multi-item ready coordinator |
| `packages/domain/kitchen/commands/kds-mobile.ts` | 109 | Mobile KDS route handler using canonical transition |
| `packages/domain/order/policies/order-snapshot-types.ts` | 79 | Order snapshot data types & interfaces |
| `packages/domain/order/policies/order-snapshot.ts` | 146 | Order snapshot producer freezing `category_id` |
| `worker/src/routes/orders-hono-handlers/kds-handlers.ts` | 143 | Web KDS handlers & station query filters |
| `worker/src/routes/orders-hono-handlers/types.ts` | 58 | Shared KDS order & order item interfaces |
| `worker/src/routes/orders-unified.ts` | 79 | Route gateway routing `/api/kds/orders` |
| `worker/src/__tests__/integrations/kitchen-kds-routing.test.ts` | 117 | Snapshot decoupling & station routing tests |
| `worker/src/__tests__/integrations/kitchen-kds-lifecycle.test.ts` | 155 | Multi-item readiness & state machine tests |

---

## 6. Verification Results

1. **Unit & Integration Tests**:
   - `npx vitest run worker/src/__tests__/integrations/kitchen-kds-*.test.ts`: 7/7 passed.
   - `npx vitest run worker/src/__tests__/routes/mobile-kds.test.ts`: 14/14 passed.
   - Full workspace test suite (`npx vitest run`): **3,748 passed across 414 test files (100% green)**.
2. **TypeScript Compilation**:
   - `npm run typecheck:all`: 0 errors.
3. **Static Analysis & Linting**:
   - `npm run lint`: 0 errors, 0 warnings.
4. **Invariant Safeguards**:
   - Catalog, pricing, modifiers, payments, inventory, ERPNext, and UI remained completely untouched.

---

## 7. Blockers

**None.** The Kitchen / KDS Contract is fully locked, verified, and operational.
