# Phase 2b-2: Hybrid Test Coverage — Payments, Webhooks, Campaigns, Referrals, Pretix
Run: 2026-07-08 · Parent: `plans/260708-1002-test-coverage-blitz/plan.md`
Mode: hybrid (deep tree logic + route smoke tests)

## Context
Phase 2b-1 completed: 25 new tests, 515 total passing with 0 regressions.
Phase 2b-2 covers route-level handlers and integration clients where full route testing is mock-heavy.

## Approach: Hybrid (Option C)
- **Deep tree/logic tests**: pure functions (HMAC validation, campaign triggers, referral math)
- **Route smoke tests**: 1–2 per route verifying HTTP contract (status codes, response shape)

## Scope (EST: ~30 tests)

### Tree — deep unit tests (~20 tests)
| Module | Tests | Key behaviors |
|--------|-------|---------------|
| `src/tree/pretix/hmac-validator.ts` | 5 | Valid/invalid HMAC, missing header, wrong algorithm |
| `src/tree/pretix/types.ts` | 3 | Type guards, order status parsing |
| `src/tree/campaigns/triggers/birthday.ts` | 3 | Match/no-match, edge dates |
| `src/tree/campaigns/triggers/welcome.ts` | 3 | New customer trigger, skip repeat |
| `src/tree/referrals/apply-referral.ts` | 4 | Valid code, expired code, self-referral, missing code |
| `src/tree/referrals/referral-cashback.ts` | 3 | Cashback calculation, rounding, tier limits |

### Route — smoke tests (~6 tests)
| Route | Tests |
|-------|-------|
| `src/routes/payments/momo-create.ts` | 2 (happy → 200, bad body → 400) |
| `src/routes/refunds.ts` | 2 (happy → 200, missing order → 404) |
| `src/routes/webhooks/momo.ts` | 2 (valid sig → 200, bad sig → 401) |

### Deferred (skip this phase)
- `src/tree/integrations/frigate/sync.ts` — heavy external HTTP mocking
- `src/tree/integrations/tastyigniter/sync.ts` — same
- `src/tree/mautic/*` — 11 files, external Mautic API (YAGNI)

## Constraints
- Zero `:any` types
- Zero `console.*`
- E `.js` extensions
- Must pass `npx vitest run` with 0 regressions from 515 baseline
- Mock external `fetch` via `vi.stubGlobal('fetch', ...)` when needed
- No source code changes — tests only

## Files to Create
- `src/__tests__/tree/pretix/hmac-validator.test.ts`
- `src/__tests__/tree/pretix/types.test.ts`
- `src/__tests__/tree/campaigns/triggers/birthday.test.ts`
- `src/__tests__/tree/campaigns/triggers/welcome.test.ts`
- `src/__tests__/tree/referrals/apply-referral.test.ts`
- `src/__tests__/tree/referrals/referral-cashback.test.ts`
- `src/__tests__/routes/payments-momo-smoke.test.ts`
- `src/__tests__/routes/refunds-smoke.test.ts`
- `src/__tests__/routes/webhooks-momo-smoke.test.ts`

## Validation
- `npx vitest run` → all pass, ≥30 new tests
- No regressions from 515 baseline
- `git diff --stat` shows only new test files

## Rollback
Delete all files in `src/__tests__/tree/pretix/`, `src/__tests__/tree/campaigns/triggers/`, `src/__tests__/tree/referrals/`, and the 3 smoke test files.
