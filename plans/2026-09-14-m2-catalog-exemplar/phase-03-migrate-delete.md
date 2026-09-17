# Phase 03 — Migrate callers + delete old files (một nhịp)

**Status:** completed · **Depends:** phase 02

## Caller migration (all 8 sites)

1. `worker/src/index.ts`
   - line 16: `getMenu, getMenuItem` → `@aura/domain-catalog`
   - line 44: `menuModifiersRouter` → `@aura/domain-catalog`
   - line 51: `categoriesRouter` → `@aura/domain-catalog`
   - line 52: `productsRouter` → `@aura/domain-catalog`
2. `worker/src/lib/openapi.ts` lines 4-5: `CategoryRoutes`/`ProductRoutes` → `@aura/domain-catalog`
3. `worker/src/routes/openapi-products.ts` line 5 → `@aura/domain-catalog`
4. `worker/src/routes/openapi-categories.ts` line 6 → `@aura/domain-catalog`
5. `tests/products.test.ts` line 94: `await import('@aura/domain-catalog/commands/products')`
6. `tests/menu.test.ts` line 41: `await import('@aura/domain-catalog/queries/menu')`
7. `tests/categories.test.ts` line 91: `await import('@aura/domain-catalog/commands/categories')`
8. `worker/src/__tests__/routes/menu.test.ts` line 6, `routes/categories.test.ts` line 4, `tree/menu-modifiers/menu-modifiers.test.ts` line 9 → domain paths

## Grep sweep (fcce027 lessons — before delete)

- `grep -rn "routes/products\|routes/menu\|routes/categories\|routes/menu-modifiers" --include="*.ts"` (src, worker, tests, packages)
- `grep -rn "schemas/products\|schemas/categories" worker/src`
- `grep -rn "vi.mock" tests worker/src/__tests__` — confirm no mock binds old specifiers
- `grep -rn "await import" tests` — catch every dynamic specifier

## Delete

- `worker/src/routes/products.ts`, `routes/menu.ts`, `routes/categories.ts`, `routes/menu-modifiers.ts`
- `worker/src/schemas/products.ts`, `schemas/categories.ts`

## Post-deletion sweep (the only real straggler check)

1. Full `npm test -- --run` — any importer grep missed shows here as module-not-found failure
2. Fix stragglers → rerun until green
3. `npx tsc -p worker/tsconfig.json` — delta within legacy band (baseline 1239)

## Verify

- Full suite green (baseline 360 files / 3274 tests)
- Zero remaining references to the 6 deleted paths repo-wide
