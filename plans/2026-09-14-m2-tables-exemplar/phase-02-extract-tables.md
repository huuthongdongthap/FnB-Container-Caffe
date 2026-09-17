# Phase 02 — Extract tables surface into domain

**Status:** completed · **Depends:** phase 01

## File moves

1. `model/table-types.ts` — `CafeTable`, `QrCodeRow` (done in phase 01, referenced here)
2. `commands/tables.ts` ← `worker/src/routes/tables.ts` (tablesRouter portion):
   - GET `/` — zone/status filters
   - POST `/` — create (insert + audit)
   - PATCH `/:id` — update fields
   - PATCH `/:id/status` — status change (requireAuth + audit)
   - DELETE `/:id`
   - Deps → `worker/src/lib/validators`, `worker/src/middleware/{auth,audit-log}`, `worker/src/types/env`, `worker/src/tree/qr/signer` (qrRouter uses signer too), `qrcode` stays root
3. `commands/qr-scan.ts` ← `worker/src/routes/tables.ts` (qrRouter portion):
   - GET `/:slug` — ts/sig verify → resolve table → generate QR PNG response
   - Same dep set as tables.ts
4. `policies/status.ts` — extract pure policy:
   ```ts
   export const TABLE_STATUS_TRANSITIONS: Record<CafeTable['status'], readonly CafeTable['status'][]>
   export function canTransitionTo(current: CafeTable['status'], target: CafeTable['status']): boolean
   ```
   v1 semantics preserved: all 4 statuses (`Available/Occupied/Reserved/Overdue`) are legal targets from any current status (current code has no guard). Policy encodes this as data — route keeps behavior byte-identical; guard becomes testable.
5. `index.ts` — re-export: `tablesRouter`, `qrRouter`, `TABLE_STATUS_TRANSITIONS`, `canTransitionTo`, model types

## Conventions (match catalog domain)

- Import worker infra via `worker/src/...` alias (validated pattern)
- Keep HTTP shape, SQL, and route paths byte-identical — this is a move, not a rewrite
- `vi.mock('../worker/src/middleware/auth.js')` in `tests/tables.test.ts` binds by module specifier — moved router MUST import auth as `worker/src/middleware/auth` (not a relative path) so the mock continues to bind through the alias-resolved module graph
- No new deps; `hono` + `qrcode` only (already workspace-rooted)

## Worker-side shim (temporary, dies in phase 03)

`worker/src/routes/tables.ts` becomes 1-line re-export of `@aura/domain-table` so the tree stays green while callers migrate.

## Verify

- `npx tsc -p worker/tsconfig.json` delta ≤ baseline 576 + temporary shim noise
- Targeted: `npm test -- --run tests/tables.test.ts worker/src/__tests__/routes/tables.test.ts` green through shim
