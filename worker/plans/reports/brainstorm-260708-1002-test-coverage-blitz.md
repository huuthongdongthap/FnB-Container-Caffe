# Brainstorm Report — Phase 2b Test Coverage Blitz
Run: 2026-07-08 · CWD: worker · Mode: brainstorm → design approved

## Problem
71% of routes (35/49) and 79% of tree modules (15/19) have zero unit tests. Scout identified 4 CRITICAL + 5 HIGH security findings that can't be safely refactored without an existing test safety net.

## Decision
**Phase 2b Test Coverage Blitz first, then Phase 2c Security Hardening.**

Rationale:
- Tests are the prerequisite for confident security refactoring
- Surfaces hidden bugs in financial flows (create-order, refunds) before security changes mask them
- Decomposes into 3 sequential sub-phases with parallel-spawn capability within each

## Sub-Phases

| Phase | Scope | Est. | Priority |
|-------|-------|------|----------|
| 2b-1 | `tree/orders/create-order.ts`, `tree/auth/login.ts` + helpers | ~20 tests | P0 |
| 2b-2 | `refunds.ts`, `webhooks.ts`, `momo-create.ts`, `pretix.ts`, `campaigns.ts`, `referrals.ts` + ERPNext/Frigate clients | ~30 tests | P0 |
| 2b-3 | Remaining routes (`loyalty/`, `subscriptions/`, `zalo/`, etc.) | ~40+ tests | P1 |

## Patterns
- Tree modules: direct function import, mock D1 via `createMockDB()`
- Routes: Hono `app.fetch()` with `createMockEnv()`, JWT via `mockRequestWithAuth()`
- Clients: stub `fetch` or mock env with fake URLs

## Constraints
- Zero `:any` types in new tests
- Zero `console.*` in test files
- Follow existing `__tests__/` structure (routes/, tree/, middleware/)
- Use `npx vitest run` — no e2e/playwright for this phase

## Unresolved
- `tree/erpnext/` empty — need to confirm ERPNext logic lives only in routes (scout Q4)
- Whether `playwright` e2e tests exist outside `src/__tests__/` (scout Q5)
