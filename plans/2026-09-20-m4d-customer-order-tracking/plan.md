# Plan: M4-D Customer Order Tracking & History — Canonical UI Wiring

## Overview
- **Milestone:** M4-D
- **Target:** Wire frontend customer order surfaces (TrackOrder, Account order history, OrderSuccess) to the canonical OpenAPI order endpoints using `formatCustomerOrder()` / `formatCustomerOrderItem()` projections.
- **Foundation:** M4-C complete — canonical `GET /api/orders` (list) and `GET /api/orders/:id` (detail) active on `openApiApp` at `/api/orders`, protected by `requireAuth(['owner','manager','staff','customer'])`, with `resolveCustomerScope()` enforcing IDOR-safe ownership scoping. Projections return camelCase DTOs (`totalAmount`, `unitPriceCents`, `orderNumber`, `paymentStatus`, `createdAt`, `updatedAt`).
- **Problem:** Frontend still binds to legacy snake_case endpoints:
  - `src/hooks/use-order.ts` → unauthenticated legacy `GET /api/orders/:id` (phone-keyed, raw row)
  - `src/hooks/use-account.ts` → legacy `GET /api/orders/my-orders` (phone-keyed, `items` as JSON string)
  - `src/hooks/stores/use-order-store.ts` → `fetchOrder` hits `/api/orders/${id}` (same legacy)
  - `Order` interface in `order-store-types.ts` uses snake_case fields mismatched to canonical DTO
- **Baseline:** 374 test files / 3,464 tests PASS | `tsc --noEmit` 0 errors

## Phases
1. [x] [Phase 01: Frontend DTO Alignment](./phase-01-frontend-dto-alignment.md) — Define new `CustomerOrder`/`CustomerOrderItem` interfaces matching canonical camelCase projection; create mappers from canonical DTO → UI shape (COMPLETED)
2. [x] [Phase 02: Hook Migration — Single Order (TrackOrder / OrderSuccess)](./phase-02-hook-migration-single-order.md) — Migrate `use-order-store.ts` `fetchOrder`/`subscribeToOrder` to canonical endpoint + camelCase DTO; retire legacy snake_case mapping (COMPLETED)
3. [x] [Phase 03: Hook Migration — Order History (Account)](./phase-03-hook-migration-order-history.md) — Migrate `use-account.ts` to canonical `GET /api/orders` list endpoint; remove `JSON.parse(items)` workaround (COMPLETED)
4. [x] [Phase 04: Legacy Endpoint Retirement & Cleanup](./phase-04-legacy-retirement.md) — Remove legacy `my-orders` handler and unauthenticated `GET /api/orders/:id` from `orders-hono-handlers/query-handlers.ts`; verify no remaining consumers (COMPLETED)
5. [x] [Phase 05: Verification & Acceptance Tests](./phase-05-verification.md) — Full vitest + tsc green; E2E smoke of TrackOrder, Account dashboard, OrderSuccess with canonical data (COMPLETED)

## Key Invariants
- **No client-side price/total calculation** — all monetary fields come from server-authoritative projection
- **CamelCase at the boundary** — canonical DTO is camelCase; UI components consume camelCase (or mapped view models)
- **IDOR boundary stays closed** — `resolveCustomerScope()` logic unchanged; customer token only reaches own orders
- **No breaking changes to OpenAPI contract** — Phase 04 only removes legacy Hono handlers, not OpenAPI routes
- **SSE subscription preserved** — `/api/orders/:id/events` endpoint remains functional for real-time updates