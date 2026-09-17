# M2 Catalog Exemplar (D10) — Extract `packages/domain/catalog`

**Date:** 2026-09-14 · **Pattern:** M2 one-nhịp (extract → migrate → delete, per fcce027) · **Status:** done

## Goal

Move the catalog surface — products, categories, menu, menu-modifiers (+ happy-hour), OpenAPI product/category schemas — into `packages/domain/catalog` with pricing/availability policies separated per D10, then migrate all callers and delete the worker copies in this same plan. Zero DDL, zero contract change, zero frontend impact.

## Scope (user-confirmed)

- **Full catalog**: `routes/products.ts`, `routes/menu.ts`, `routes/categories.ts`, `routes/menu-modifiers.ts`, `schemas/products.ts`, `schemas/categories.ts`
- **Policies separated**: `domain/catalog/policies/pricing.ts` (happy-hour match) + `policies/availability.ts` (filter normalization)
- **Một nhịp**: extract + migrate + delete in one plan — no shim dwell time (M2 order/payment/kitchen pattern collapsed into single session)

## Target structure

```
packages/domain/catalog/
├── index.ts                  # re-export commands + queries + schemas + policies
├── package.json              # @aura/domain-catalog
├── tsconfig.json             # clone of domain/order tsconfig
├── model/catalog-types.ts    # Product, Category, ModifierGroup, ModifierChoice, HappyHourWindow
├── commands/
│   ├── products.ts           # productsRouter (Hono CRUD)
│   ├── categories.ts         # categoriesRouter
│   └── menu-modifiers.ts     # menuModifiersRouter + happy-hour CRUD/eval
├── queries/menu.ts           # getMenu/getMenuItem (plain handlers, signature unchanged)
├── policies/
│   ├── pricing.ts            # happyHourDiscountFor(windows, now) — pure, testable
│   └── availability.ts       # parseAvailabilityFilter + toAvailabilityFlag — pure
└── schemas/
    ├── products.ts           # ProductRoutes (zod-openapi)
    └── categories.ts         # CategoryRoutes
```

Deps of moved files repoint to `worker/src/...` aliases: `lib/validators`, `middleware/{cors,logger,auth,audit-log}`, `types/{env,models}`, `schemas/common` (stays in worker — shared by 12 other schema files).

## Callers to migrate

| Caller | Change |
|---|---|
| `worker/src/index.ts` | lines 16/44/51/52 → `@aura/domain-catalog` |
| `worker/src/lib/openapi.ts` | lines 4-5 ProductRoutes/CategoryRoutes → `@aura/domain-catalog` |
| `worker/src/routes/openapi-products.ts` | line 5 → domain schemas |
| `worker/src/routes/openapi-categories.ts` | line 6 → domain schemas |
| `tests/{products,menu,categories}.test.ts` | dynamic `await import('../worker/src/routes/...')` → `@aura/domain-catalog` |
| `worker/src/__tests__/routes/menu.test.ts` | line 6 → `@aura/domain-catalog/queries/menu` |
| `worker/src/__tests__/routes/categories.test.ts` | line 4 → `@aura/domain-catalog` |
| `worker/src/__tests__/tree/menu-modifiers/menu-modifiers.test.ts` | line 9 → `@aura/domain-catalog/commands/menu-modifiers` |

## Delete after migration

`worker/src/routes/{products,menu,categories,menu-modifiers}.ts`, `worker/src/schemas/{products,categories}.ts`

## Config

Add `@aura/domain-catalog` + `@aura/domain-catalog/*` aliases → root `tsconfig.json`, `worker/tsconfig.json`, `vitest.config.ts`.

## Phases

1. `phase-01-bootstrap-domain.md` — package skeleton + aliases + model types
2. `phase-02-extract-catalog.md` — move 6 files, extract policies, repoint internal deps
3. `phase-03-migrate-delete.md` — migrate 8 caller sites + delete 6 old files + post-deletion sweep
4. `phase-04-verify-docs.md` — full suite + tsc delta + changelog/journal/phase-map

## Acceptance (D10)

- Menu/products/categories/modifiers serve from `@aura/domain-catalog` — zero route contract change
- Availability filter still enforced server-side (menu query `available` param)
- Happy-hour price eval server-side, match rule now a pure policy function
- Full suite green (baseline: 360 files / 3274 tests) · tsc delta within legacy band (baseline 1239)
- No vi.mock targeting old paths; post-deletion test run is the real sweep (fcce027 lesson)

## Risks

- Schema move drags `worker/src/schemas/common` into domain imports → mitigated by alias, common stays put
- Dynamic-import/straggler sweep misses a caller → mitigated by post-deletion full run + grep of `vi.mock` + `await import` (fcce027 lessons)
