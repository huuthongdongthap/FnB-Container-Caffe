# Phase 02 — Extract staff + shift surface into domain

**Status:** pending · **Depends:** phase 01

## File moves — `@aura/domain-staff`

1. `model/staff-types.ts` — `StaffTipRow` (from routes/staff-tips.ts L16-23)
2. `commands/staff-auth.ts` ← `worker/src/routes/staff-auth.ts` (all 5 exported handlers + hashPin/verifyPin/findDevice/upsertDevice private helpers):
   - staffMobileLogin, staffTokenRefresh, registerStaffDevice, revokeStaffDevice, listStaffDevices
   - Deps → `worker/src/middleware/{cors,logger}`, `worker/src/lib/{jwt,validators}`, `worker/src/tree/auth/helpers`, `worker/src/types/{env,api}`
3. `commands/staff-tips.ts` ← `worker/src/routes/staff-tips.ts` (staffTipsRouter: GET `/` daily rollup + POST `/assign`):
   - Deps → `worker/src/middleware/{cors,auth}`, `worker/src/types/env`
4. `lib/staff-roles.ts` ← `worker/src/lib/staff-roles.ts` (verbatim — pure, zero deps)
5. `index.ts` — re-export: 5 staff-auth handlers, staffTipsRouter, StaffTipRow, StaffRole, STAFF_ROLES, ROLE_LABELS, ROLE_PERMISSIONS, hasPermission, visibleRolesFor

## File moves — `@aura/domain-shift`

1. `model/shift-types.ts` — `ShiftRecord` (from routes/shifts.ts L11-18)
2. `commands/shifts.ts` ← `worker/src/routes/shifts.ts` (shiftsRouter: POST `/clock-in`, POST `/clock-out`, GET `/` history):
   - Deps → `worker/src/lib/validators`, `worker/src/middleware/auth`, `worker/src/types/env`
3. `index.ts` — re-export: shiftsRouter, ShiftRecord

## Conventions (match catalog/table domain)

- Import worker infra via `worker/src/...` alias (validated pattern)
- Keep HTTP shape, SQL, and route paths byte-identical — this is a move, not a rewrite
- staff-auth handlers export as plain async functions (no router wrap) — preserves `worker/src/index.ts` L117-120 import shape + test imports
- staff-tips router imports auth as `worker/src/middleware/auth` (NOT relative) so `vi.mock('../worker/src/middleware/auth.js')` in tests keeps binding
- shifts router imports auth as `worker/src/middleware/auth` (same binding constraint for tests/shifts.test.ts if it mocks auth)
- No new deps; `hono` only (already workspace-rooted)

## Worker-side shims (temporary, die in phase 03)

- `worker/src/routes/staff-auth.ts` → 1-line re-export of `@aura/domain-staff`
- `worker/src/routes/staff-tips.ts` → 1-line re-export
- `worker/src/routes/shifts.ts` → 1-line re-export
- `worker/src/lib/staff-roles.ts` → 1-line re-export

## Verify

- `npx tsc -p worker/tsconfig.json` delta ≤ baseline 1280 + temporary shim noise
- Targeted: `npm test -- --run tests/shifts.test.ts worker/src/__tests__/routes/staff-auth-mobile.test.ts worker/src/__tests__/tree/staff-tips/staff-tips.test.ts worker/src/__tests__/lib/staff-roles.test.ts worker/src/__tests__/routes/_diag-staff-auth.test.ts worker/src/__tests__/routes/_diag-list-devices.test.ts` green through shims
