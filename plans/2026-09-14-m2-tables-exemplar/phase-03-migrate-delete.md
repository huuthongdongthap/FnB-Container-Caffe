# Phase 03 — Migrate callers + delete old file (một nhịp)

**Status:** completed · **Depends:** phase 02

## Caller migration (3 sites)

1. `worker/src/index.ts` L42: `import { tablesRouter, qrRouter } from './routes/tables'` → `from '@aura/domain-table'`
   - L244 `app.route('/api/tables', tablesRouter)` — unchanged
   - L252 `app.route('/api/qr', qrRouter)` — unchanged
2. `tests/tables.test.ts` L111: `await import('../worker/src/routes/tables')` → `await import('@aura/domain-table')`
3. `worker/src/__tests__/routes/tables.test.ts` L2: `import { tablesRouter, qrRouter, type CafeTable, type QrCodeRow } from '../../routes/tables'` → `from '@aura/domain-table'`
   - L3 signer import (`../../tree/qr/signer`) — unchanged (stays in worker)

## Grep sweep (before delete)

- `grep -rn "routes/tables'" worker/src tests packages --include="*.ts"` — catch every specifier (exclude `routes/tables-mobile`, `openapi-tables` — they stay)
- `grep -rn "vi.mock" tests/tables.test.ts worker/src/__tests__/routes/tables.test.ts` — confirm mock paths still bind (`../worker/src/middleware/auth.js` stays valid: domain imports same specifier)
- `grep -rn "await import" tests` — catch dynamic specifiers

## Delete

- `worker/src/routes/tables.ts` (the shim)

## Post-deletion sweep

1. Full `npm test -- --run` — any importer grep missed shows as module-not-found
2. Fix stragglers → rerun until green
3. `npx tsc -p worker/tsconfig.json` — delta within M1 band (baseline 576)

## Verify

- Full suite green (baseline 360 files / 3274 tests)
- Zero remaining references to `worker/src/routes/tables` repo-wide (bare specifier only; `-mobile`/`openapi-` variants stay)
