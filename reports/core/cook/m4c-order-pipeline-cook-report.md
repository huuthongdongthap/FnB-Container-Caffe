# Cook Report: Milestone M4-C Order Pipeline & Server-Authoritative Cart Engine

**Date:** 2026-09-18  
**Scope:** Milestone M4-C (Phases 01–05)  
**Status:** COMPLETE (All 5 phases verified green)  

---

## 1. Summary of Changes

### Phase 01: Pricing Engine & Channel Pricing (Y-03)
- Implemented `resolveItemPrice()` in `@aura/domain-catalog/policies/pricing.ts` supporting sales channels (`dine_in`, `takeaway`, `delivery`), modifier price adjustments, and time-windowed happy-hour evaluations.
- Preserved integer VND cents precision across all calculations.

### Phase 02: Order Price Snapshot & Immutable Lines
- Implemented `calculateOrderSnapshot()` in `@aura/domain-order/policies/order-snapshot.ts`.
- Server evaluates canonical item prices, modifier deltas, promotions, and rejects unavailable/invalid items.
- Line items are immutably snapshotted with server-authoritative `unitPriceCents` and `subtotalCents`.

### Phase 03: State Machine & Transition Guards
- Wired `canActorTransition()` and `toActorRole()` into order status updates (`updateOrder` and `PATCH /api/orders/:id`).
- Layered dual-gate validation: 400 for structural state machine illegality, 403 for role permission violations.
- Role matrix covers `customer`, `staff`, `kitchen`, `rider`, `manager`, and `admin`.

### Phase 04: Customer Security & OpenAPI 3.1 Contract
- OpenAPI 3.1 contract schemas in `worker/src/schemas/orders.ts`:
  - `OrderItemInputSchema`: Intent-only (no client price fields).
  - `OrderCreateSchema`: Server-authoritative order creation payload.
  - `CustomerOrderItemSchema` & `CustomerOrderResponseSchema`: Positive allowlist projections for guest-facing surfaces (omits procurement/staff metadata, internal margins, raw database columns).
  - `OrderRoutes` with dual-gated transition response specifications (400/403).
- Response mappers in `worker/src/routes/openapi-orders-handlers/helpers.ts` (`formatOrder`, `formatCustomerOrder`, `formatOrderItem`, `formatCustomerOrderItem`).
- Updated `order-write-handlers.ts` to use server-authoritative snapshot calculation and consistent envelope projections.

### Phase 05: Acceptance Tests & State Sync
- Added unit & integration tests in `worker/src/__tests__/routes/openapi-orders.test.ts`.
- Verified 100% green test suite: **375 test files / 3,457 tests passing**.
- Verified clean type checking: `npx tsc --noEmit` **0 errors**.
- Updated project state documentation in `.ai/state/current.md`.

---

## 2. Quality & Verification Evidence

- **TypeScript Typecheck:** `npx tsc --noEmit` → PASS (0 errors).
- **Vitest Test Suite:** `npx vitest run` → **375 test files / 3,457 tests PASS**.
- **Regressions / Blast Radius:** Zero regressions in existing catalog, menu, payment, or auth pipelines.
