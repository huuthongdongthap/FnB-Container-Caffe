# AURA Backend Architecture Check

**Date:** 2026-09-22  
**Mode:** AUDIT ONLY  
**Verdict:** `READY_FOR_UI_REARCHITECTURE`

---

## Executive Summary

Following the 4-phase backend refactoring (ERPNext, Validators, Alert Dispatcher, Schemas), a comprehensive architectural and contract audit was performed to evaluate readiness for **UI Rearchitecture**.

The backend is **stable, type-safe, and fully verified**:
- `npx tsc --noEmit`: **0 errors**
- `npm test`: **382 test files passed / 3,513 tests passed (100% GREEN)**
- All contract invariants (M4-B Customer-Safe DTO, M4-C Server-Authoritative Pricing, Immutable Order Snapshot, Dual-Gate Order State Machine, and IDOR Ownership Guards) are **strictly enforced**.

No blocking defects prevent the UI Rearchitecture from proceeding. A small number of non-blocking architectural warnings (internal coupling in legacy routes and domain command files) are cataloged below for post-UI backlog tracking.

---

## 0. Baseline Evidence

| Metric / Command | Result | Status |
|---|---|---|
| `git branch --show-current` | `feat/uiux-rearchitecture` | [GREEN] |
| `git status --short` | User changes intact, zero code deletions | [GREEN] |
| `npx tsc --noEmit` | Clean (0 type errors across workspace) | [GREEN] |
| `npm test` | **382 / 382 test files passed (3,513 / 3,513 tests)** | [GREEN] |

---

## 1. Architecture Boundary Audit

Traced dependency direction:
```text
Route  →  Handler  →  Domain / Policy / Service  →  Repository / Client  →  External System / D1
```

### Audit Findings & Classification Matrix

| Dimension | Checkpoint | Classification | Evidence & Analysis |
|---|---|---|---|
| **1.1 Layer Separation** | Route contains business logic | **WARNING** [YELLOW] | **OpenAPI Routes:** [GREEN] Thin declaration barrels (`worker/src/routes/openapi-*.ts`) delegating entirely to handlers.<br>**Legacy Routes:** [YELLOW] Select non-OpenAPI legacy routes (`worker/src/routes/cron.ts`, `worker/src/routes/checkin.ts`) execute inline D1 queries and logic rather than delegating to service modules. Non-blocking for UI. |
| **1.2 Handler Discipline** | Handler contains domain policy | **PASS** [GREEN] | `worker/src/routes/openapi-orders-handlers/order-write-handlers.ts` delegates state validation and calculation to `@aura/domain-order` (`calculateOrderSnapshot`, `canTransition`, `canActorTransition`). Handlers focus strictly on HTTP extraction, DB persistence, and DTO serialization. |
| **1.3 ERPNext Client** | Client contains domain logic | **PASS** [GREEN] | `worker/src/erpnext/client/` (6 submodules) contains purely HTTP mechanics (retry with jitter, token authorization, timeout handling via `AbortSignal.timeout`, JSON body parsing). No business pricing or inventory rules exist inside client. |
| **1.4 Mapper Coupling** | Mapper depends backwards on transport | **PASS** [GREEN] | `worker/src/erpnext/mapper/` (5 submodules) contains pure TypeScript transformations between ERPNext DTOs and internal domain schemas. Zero imports from `hono`, Cloudflare Worker request context, or HTTP transport layers. |
| **1.5 Domain Independence** | Domain depends on HTTP | **WARNING** [YELLOW] | **Core Models & Policies:** [GREEN] `packages/domain/*/model/` and `policies/` (e.g. `order-snapshot.ts`, `order-state-machine.ts`) are 100% pure TypeScript without transport imports.<br>**Command Handlers:** [YELLOW] Select files in `packages/domain/*/commands/` (e.g., `create-order.ts`, `payos-create-link.ts`) import `hono` and `worker/src/middleware/cors`. These act as application services rather than pure domain entities. Non-blocking for UI. |
| **1.6 Cross-Domain Imports** | Cross-domain import legitimacy | **PASS** [GREEN] | Cross-boundary references between domains use explicit types and DTO interfaces. No unauthorized mutations across domain aggregates. |
| **1.7 Circular Dependencies** | Circular dependencies in modules | **WARNING** [YELLOW] | Evaluated via `madge` across 681 files in `worker/src` and 160 files in `packages/`:<br>- All 4 refactored modules (`erpnext/`, `validators/`, `alerts/`, `schemas/`) have **0 circular dependencies** [GREEN].<br>- Only 1 legacy cycle detected: `worker/src/middleware/logger.ts` ↔ `worker/src/lib/metrics-collector.ts` (request metrics logging). Non-blocking [YELLOW]. |
| **1.8 Duplicate Business Rules** | Duplicate status transition rules | **WARNING** [YELLOW] | Canonical state transitions are centralized in `packages/domain/order/model/order-state-machine.ts`. Legacy `worker/src/routes/orders-mobile.ts` retains an older transition array. OpenAPI endpoints strictly use the canonical domain state machine. |
| **1.9 Duplicate Validation** | DTO mapping / schema duplication | **WARNING** [YELLOW] | Shared Zod schemas are organized under `worker/src/lib/validators/`, while OpenAPI request/response contracts are organized under `worker/src/schemas/`. Both are typed and aligned; no conflicting schemas detected. |
| **1.10 Generic `lib/` Usage** | `lib/` as an unorganized dumping ground | **WARNING** [YELLOW] | `worker/src/lib/` has been significantly cleaned: `validators/` (19 files) and `alerts/` (7 files) were extracted into domain subpackages. Remaining files in `worker/src/lib/` are dedicated integration clients (`resend-client.ts`, `speedsms-client.ts`, `mautic-client.ts`, `mixpost-client.ts`, `pretix-client.ts`) and infrastructure utilities (`db.ts`, `jwt.ts`, `kv.ts`, `openapi.ts`). |

