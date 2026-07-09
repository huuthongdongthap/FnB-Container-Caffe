# Phase 2b-2: Payment & Integration Routes (HIGH)

**Goal:** Add unit tests for financial and attack-surface routes that currently have zero coverage.

## Routes to test
- `src/routes/refunds.ts` (277 lines — CRITICAL financial)
- `src/routes/webhooks.ts` (208 lines — HIGH attack surface)
- `src/routes/payments/momo-create.ts` (just fixed, needs coverage)
- `src/routes/pretix.ts` (195 lines — HIGH)
- `src/routes/campaigns.ts` (259 lines — HIGH)
- `src/routes/referrals.ts` (191 lines — HIGH)

## Clients to test (tree-level)
- `src/clients/erpnext-*.ts` (4 files — 100% untested)
- `src/clients/frigate-client.ts` — 0 tree tests (integration stubs exist but no tests)
- `src/clients/tastyigniter-client.ts` — already has tests at `src/__tests__/routes/integrations/tastyigniter.test.ts` (verify intact)

## Test file locations
- `src/__tests__/routes/refunds.test.ts`
- `src/__tests__/routes/webhooks-momo.test.ts`
- `src/__tests__/tree/integrations/erpnext/` (4 client test files)
- `src/__tests__/tree/integrations/frigate.test.ts`

## Integration test pattern
Use `createMockDB()` with seeded data: `{ tableName: [{ col: val, ... }] }` as shown in `tastyigniter.test.ts` and `frigate.test.ts`.

## Acceptance
- Each high-priority route has ≥2 test cases.
- `npx vitest run` passes (471 existing + new).
- No test touches real network (all mocked via `fetch` intercept or mock env).
