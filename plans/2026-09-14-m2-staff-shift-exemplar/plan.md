# M2 Staff + Shift Exemplar — Extract `packages/domain/staff` + `packages/domain/shift`

**Date:** 2026-09-14 · **Pattern:** M2 một-nhịp (extract → migrate → delete, per catalog/tables exemplar) · **Status:** completed

## Goal

Move `worker/src/routes/staff-auth.ts` (270 LOC, 5 exported handlers), `worker/src/routes/staff-tips.ts` (98 LOC, staffTipsRouter), `worker/src/lib/staff-roles.ts` (52 LOC, RBAC) into `packages/domain/staff`; move `worker/src/routes/shifts.ts` (127 LOC, shiftsRouter) into `packages/domain/shift`. Migrate all callers, delete worker copies — same session. Zero DDL, zero contract change, zero frontend impact.

## Scope (user-confirmed: 2 packages)

**IN — `@aura/domain-staff`:**
- `worker/src/routes/staff-auth.ts` — 5 handlers: staffMobileLogin, staffTokenRefresh, registerStaffDevice, revokeStaffDevice, listStaffDevices
- `worker/src/routes/staff-tips.ts` — staffTipsRouter + StaffTipRow
- `worker/src/lib/staff-roles.ts` — StaffRole, STAFF_ROLES, ROLE_LABELS, ROLE_PERMISSIONS, hasPermission, visibleRolesFor

**IN — `@aura/domain-shift`:**
- `worker/src/routes/shifts.ts` — shiftsRouter + ShiftRecord

**OUT (explicit):**
- `worker/src/schemas/staff.ts` (StaffRoutes enum, schema-coupled)
- `worker/src/routes/openapi-staff.ts` (612 LOC, schema-coupled)
- `worker/src/middleware/staff-auth.ts` (requireStaff middleware — security primitive, cross-domain)
- `worker/src/routes/reminders/shifts/route.ts` (sendShiftReminders — plain function, does NOT import shifts.ts)
- `worker/src/routes/tables-mobile.ts`, `orders-mobile.ts` (mobile routes — separate surface)

## Caller migration (6 sites)

1. `worker/src/index.ts` L48: `import { staffTipsRouter } from './routes/staff-tips'` → `@aura/domain-staff`
2. `worker/src/index.ts` L59: `import { shiftsRouter } from './routes/shifts'` → `@aura/domain-shift`
3. `worker/src/index.ts` L117-118: 5 staff-auth handlers → `@aura/domain-staff`
4. `worker/src/__tests__/routes/staff-auth-mobile.test.ts` L8: 5 handlers → `@aura/domain-staff`
5. `worker/src/__tests__/routes/_diag-staff-auth.test.ts` L2: staffMobileLogin → `@aura/domain-staff`
6. `worker/src/__tests__/routes/_diag-list-devices.test.ts` L2: listStaffDevices → `@aura/domain-staff`
7. `worker/src/__tests__/tree/staff-tips/staff-tips.test.ts` L3: staffTipsRouter → `@aura/domain-staff`
8. `tests/shifts.test.ts` L21: dynamic import → `@aura/domain-shift`
9. `worker/src/__tests__/lib/staff-roles.test.ts` L2: → `@aura/domain-staff`

## Conventions (match catalog/tables domain)

- Import worker infra via `worker/src/...` alias (validated pattern)
- Keep HTTP shape, SQL, and route paths byte-identical — this is a move, not a rewrite
- `vi.mock('../worker/src/middleware/auth.js')` in staff-tips test binds by module specifier — moved router MUST import auth as `worker/src/middleware/auth` (not relative) so the mock continues to bind
- staff-auth.ts uses `Context<{ Bindings: Env }>` directly (no Hono router) — handlers stay as exported async functions, NOT wrapped in a router
- No new deps; `hono` only (already workspace-rooted)

## Verify

- `npx tsc -p worker/tsconfig.json` delta ≤ baseline 1280 + temporary shim noise
- Targeted: `npm test -- --run tests/shifts.test.ts worker/src/__tests__/routes/staff-auth-mobile.test.ts worker/src/__tests__/tree/staff-tips/staff-tips.test.ts worker/src/__tests__/lib/staff-roles.test.ts` green through shim
- Full suite: 360 files / 3274 tests green
- Zero remaining references to `routes/staff-auth`, `routes/staff-tips`, `routes/shifts`, `lib/staff-roles` (bare specifier only)

## Risks

- staff-auth.ts uses `crypto.subtle` (Web Crypto API) — Cloudflare Workers runtime, no Node dependency. Domain package must NOT pull in Node crypto. Mitigated: code uses global `crypto`, no import.
- staff-tips test mocks `../worker/src/middleware/auth.js` — same binding constraint as tables/catalog. Mitigated: moved router imports auth via `worker/src/middleware/auth` specifier.
- staff-roles.ts is a pure helper (no worker deps) — moves cleanly, but `middleware/staff-auth.ts` imports `ROLE_LABELS` from it. After move, middleware imports from `@aura/domain-staff` (adds 1 caller, no cycle since staff-roles has no deps).
