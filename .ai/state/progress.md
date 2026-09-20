# Progress — M4-C Order Pipeline & Server-Authoritative Cart Engine

## Completed Phases
- [x] Phase 1: Pricing Engine & Channel Pricing — `resolveItemPrice()` in `@aura/domain-catalog` (channel deltas, modifier deltas, happy-hour windows). Resolves Y-03.
- [x] Phase 2: Order Price Snapshot & Immutable Lines — `calculateOrderSnapshot()` in `@aura/domain-order`; wired into `createOrder` so client prices/totals are discarded.
- [x] Phase 3: State Machine & Transition Guards — `canActorTransition()` + `toActorRole()` layered over `canTransition()`.
- [x] Phase 4: Customer Security & OpenAPI Contract — `OrderRoutes` registered; intent-only `OrderCreateSchema`; customer-safe positive projections; ownership scoping closes the `GET /api/orders/:id` IDOR hole.
- [x] Phase 5: Acceptance Tests & State Sync — IDOR + price-tampering + transition-validity acceptance suites; 375 files / 3,464 tests PASS; `tsc --noEmit` 0 errors.

## Verification Results
| Audit | Area | Status | Evidence |
|-------|------|--------|----------|
| #01 | Server-Authoritative Price | GREEN | `calculateOrderSnapshot()` discards client `price`/`subtotal`/`totalAmount`/`discountAmount` |
| #02 | Intent-Only Contract | GREEN | `OrderCreateSchema` admits no price-bearing key at line or order level; tamper test asserts stripping |
| #03 | Ownership Scoping (IDOR) | GREEN | `resolveCustomerScope()` in read handlers; customer token reaches only its own `customer_id` |
| #04 | Fail-Closed Semantics | GREEN | Non-staff actor with no resolvable owner → `AND 1=0`; foreign order → 404, not 403 |
| #05 | Dual-Gate Transition Auth | GREEN | 400 (structural illegality) decided before 403 (role authority) in `update` + `cancel` |
| #06 | Customer-Safe Projection | GREEN | `formatCustomerOrder()` allowlist; omits `customer_id`, staff fields, supplier info |
| #07 | OpenAPI 3.1 | GREEN | `OrderRoutes` registered in `worker/src/lib/openapi.ts`; schemas match runtime |
| #08 | Route Auth Gate | GREEN | `requireAuth(['owner','manager','staff','customer'])` — guests reach their own routes |
| #09 | Test Coverage | GREEN | 3 new acceptance blocks; 375 files / 3,464 tests PASS |
| #10 | Build/Typecheck | GREEN | `npx tsc --noEmit` = 0 errors |
| #11 | Runtime | GREEN | Hono in-process `app.fetch()` with mocked D1 |
| #12 | State | GREEN | `.ai/state/*` updated |

## M4-B Foundation (Verified — DO NOT MODIFY)
- Canonical `GET /api/menu` + `GET /api/menu/:id`, `@aura/domain-catalog` customer-safe DTO, `MenuRoutes` registered.
- 18/18 M4-B audits GREEN at time of completion. Historical detail retained in the milestone archive; M4-B baseline was 371 files / 3,395 tests.

## Verification Results — M4-B Digital Menu (historical)
- [x] Phase 1: Contract & Test Specification (15 tests in m4b-digital-menu-contract.test.ts)
- [x] Phase 2: Domain Projection & Locale Support (getCustomerMenu, getCustomerMenuItem with vi-VN default)
- [x] Phase 3: API Endpoint Implementation (canonical GET /api/menu, GET /api/menu/:id in worker/src/index.ts)
- [x] Phase 4: Frontend Integration (useCustomerMenu hook, MenuPage locale wiring, api-client repointing)
- [x] Phase 5: OpenAPI Contract (packages/domain/catalog/schemas/menu.ts, wired in openapi.ts)

## Verification Results
| Audit | Area | Status | Evidence |
|-------|------|--------|----------|
| #01 | Canonical API | GREEN | Single GET /api/menu, GET /api/menu/:id; legacy /api/catalog/menu/customer & /api/crm/menu retired |
| #02 | Domain Boundary | GREEN | @aura/domain-catalog reused; no duplicate models |
| #03 | Customer-Safe DTO | GREEN | FORBIDDEN_FIELDS absent; SQL selects only customer-safe columns |
| #04 | Product Visibility | GREEN | Default available-only; includeUnavailable opt-in |
| #05 | Price | GREEN | Integer VND cents; server-side only; no frontend override |
| #06 | Availability | GREEN | Backend-derived via parseAvailabilityFilter; no internal stock exposure |
| #07 | Localization | GREEN | vi-VN default; en-US supported; deterministic vi collation |
| #08 | OpenAPI | GREEN | MenuRoutes registered; CustomerMenuItem/Category/Response schemas; 200/404 responses |
| #09 | Test Coverage | GREEN | 15 contract tests + 9 legacy tests pass; 371 files / 3,395 total |
| #10 | E2E Customer Journey | GREEN | Integration tests hit canonical worker endpoint with ExecutionContext |
| #11 | UI/API Source of Truth | GREEN | useCustomerMenu hook is sole source; api-client points to canonical |
| #12 | Three-Shell Isolation | GREEN | Shells exist but M4-B doesn't touch them; no cross-contamination |
| #13 | Design System | GREEN | MD3 tokens used; no raw CSS values in menu page |
| #14 | Legacy/Duplication | GREEN | CRM menu test deleted (zero callers verified); legacy queries/menu.ts preserved for 9 existing tests |
| #15 | Build/Typecheck/Lint | YELLOW | tsc=0, tests=PASS; eslint has 53 pre-existing errors (unrelated to M4-B) |
| #16 | Runtime/Deployment | GREEN | Worker routes mounted; graceful D1 degradation; mock ctx for tests |
| #17 | Git Diff Hygiene | GREEN | 26 files changed; focused scope; no temp/debug files |
| #18 | State | GREEN | .ai/state/ updated |

## Remaining
- M4-C complete. No open blockers.
- `formatCustomerOrder()` is defined and unit-tested but not yet wired to a customer-facing route — candidate for M4-D.