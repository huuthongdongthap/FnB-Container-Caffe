# Current State — AURA OS

**Milestone:** M4-C Order Pipeline & Server-Authoritative Cart Engine
**Status:** Phase 01–05 Complete — Milestone M4-C Done
**Active Branch:** main
**Baseline:** 375 test files / 3,464 tests PASS | TypeScript: 0 errors

## Current Focus
M4-C Complete: Order Pipeline & Server-Authoritative Cart Engine fully implemented with OpenAPI 3.1 contract, customer-safe DTOs, and layered authorization.

## M4-B Foundation (Verified — DO NOT MODIFY)
- Canonical `GET /api/menu` + `GET /api/menu/:id` active
- `@aura/domain-catalog` Customer-Safe DTO with FORBIDDEN_FIELDS contract
- Integer VND cents (`priceCents`) server-authoritative
- Backend-derived availability (`toAvailabilityFlag`)
- OpenAPI 3.1 registered (`MenuRoutes` in `worker/src/lib/openapi.ts`)
- `useCustomerMenu` hook → `apiClient` → canonical endpoint
- CRM Order domain (`@aura/domain-order`) exists with state machine

## M4-C Scope & Progress
- [x] Phase 01: Pricing Engine & Channel Pricing (Y-03 resolution) — `resolveItemPrice()` with channel deltas, modifier deltas, happy-hour windows in `@aura/domain-catalog`
- [x] Phase 02: Order Price Snapshot & Immutable Lines — `calculateOrderSnapshot()` in `@aura/domain-order`, wired into `createOrder` so client-supplied prices/totals are discarded; rejects unavailable items
- [x] Phase 03: State Machine & Transition Guards — `canActorTransition()` + `toActorRole()` layered over `canTransition()`; role matrix (customer/staff/kitchen/rider/manager/admin) enforced in `updateOrder` and the `PATCH /api/orders/:id` route
- [x] Phase 04: Customer Security & OpenAPI Contract — OpenAPI 3.1 `OrderRoutes` registered in `worker/src/lib/openapi.ts`; server-authoritative `OrderCreateSchema` (intent-only, no client prices); customer-safe positive-projection `CustomerOrderResponseSchema`/`CustomerOrderItemSchema`; `OrderChannelEnum` aligned to catalog pricing channels; dual-gate transition docs (400 state machine + 403 role)
- [x] Phase 04 (security hardening): closed the `GET /api/orders/:id` IDOR hole via `resolveCustomerScope()` (staff see all; a `customer` token reaches only its own `customer_id`; fail-closed `AND 1=0` otherwise; foreign order → 404). Same ownership scope plus dual-gate authorization (400 structural → 403 role) added to `PATCH /api/orders/:id` and `POST /api/orders/:id/cancel`. Route auth gate widened to admit `'customer'` — previously all order routes were staff-only, which left the scoping unreachable.
- [x] Phase 05: Acceptance Tests & State Sync — Full vitest (375 files / 3,464 tests) + `tsc --noEmit` (0 errors) green; IDOR, price-tampering and transition-validity acceptance suites in `worker/src/__tests__/routes/openapi-orders.test.ts`; state docs + `docs/12_CHANGELOG.md` updated

## UI Re-Architecture (AURA OS Master Plan)
- [x] Phase 0: Forensic Audit & Multi-Dimensional Codebase Inspection
- [x] Phase 1: Shell Authority & Viewport Boundary Enforcement (CustomerShell, OpsShell, AdminShell)
- [x] Phase 2: M3 Component System & Adapters (`src/components/ui/adapters/`)
- [x] Phase 3: Customer Experience Re-Architecture & M4-B Canonical Integration
- [x] Phase 4: Operations Experience Re-Architecture (KDS, TV Menu, Table POS on OpsShell)
- [x] Phase 5: Admin Experience Re-Architecture (AdminShell with MD3NavigationDrawer)
- [x] Phase 6: Legacy Migration & Dead Prototype Cleanup (purged unrouted stitch prototypes, updated screen-data.ts)
- **Baseline:** 374 test files / 3,464 tests PASS | TypeScript: 0 errors | Build: OK