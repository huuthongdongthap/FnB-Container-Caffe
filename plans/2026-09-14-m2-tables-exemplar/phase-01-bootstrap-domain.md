# Phase 01 — Bootstrap `packages/domain/table`

**Status:** completed · **Depends:** none

## Steps

1. Create `packages/domain/table/package.json` — clone `@aura/domain-catalog` fields, name `@aura/domain-table`, version 0.1.0
2. Create `packages/domain/table/tsconfig.json` — clone catalog's (target es2022, moduleResolution bundler, noEmit, exclude `__tests__`)
3. Register aliases (verify alphabetical order at insert time — `table` sorts between `order` and `kitchen`):
   - root `tsconfig.json` paths: `@aura/domain-table` → `./packages/domain/table/index.ts`, `@aura/domain-table/*` → `./packages/domain/table/*`
   - `worker/tsconfig.json` paths: `../packages/domain/table/index.ts`, `../packages/domain/table/*`
   - `vitest.config.ts` resolve.alias: `'@aura/domain-table': ./packages/domain/table/index.ts`
4. Create `model/table-types.ts` — move `CafeTable` (L9-18), `QrCodeRow` (L20-23) from `worker/src/routes/tables.ts`
5. Create empty `index.ts` placeholder (filled in phase 02)

## Verify

- `npx tsc -p worker/tsconfig.json` — no new errors vs baseline 576
- `npm test -- --run tests/tables.test.ts` still green (aliases didn't break resolution)
