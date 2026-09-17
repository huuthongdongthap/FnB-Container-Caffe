# Phase 01 — Bootstrap `packages/domain/catalog`

**Status:** completed · **Depends:** none

## Steps

1. Create `packages/domain/catalog/package.json` — clone `@aura/domain-order` fields, name `@aura/domain-catalog`, version 0.1.0
2. Create `packages/domain/catalog/tsconfig.json` — clone order's (target es2022, moduleResolution bundler, noEmit, exclude `__tests__`)
3. Register aliases:
   - root `tsconfig.json` paths: `@aura/domain-catalog` → `./packages/domain/catalog/index.ts`, `@aura/domain-catalog/*` → `./packages/domain/catalog/*` (insert after kitchen, keep alphabetical: customer, crm, kitchen last currently → catalog goes FIRST alphabetically, before customer)
   - `worker/tsconfig.json` paths: `../packages/domain/catalog/index.ts`, `../packages/domain/catalog/*` (before customer)
   - `vitest.config.ts` resolve.alias: `'@aura/domain-catalog': ./packages/domain/catalog/index.ts`
4. Create `model/catalog-types.ts` — move `Product` (from routes/products.ts), `Category` (routes/categories.ts), `ModifierGroup`/`ModifierChoice`/`HappyHourWindow` (routes/menu-modifiers.ts). `MenuItem` stays in `worker/src/types/models` (used by order/kitchen domains too — shared type, not catalog-owned).
5. Create empty `index.ts` placeholder (filled in phase 02)

## Verify

- `npx tsc -p worker/tsconfig.json` — no new errors vs baseline 1239
- `npm test -- --run tests/menu.test.ts` still green (aliases didn't break resolution)
