# Phase 01 — Bootstrap `packages/domain/staff` + `packages/domain/shift`

**Status:** pending · **Depends:** none

## Steps

1. Create `packages/domain/staff/package.json` — clone `@aura/domain-table` fields, name `@aura/domain-staff`, version 0.1.0
2. Create `packages/domain/staff/tsconfig.json` — clone table's (target es2022, moduleResolution bundler, noEmit, exclude `__tests__`)
3. Create `packages/domain/shift/package.json` — name `@aura/domain-shift`, version 0.1.0
4. Create `packages/domain/shift/tsconfig.json` — same as staff's
5. Register aliases (verify alphabetical order at insert time):
   - root `tsconfig.json` paths: `@aura/domain-staff` → `./packages/domain/staff/index.ts`, `@aura/domain-staff/*` → `./packages/domain/staff/*`; `@aura/domain-shift` → `./packages/domain/shift/index.ts`, `@aura/domain-shift/*` → `./packages/domain/shift/*`
   - `worker/tsconfig.json` paths: `../packages/domain/staff/index.ts`, `../packages/domain/staff/*`, `../packages/domain/shift/index.ts`, `../packages/domain/shift/*`
   - `vitest.config.ts` resolve.alias: `'@aura/domain-staff': ./packages/domain/staff/index.ts`, `'@aura/domain-shift': ./packages/domain/shift/index.ts`
6. Create empty `index.ts` placeholders for both packages (filled in phase 02)

## Verify

- `npx tsc -p worker/tsconfig.json` — no new errors vs baseline 1280
- `npm test -- --run tests/shifts.test.ts worker/src/__tests__/lib/staff-roles.test.ts` still green (aliases didn't break resolution)
