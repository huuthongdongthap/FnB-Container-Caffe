# Phase 03: Regression Tests, Full Verification & Baseline Lock

## Context Links
- [Brainstorm Report](../reports/brainstorm-261030-incremental-migration-parity-and-full-monorepo-zero-warning-lint.md)
- `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts`
- `worker/src/__tests__/routes/web-payment-and-staging-gates.test.ts`
- `reports/audit/plan/261029-1703-all-identities/evidence/source-baseline.json`

## Overview
- **Priority:** P0
- **Current Status:** Complete
- **Description:** Update migration count assertions (`58` forward / `16` down in `worker/db/migrations`), add 3-way 124-table + column parity and `GET /api/loyalty/admin/accounts?search=` regression tests, run full monorepo verification, and synchronize `source-baseline.json`.

## Related Code Files
- Modify: `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts`
- Modify: `worker/src/__tests__/routes/web-payment-and-staging-gates.test.ts`
- Modify: `reports/audit/plan/261029-1703-all-identities/evidence/source-baseline.json`

## Todo List
- [x] Update migration count in `web-payment-and-staging-gates.test.ts` (`58` forward / `16` down)
- [x] Add 124-table + column parity and loyalty admin search regression tests in `loyalty-referrals-inventory-po-cutover.test.ts`
- [x] Run `npm run typecheck:all`, `npx eslint worker/src/ src/ --max-warnings=0`, `npx vitest run`, `npx vite build --logLevel error`, `npm run verify:gates`
- [x] Synchronize `source-baseline.json` and plan status