---

## 2. API Contract & Surface Audit

### 2.1 OpenAPI ↔ Worker Handlers ↔ DTO Consistency: **PASS [GREEN]**
- All endpoints in `worker/src/routes/openapi-*.ts` utilize `@hono/zod-openapi`'s `createRoute`.
- Request params, query strings, and JSON bodies are validated using Zod schemas registered on the route definitions.
- Standard response envelopes are strictly adhered to:
  - Success: `{ success: true, data: T }`
  - Failure: `{ success: false, error: string }`
- HTTP status codes accurately reflect operation outcomes (200 OK, 201 Created, 400 Bad Request for structural invalidity, 403 Forbidden for role transition denial, 404 Not Found for missing entities or IDOR mismatches).

### 2.2 Authentication & Authorization Middleware: **PASS [GREEN]**
- `requireAuth` verifies JWT tokens and populates `c.set('user', payload)`.
- Role-based authorization (`STAFF_ROLES = ['owner', 'manager', 'staff']`) restricts administrative and staff operations.
- Customer-facing endpoints validate customer token presence and reject unauthorized cross-customer mutations.

---

## 3. M4-B & M4-C Contract Invariants Audit

| Invariant | Implementation Location | Verification Evidence | Status |
|---|---|---|---|
| **M4-B Customer-Safe DTO** | `packages/domain/catalog/` | Strips internal cost, supplier names, stock quantities, and internal staff notes. Only customer-safe fields (`id`, `name`, `price`, `images`, `description`, `category`) reach client DTOs. Verified in `menu-query.test.ts`. | **PASS** [GREEN] |
| **IDOR Ownership Guard** | `worker/src/routes/openapi-orders-handlers/order-write-handlers.ts` | `resolveCustomerId()` forces `customer_id = user.id` when caller is a customer. In `PATCH` and `POST /cancel`, non-staff users cannot mutate orders where `existing.customer_id !== user.id` (returns 404). | **PASS** [GREEN] |
| **Server-Authoritative Pricing (M4-C)** | `packages/domain/order/policies/order-snapshot.ts` & `calculateOrderSnapshot` | Clients send intent only (`menuItemId`, `quantity`, `modifiers`). No client-sent price is accepted. Server queries active catalog and applies happy hour policies dynamically. | **PASS** [GREEN] |
| **Immutable Order Snapshot (M4-C)** | `worker/src/routes/openapi-orders-handlers/order-write-handlers.ts:55-82` | Computed totals (`subtotal`, `discount`, `tax_amount`, `total_amount`) and `itemsJson` are written to D1 `orders` and `order_items`. Subsequent catalog price changes never mutate historical order records. | **PASS** [GREEN] |
| **Order State Machine & Dual Gate** | `packages/domain/order/model/order-state-machine.ts` | Dual gate in order write handlers:<br>1. `canTransition()` validates structural graph legality (e.g. `pending` → `confirmed` → `preparing` → `ready` → `served`/`delivered` → `completed`). Returns 400 if illegal.<br>2. `canActorTransition()` validates actor authority (customer vs staff vs system). Returns 403 if unauthorized.<br>Terminal states (`completed`, `cancelled`) cannot be transitioned out of. | **PASS** [GREEN] |
| **Internal Data Shielding** | `worker/src/middleware/logger.ts` (`redact()`) | Passwords, tokens, customer phone numbers, emails, API keys, and payment signatures are redacted to `[REDACTED]` before writing to logs. | **PASS** [GREEN] |

---

## 4. Refactored Modules Deep-Dive

