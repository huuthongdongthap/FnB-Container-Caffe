# Phase 03: Worker Zero-Warning ESLint & Regression Tests

## Context Links
- [Brainstorm Report](../reports/brainstorm-261030-schema-bootstrap-parity-and-legacy-fallback-hardening.md)
- `worker/src/routes/openapi-sop-handlers/sop-admin-read-handlers.ts`
- `worker/src/routes/openapi-sop-handlers/sop-admin-write-handlers.ts`
- `worker/src/routes/sop-mobile/queries.ts`
- `worker/src/schemas/sop-routes.ts`
- `worker/src/schemas/sop.ts`
- `worker/src/types/module-ambient.d.ts`
- `worker/src/__tests__/routes/web-payment-and-staging-gates.test.ts`
- `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts`

## Overview
- **Priority:** P1
- **Current Status:** Complete
- **Description:** Clean all 6 unused-symbol ESLint warnings in `worker/src/`, update migration count assertions in `web-payment-and-staging-gates.test.ts`, and add empirical regression tests in `loyalty-referrals-inventory-po-cutover.test.ts`.

## Related Code Files
- Modify: `worker/src/routes/openapi-sop-handlers/sop-admin-read-handlers.ts`
- Modify: `worker/src/routes/openapi-sop-handlers/sop-admin-write-handlers.ts`
- Modify: `worker/src/routes/sop-mobile/queries.ts`
- Modify: `worker/src/schemas/sop-routes.ts`
- Modify: `worker/src/schemas/sop.ts`
- Modify: `worker/src/types/module-ambient.d.ts`
- Modify: `worker/src/__tests__/routes/web-payment-and-staging-gates.test.ts`
- Modify: `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts`

## Todo List
- [x] Clean 6 unused declarations in `worker/src/`
- [x] Update migration count in `web-payment-and-staging-gates.test.ts`
- [x] Add regression tests in `loyalty-referrals-inventory-po-cutover.test.ts`
