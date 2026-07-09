# Brainstorm: Phase 2b-2 Test Coverage Approach
Stardate: 2026-07-08 · CWD: worker · Mode: brainstorm → design approved → Option C selected

## Problem
Phase 2b-1 tested pure tree modules (auth helpers, login, order creation). Phase 2b-2 targets are route-level handlers and external integration clients with heavy HTTP/external-dependency footprints. Testing them like Phase 2b-1 would produce 80% mock scaffolding with low signal.

## Options Evaluated

| | A — Full route tests | B — Tree-only | C — Hybrid (chosen) |
|---|---|---|---|
| Effort | High | Low | Medium |
| Coverage | HTTP contract only | Logic only | Logic + routing smoke |
| Fit | Poor (mock-heavy) | Incomplete | Best |

## Decision
**Option C — Hybrid: deep pure-logic unit tests + 1–2 smoke tests per route.**

### What gets tested deeply (tree-level)
- `src/tree/pretix/hmac-validator.ts` — HMAC signature validation (pure function)
- `src/tree/pretix/types.ts` — Type guards / parsing
- `src/tree/campaigns/triggers/` — birthday, cashback-expiry, post-visit, welcome, winback (logic)
- `src/tree/referrals/apply-referral.ts`, `process-referral.ts`, `referral-cashback.ts`, `reverse-cashback.ts` — referral math
- `src/tree/campaigns/campaign-engine.ts` — campaign selection logic

### What gets smoke-tested (route-level, 1–2 tests each)
- `src/routes/payments/momo-create.ts` — happy path returns 200/201, missing fields → 400
- `src/routes/refunds.ts` — refund created / invalid input
- `src/routes/webhooks/momo.ts` — valid signature → 200, invalid → 401
- `src/routes/pretix.ts` — valid HMAC → 200, missing header → 400

### What gets deferred (skip for this phase)
- `src/tree/integrations/frigate/sync.ts` — external HTTP to Frigate MQTT/API; testable only with heavy fetch mocking → move to Phase 2c or e2e
- `src/tree/integrations/tastyigniter/sync.ts` — same pattern
- `src/tree/mautic/*` — 11 files, external Mautic API → defer per YAGNI

## Constraints
- Zero `:any` types in new tests
- Zero `console.*`
- Follow existing `__tests__/` structure
- Must pass `npx vitest run` with 0 regressions from 515 baseline
- Mock external `fetch` via `vi.stubGlobal('fetch', ...)` pattern

## Dependencies
- Extends `test-utils.ts` with `createMockApp()` if route smoke tests need it
- No source code changes — tests only this phase

## Unresolved
- Route smoke tests may require `createMockApp()` helper not yet in `test-utils.ts` — will assess during implementation
- Frigate/TastyIgniter integration: if Phase 2c (Security Hardening) touches these, they may need tests first as a safety net — keep on radar
