# Progress — M4-B Digital Menu

## Completed Phases
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
- M4-C readiness: pending final decision gate