### 4.1 ERPNext Integration (`worker/src/erpnext/`): **PASS [GREEN]**
- **Structure:** Split into `client/` (6 submodules) and `mapper/` (5 submodules) with `worker/src/lib/erpnext-mapper.ts` compatibility barrel.
- **Verification:** Clean HTTP boundary, pure DTO transformations, zero compile errors, test suite passing.

### 4.2 Validators (`worker/src/lib/validators/`): **PASS [GREEN]**
- **Structure:** Monolithic file (664 LOC) divided into 19 domain modules (`auth`, `order`, `customer`, `products`, `subscription`, `shift`, `promotion`, `tables`, `push`, `marketing`, `erpnext`, `payos`, `dindin`, etc.).
- **Verification:** All 82 original symbols preserved. Compatibility barrel at `worker/src/lib/validators.ts` ensures backward compatibility.

### 4.3 Alert Dispatcher (`worker/src/lib/alerts/`): **PASS [GREEN]**
- **Structure:** Monolithic dispatcher (476 LOC) split into 7 domain submodules (`types`, `telegram`, `formatters`, `digest`, `dispatcher`, `factory`, `index`).
- **Verification:** All 7 SQL metric queries are byte-identical; all 6 threshold definitions preserved. Dual-API compatibility barrel maintained.

### 4.4 OpenAPI Schemas (`worker/src/schemas/`): **PASS [GREEN]**
- **Structure:** 4 major domains (`inventory`, `promotions`, `cron`, `loyalty`) modularized into distinct model and route definitions.
- **Verification:** All 51 schemas, 51 types, and 40 OpenAPI routes preserved with matching schemas and types co-located.

---

## 5. Architectural Dependency Graph

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                              HTTP CLIENT / FRONTEND                               │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │ JSON Requests (Intent Only, No Prices)
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                 ROUTING LAYER                                     │
│  worker/src/routes/openapi-*.ts (OpenAPI Route Barrels with Zod Definitions)       │
└────────────────────────────────────────┬──────────────────────────────────────────┘
                                         │ Validated Parameters & DTOs
                                         ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                APPLICATION HANDLERS                               │
│  worker/src/routes/openapi-*-handlers/ (Auth, Orders, Tables, Catalog, etc.)      │
│  • RBAC & IDOR Ownership Check (resolveCustomerId, resolveCustomerScope)         │
│  • Response Formatting & Audit Logging                                            │
└──────────────────┬──────────────────────────────────────────────┬─────────────────┘
                   │                                              │
                   ▼                                              ▼
┌──────────────────────────────────────┐       ┌────────────────────────────────────┐
│         DOMAIN & POLICY ENGINE       │       │       INTEGRATIONS & CLIENTS       │
│  @aura/domain-order                  │       │  worker/src/erpnext/client/        │
│  • calculateOrderSnapshot()          │       │  worker/src/erpnext/mapper/        │
│  • canTransition() [Graph Legality]  │       │  worker/src/lib/alerts/            │
│  • canActorTransition() [RBAC]       │       │  worker/src/lib/validators/        │
│  @aura/domain-catalog                │       │  External: PayOS, Zalo, SpeedSMS   │
│  • Customer-Safe Projection DTO      │       └──────────────────┬─────────────────┘
└──────────────────┬───────────────────┘                          │
                   │                                              │
                   ▼                                              ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                              DATA PERSISTENCE LAYER                               │
│  Cloudflare D1 Database (AURA_DB) & Cloudflare KV                                 │
│  • Immutable Order Records (orders, order_items)                                  │
│  • Audit Logs (audit_logs)                                                        │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Blockers vs. Non-Blocking Items

### Blockers for UI Rearchitecture
**NONE.** There are zero blockers. The backend API contracts, DTO schemas, and business invariants are verified green.

### Non-Blocking Architectural Backlog (Post-UI)
1. **Domain Command Decoupling:** Refactor command files in `packages/domain/*/commands/` to eliminate imports of `hono` and `worker/src/middleware/cors` so that domain packages remain 100% transport-agnostic.
2. **Logger-Metrics Circular Dependency:** Break the cycle between `worker/src/middleware/logger.ts` and `worker/src/lib/metrics-collector.ts` by extracting shared logging interfaces or decoupling metric invocation.
3. **Legacy Route Retirement:** Gradually migrate legacy routes (`orders-mobile.ts`, `cron.ts`, `checkin.ts`) to standard OpenAPI handlers.

---

## Final Verdict

```text
============================================================
              READY_FOR_UI_REARCHITECTURE ✅
============================================================
```

The backend is verified ready for UI Rearchitecture. All mandatory gates (`npx tsc --noEmit` and `npm test`) are passing cleanly. Proceed to frontend UI/UX rearchitecture.
