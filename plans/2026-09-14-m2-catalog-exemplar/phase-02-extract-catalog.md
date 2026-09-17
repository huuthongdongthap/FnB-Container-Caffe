# Phase 02 — Extract catalog surface into domain

**Status:** completed · **Depends:** phase 01

## File moves (order: cleanest first)

1. `commands/menu-modifiers.ts` ← `worker/src/routes/menu-modifiers.ts`
   - Internal types → `../model/catalog-types`
   - Replace the `/happy-hour/now` inline SQL match block with call to `../policies/pricing.ts`
   - Deps: only `hono` + `Env` (via `worker/src/types/env` alias)
2. `policies/pricing.ts` — extract pure function:
   ```ts
   happyHourDiscountFor(windows: HappyHourWindow[], now: Date): HappyHourWindow | null
   ```
   Move day/time/priority/discount match logic out of `/happy-hour/now`. Route keeps the SQL fetch (active windows) then delegates to policy. Preserve exact match semantics: `day_of_week =`, `start <= end`, `start <= t < end`, `priority DESC, discount_rate DESC LIMIT 1`.
3. `policies/availability.ts` — extract pure helpers used by menu queries:
   - `parseAvailabilityFilter(raw: string | null): 0 | 1 | null`
   - `toAvailabilityFlag(v: unknown): boolean`
   (today inline in menu.ts lines 32-34, 51, 63-64, 101)
4. `queries/menu.ts` ← `worker/src/routes/menu.ts` — `getMenu(request, env)` / `getMenuItem(request, env, id)` unchanged signatures; deps → `worker/src/middleware/{cors,logger}`, type `MenuItem` from `worker/src/types/models` (alias)
5. `commands/products.ts` ← `worker/src/routes/products.ts` — deps → `worker/src/lib/validators`, `worker/src/middleware/{auth,audit-log}`, `worker/src/types/env`; type `Product` from model
6. `commands/categories.ts` ← `worker/src/routes/categories.ts` — same repoints; type `Category` from model
7. `schemas/products.ts` + `schemas/categories.ts` ← `worker/src/schemas/{products,categories}.ts` — `./common` import → `worker/src/schemas/common` (stays in worker: shared by 10 other schema files)
8. `index.ts` — re-export: productsRouter, categoriesRouter, menuModifiersRouter, getMenu, getMenuItem, ProductRoutes, CategoryRoutes, model types, policy functions

## Conventions (match kitchen domain)

- Import worker infra via `worker/src/...` alias (validated pattern from kitchen-stations.ts)
- Keep HTTP shape, SQL, and route paths byte-identical — this is a move, not a rewrite
- No new deps; `hono` + `zod` + `@hono/zod-openapi` only (already workspace-rooted)

## Worker-side shims (temporary, die in phase 03)

`worker/src/routes/{products,menu,categories,menu-modifiers}.ts` + `worker/src/schemas/{products,categories}.ts` become 1-line re-exports of domain paths so the tree stays green while callers migrate.

## Verify

- Root `npx tsc -p worker/tsconfig.json` delta ≤ baseline 1239 + temporary shim noise
- Targeted: `npm test -- --run tests/menu.test.ts tests/products.test.ts tests/categories.test.ts worker/src/__tests__/tree/menu-modifiers/` green through shims
