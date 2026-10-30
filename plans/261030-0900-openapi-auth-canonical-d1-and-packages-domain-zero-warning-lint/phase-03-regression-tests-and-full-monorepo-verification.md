# Phase 03: Regression Tests, Full Verification & Baseline Lock

## Context Links
- [Brainstorm Report](../reports/brainstorm-261030-openapi-auth-canonical-d1-and-packages-domain-zero-warning-lint.md)
- `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts`
- `reports/audit/plan/261029-1703-all-identities/evidence/source-baseline.json`

## Overview
- **Priority:** P0
- **Current Status:** Complete
- **Description:** Add regression tests for OpenAPI auth/staff/device handlers on canonical D1 and `staffSessionFixture`, run full monorepo verification, and synchronize `source-baseline.json`.

## Related Code Files
- Modify: `worker/src/__tests__/routes/auth.test.ts`
- Modify: `reports/audit/plan/261029-1703-all-identities/evidence/source-baseline.json`

## Todo List
- [x] Add regression tests for `GET /api/auth/devices`, `POST /api/auth/register-staff`, `GET /api/auth/staff`, `POST /api/auth/login`, and `GET /api/auth/me`
- [x] Run `npm run lint`, `npm run typecheck:all`, `npm run lint:migrations`, `npx vitest run`, `npx vite build --logLevel error`, `npm run verify:gates`
- [x] Synchronize `source-baseline.json` and mark all plan phases Complete
