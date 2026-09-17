# Phase 03 — Migrate callers + delete shims (một nhịp)

**Status:** pending · **Depends:** phase 02

## Caller migration (9 sites)

1. `worker/src/index.ts` L48: `import { staffTipsRouter } from './routes/staff-tips'` → `from '@aura/domain-staff'`
2. `worker/src/index.ts` L59: `import { shiftsRouter } from './routes/shifts'` → `from '@aura/domain-shift'`
3. `worker/src/index.ts` L117-120: 5 staff-auth handlers → `from '@aura/domain-staff'`
4. `worker/src/middleware/staff-auth.ts` L10: `import { ROLE_LABELS } from '../lib/staff-roles'` → `from '@aura/domain-staff'` (add 1 caller, no cycle since staff-roles is pure)
5. `worker/src/__tests__/routes/staff-auth-mobile.test.ts` L8: 5 handlers → `@aura/domain-staff`
6. `worker/src/__tests__/routes/_diag-staff-auth.test.ts` L2: staffMobileLogin → `@aura/domain-staff`
7. `worker/src/__tests__/routes/_diag-list-devices.test.ts` L2: listStaffDevices → `@aura/domain-staff`
8. `worker/src/__tests__/tree/staff-tips/staff-tips.test.ts` L3: staffTipsRouter → `@aura/domain-staff`
9. `worker/src/__tests__/lib/staff-roles.test.ts` L2: → `@aura/domain-staff`
10. `tests/shifts.test.ts` L21: dynamic import → `@aura/domain-shift`

## Grep sweep (before delete)

- `grep -rn "routes/staff-auth\|routes/staff-tips\|routes/shifts\|lib/staff-roles" worker/src tests packages --include="*.ts"` — catch every specifier (exclude `routes/openapi-staff`, `schemas/staff.ts`, `middleware/staff-auth.ts`, `reminders/shifts/route.ts` — they stay)
- `grep -rn "vi.mock" worker/src/__tests__/tree/staff-tips/staff-tips.test.ts tests/shifts.test.ts` — confirm mock paths still bind

## Delete

- `worker/src/routes/staff-auth.ts` (shim)
- `worker/src/routes/staff-tips.ts` (shim)
- `worker/src/routes/shifts.ts` (shim)
- `worker/src/lib/staff-roles.ts` (shim)

## Post-deletion sweep

1. Full `npm test -- --run` — any importer grep missed shows as module-not-found
2. Fix stragglers → rerun until green
3. `npx tsc -p worker/tsconfig.json` — delta within M1/M2 band (baseline 1280)

## Verify

- Full suite green (baseline 360 files / 3274 tests)
- Zero remaining references to `routes/staff-auth`, `routes/staff-tips`, `routes/shifts`, `lib/staff-roles` repo-wide (bare specifier only)
