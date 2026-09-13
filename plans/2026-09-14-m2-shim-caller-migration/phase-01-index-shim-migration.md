# Phase 01 — index.ts Kitchen + Payment Shim Migration

## Context
- M2 plan: `plans/2026-09-14-m2-shim-caller-migration/plan.md`
- M1 Batch 6 completed domains for payment + kitchen; shims still consumed by `worker/src/index.ts`.

## Scope
Migrate 5 imports in `worker/src/index.ts` off shim paths:

| Line | Current import | New import |
|------|----------------|------------|
| 31 | `import { paymentRouter } from './routes/payments';` | `import { paymentRouter } from '@aura/domain-payment';` |
| 45 | `import { kitchenStationsRouter } from './routes/kitchen-stations';` | `import { kitchenStationsRouter } from '@aura/domain-kitchen';` |
| 57 | `import { kdsStreamRouter } from './routes/kds-stream';` | `import { kdsStreamRouter } from '@aura/domain-kitchen';` |
| 69 | `import { nowPaymentsIPN } from './routes/payments-nowpayments';` | `import { nowPaymentsIPN } from '@aura/domain-payment';` |
| 122 | `import { getKdsMobile, updateKdsStatus } from './routes/kds-mobile';` | `import { getKdsMobile, updateKdsStatus } from '@aura/domain-kitchen';` |

## Steps
1. Edit `worker/src/index.ts` lines 31, 45, 57, 69, 122 — replace import source, keep symbols/order.
2. Verify no other references to those 5 shim files from prod code.
3. Run worker tests for the affected routes (payments, kitchen-stations, mobile-kds) to confirm import resolution via vite/vitest aliases.
4. `git add worker/src/index.ts` only. Do NOT delete shims yet (test files still import them — phase 03).

## Acceptance
- `grep "routes/payments'\|kitchen-stations'\|kds-stream'\|kds-mobile'\|payments-nowpayments'" worker/src/index.ts` returns nothing.
- Payments + kitchen test files green.
- No TS/lint regression in `worker/src/index.ts`.

## Out of scope
- Orders block in index.ts (phase 02).
- Test file migration (phase 03).
- Shim deletion (phase 04).
