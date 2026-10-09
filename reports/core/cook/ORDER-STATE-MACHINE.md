# Canonical Order State Machine Contract

**Date**: 2026-10-08  
**Scope**: Canonical Order Lifecycle State Machine, Directional Transition Graph, Dual-Gated Authorization Policy, Terminal State Protection, Idempotency Guarantee, KDS & Customer Tracking Synchronization, and Payment Separation.

---

## 1. Canonical State Machine Contract

The order fulfillment lifecycle in Aura Space is governed by a single server-authoritative, deterministic directed graph:

```
                  ┌──────────────────────┐
                  │       PENDING        │ ◄── (Initial state upon order creation)
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │      CONFIRMED       │ ◄── (Accepted by cashier/system)
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │      PREPARING       │ ◄── (Kitchen / bar commences fulfillment)
                  └──────────┬───────────┘
                             │
                  ┌──────────▼───────────┐
                  │        READY         │ ◄── (Food/drink preparation completed)
                  └─────┬──────────┬─────┘
                        │          │
         (Dine-in /     │          │ (Delivery /
          Takeaway)     │          │  Takeout)
                        ▼          ▼
            ┌──────────────┐    ┌──────────────┐
            │    SERVED    │    │  DELIVERED   │
            └───────┬──────┘    └──────┬───────┘
                    │                  │
                    └────────┬─────────┘
                             │
                  ┌──────────▼───────────┐
                  │      COMPLETED       │ ◄── (Terminal Success State)
                  └──────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                      TERMINAL EXCEPTION STATES                         │
│                                                                        │
│   CANCELLED        FAILED             EXPIRED                          │
│   (Customer/Staff  (System/Payment    (Unclaimed / Timeout             │
│    Cancellation)    Critical Error)    Window Exceeded)                │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Invariant Rules

1. **Server-Side Command Authority**:
   - Order state transitions are exclusively executed by server-side commands (`handleOpenApiUpdateOrder`, `handleCancelOrder`, `handleUpdateOrderStatus`, `kdsMobileRouter`, `completeStationTicket`).
   - Order creation (`handleOpenApiCreateOrder`, guest checkout) forces `status = 'pending'`. Client requests cannot specify or bypass initial order status.
2. **Deterministic Transition Validation**:
   - Every transition attempt MUST pass structural validation via `canTransition(from, to)`.
   - Illegal transitions (e.g. stage-skipping `pending → preparing`, backward movement `ready → pending`) are deterministically rejected with HTTP 400.
3. **Dual-Gated Role Authorization (`canActorTransition`)**:
   - All state transitions are gated by actor permissions:
     - **Customer**: Least privileged. May only cancel orders in `pending` status before kitchen preparation commences. Cancellation attempts on `confirmed`, `preparing`, or later return HTTP 403.
     - **Kitchen**: May advance `confirmed → preparing` and `preparing → ready`. May cancel orders during `confirmed` or `preparing` due to kitchen operational constraints (e.g. ingredient depletion).
     - **Rider**: May advance `ready → delivered` and `delivered → completed`.
     - **Staff**: May advance standard dining fulfillment steps (`pending → confirmed → preparing → ready → served → completed`) and cancel orders before they are served or delivered.
     - **Admin / Manager / System**: Full operational authority across all non-terminal states.
4. **Idempotency Guarantee**:
   - Transitioning an order to its current status (`from === to`) is treated as an idempotent success (`{ ok: true }`).
   - Handlers respond with HTTP 200 without executing duplicate database updates or emitting duplicate event streams.
5. **Terminal State Immutability**:
   - The terminal states are strictly defined: `completed`, `cancelled`, `failed`, and `expired`.
   - Once an order reaches a terminal state, its transition graph terminates (`ORDER_TRANSITIONS[terminal] = []`).
   - Any attempt to transition out of a terminal state is deterministically rejected with HTTP 400 (`Cannot transition terminal order`).
6. **Payment & Order Fulfillment Decoupling**:
   - `orders.payment_status` tracks monetary settlement (`unpaid`, `pending`, `paid`, `refunded`, `failed`).
   - `orders.status` tracks physical lifecycle progression.
   - Payment links cannot be created for terminal orders (`cancelled`, `failed`, `expired`); attempts are rejected with HTTP 409.
   - Payment settlement (such as COD collection) synchronizes `payment_status = 'paid'` and terminates fulfillment only when payment represents final order settlement.
7. **KDS & Kitchen Synchronization**:
   - KDS web endpoints (`kds-handlers.ts`), mobile KDS (`kds-mobile.ts`), and kitchen station tickets (`kitchen-station-tickets.ts`) share the canonical state machine. Direct, unvalidated `UPDATE orders SET status` queries are prohibited.
8. **Customer Tracking & Live Observability**:
   - Real-time order tracking (`order-stream.ts`, SSE, REST endpoints) reads directly from the canonical `orders.status` column, ensuring customers observe real-time state changes without divergent cached projections.

---

## 2. Transition Matrix

The table below defines the authoritative transition graph. `✓` denotes a valid structural transition; `✗` denotes an illegal transition rejected by `canTransition`:

| Origin State (`from`) | `pending` | `confirmed` | `preparing` | `ready` | `served` | `delivered` | `completed` | `cancelled` | `failed` | `expired` |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **`pending`** | ✓ (idemp) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| **`confirmed`** | ✗ | ✓ (idemp) | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| **`preparing`** | ✗ | ✗ | ✓ (idemp) | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ |
| **`ready`** | ✗ | ✗ | ✗ | ✓ (idemp) | ✓ | ✓ | ✗ | ✓ | ✗ | ✗ |
| **`served`** | ✗ | ✗ | ✗ | ✗ | ✓ (idemp) | ✗ | ✓ | ✗ | ✗ | ✗ |
| **`delivered`** | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (idemp) | ✓ | ✗ | ✗ | ✗ |
| **`completed`** *(terminal)* | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (idemp) | ✗ | ✗ | ✗ |
| **`cancelled`** *(terminal)* | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (idemp) | ✗ | ✗ |
| **`failed`** *(terminal)* | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (idemp) | ✗ |
| **`expired`** *(terminal)* | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ (idemp) |

### 2.1 Actor Permissions Matrix

| Actor Role | Allowed Forward Transitions | Allowed Cancellation Window | Terminal Recovery |
| :--- | :--- | :--- | :--- |
| **`customer`** | None (cannot self-advance) | `pending` only (HTTP 403 if `confirmed`+) | None |
| **`kitchen`** | `confirmed → preparing`<br>`preparing → ready` | `confirmed`, `preparing` | None |
| **`rider`** | `ready → delivered`<br>`delivered → completed` | None | None |
| **`staff`** | Full forward lifecycle through `completed` | `pending`, `confirmed`, `preparing`, `ready` (Forbidden once `served`/`delivered`) | None |
| **`admin` / `manager`** | Full lifecycle across all active states | All pre-terminal states | Explicit authorized recovery |

---

## 3. Canonical Owner & Source of Truth

| Component | Canonical Location | Responsibility |
| :--- | :--- | :--- |
| **State Machine Definition** | `packages/domain/order/model/order-state-machine.ts` | Single source of truth for `ORDER_STATUSES`, `ORDER_TRANSITIONS`, `TERMINAL_STATES`, `canTransition()`, `isTerminal()`. |
| **Authorization Policy** | `packages/domain/order/policies/transition-authorization.ts` | Actor role mapping (`toActorRole`) and permission gating (`canActorTransition()`). |
| **Order Write Router** | `worker/src/routes/openapi-orders-handlers/order-write-handlers.ts` | Validates OpenAPI order status mutations against state machine and actor permissions. |
| **Order Cancel Handler** | `worker/src/routes/openapi-orders-handlers/order-cancel-handlers.ts` | Canonical cancellation endpoint enforcing customer/staff boundaries and idempotency. |
| **KDS Web Handlers** | `worker/src/routes/orders-hono-handlers/kds-handlers.ts` | Kitchen Display System order queue and status mutation controller. |
| **KDS Mobile Handlers** | `packages/domain/kitchen/commands/kds-mobile.ts` | Mobile handheld kitchen station status mutation controller. |
| **Station Auto-Tickets** | `packages/domain/kitchen/commands/kitchen-station-tickets.ts` | Station completion event coordinator. |
| **Payment Link Gateway** | `packages/domain/payment/commands/payos-create-link.ts` | Guards payment link issuance against cancelled, failed, and expired orders. |

---

## 4. Changed Files

| File | Status | LOC | Changes Summary |
| :--- | :--- | :--- | :--- |
| `packages/domain/order/model/order-state-machine.ts` | Modified | 83 | Added `failed` and `expired` to canonical statuses, transition graph, and terminal states. Preserved idempotency. |
| `packages/domain/order/policies/transition-authorization.ts` | Modified | 147 | Extended staff and kitchen rules for `failed`/`expired` and prep cancellations; added `system: 'admin'` alias. |
| `packages/domain/kitchen/commands/kds-mobile.ts` | Modified | 104 | Replaced unvalidated direct SQL with `canTransition`, `isTerminal`, `canActorTransition`, and idempotency. |
| `packages/domain/kitchen/commands/kitchen-station-tickets.ts` | Modified | 86 | Added guard ensuring order transitions to `ready` only if allowed by `canTransition`. |
| `worker/src/routes/orders-hono-handlers/kds-handlers.ts` | Modified | 127 | Integrated canonical state machine, role validation, idempotency, and terminal state checks in `handleUpdateOrderStatus`. |
| `worker/src/routes/openapi-orders-handlers/order-write-handlers.ts` | Modified | 160 | Enforced `isTerminal` guard, `canTransition`, and `canActorTransition` before updating orders. |
| `worker/src/routes/openapi-orders-handlers/order-cancel-handlers.ts` | Modified | 78 | Added idempotency check for already cancelled orders and guarded post-served cancellations. |
| `packages/domain/payment/commands/payos-create-link.ts` | Modified | 194 | Added HTTP 409 guard preventing payment link creation for orders in `cancelled`, `failed`, or `expired` status. Kept < 200 LOC. |
| `worker/src/__tests__/tree/orders/order-state-machine.test.ts` | Modified | 87 | Updated unit test suite to assert inclusion of `failed` and `expired` (14 passing tests). |
| `worker/src/__tests__/integrations/order-state-machine-lifecycle.test.ts` | Created | 156 | Integration test covering valid lifecycle, delivery flow, skip rejection, terminal immutability, idempotency, payment rejection (8 passing tests). |
| `worker/src/__tests__/integrations/order-state-machine-kds-cancel.test.ts` | Created | 194 | Integration test covering KDS transitions, skip rejection, terminal protection, customer cancellation boundary, staff cancellation boundary (7 passing tests). |

---

## 5. Verification Results

All quality gates passed with zero regressions:

1. **Vitest Unit & Integration Suites**:
   - `order-state-machine.test.ts`: **14 / 14 passed**
   - `order-state-machine-lifecycle.test.ts`: **8 / 8 passed**
   - `order-state-machine-kds-cancel.test.ts`: **7 / 7 passed**
   - Full Integration Suite (`worker/src/__tests__/integrations/`): **19 test files, 158 tests passed**
2. **TypeScript Compilation (`npm run typecheck:all`)**:
   - `tsc --noEmit` & `tsc --project worker/tsconfig.json --noEmit`: **0 errors**
3. **Linting (`npm run lint`)**:
   - ESLint: **0 errors, 0 warnings**
4. **File Size Compliance**:
   - All modified and newly created files adhere strictly to the **< 200 lines of code** modularization constraint.

---

## 6. Blockers & Risks

- **Blockers**: None. The state machine is locked, fully tested, and cleanly integrated across Worker endpoints and domain packages.
- **Risks & Mitigations**:
  - *Risk*: Legacy external systems or third-party webhooks sending deprecated or non-standard status strings.
  - *Mitigation*: Unrecognized statuses fail `ORDER_STATUSES.includes(s)` and are rejected deterministically with HTTP 400.
  - *Risk*: Concurrent status transitions from multiple staff members simultaneously.
  - *Mitigation*: D1 SQL updates bind the current order status and timestamps; idempotent transitions safely return HTTP 200 without duplicate side effects.
