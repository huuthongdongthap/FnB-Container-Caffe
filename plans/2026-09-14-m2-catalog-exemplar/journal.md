# M2 Catalog Domain Exemplar (D10) — Journal

**Status:** done · **Started:** 2026-09-14 · **Duration:** ~1 session (extract+migrate+delete in one nhịp)
**Lead:** phanmem.site AI · **Plan:** `plans/2026-09-14-m2-catalog-exemplar/`

## Outcome

- Catalog domain extracted to `packages/domain/catalog/` (12 files: commands/products,categories,menu-modifiers · queries/menu · model/catalog-types · policies/pricing,availability · schemas/products,categories · barrel index).
- All 6 shims deleted (4 routes + 2 schemas). 9 call sites migrated to `@aura/domain-catalog`.
- Suite green: 360 files / 3274 tests. tsc delta +24 (552→576), all within established M1 TS2307/TS6059 band.

## What went well

- Extract+migrate+delete in one nhịp avoided the 2-phase shim window — no drift between shim and canonical copy (same class as M2 order/payment/kitchen precedent `fcce027`).
- Policies split (pricing.ts + availability.ts) landed cleanly without cross-pollination.

## What bit us — dual-zod

For 5 attempts we chased `z.coerce.number(...).openapi is not a function`. Root cause:

- Two PHYSICAL zod copies exist as **separate module instances**: `node_modules/zod` (root) and `worker/node_modules/zod` (worker). `honoW.z === zodTop.z === false`.
- `@hono/zod-openapi` calls `extendZodWithOpenApi(z)` at module top-level, **mutating only the zod instance its own module resolves to**. In the test setup, worker's hono loaded first → worker zod got the patch, root zod (used by common.ts and the catalog schemas) stayed unpatched → `.openapi` undefined on 42 catalog tests.

**Fix:** Added `import '@hono/zod-openapi'` at the top of `src/test-setup.ts`. Vitest setupFiles run **before** any test module, so root's hono-zod-openapi loads and patches root zod first — every test-schema module then captures a patched namespace. 42/42 green.

## What bit us — tsc surfacing

+24 tsc delta. Verdict: **all acceptable, no regression**.

- The earlier "+42 new" headline was misleading — the worker openapi files (`openapi-categories.ts`, `openapi-products.ts`) show **zero count change** (34→34, 37→37). The comm line-diff churn was only type-expression text rewriting (ZodObject detail → `any` via the barrel) — the TS2339/TS2345 errors pre-existed in baseline, just with richer inline type text.
- Real new errors: 27 in `packages/domain/catalog/**` (TS2307 `worker/src/...` unresolvable, TS6059 `not under rootDir`, relocated TS2305/TS2554) + 1 in `worker/src/lib/openapi.ts` (TS6059, same class as the existing order/payment/kitchen TS6059s).
- Every new (file, error-code) signature already existed for `packages/domain/{order,payment,kitchen}` in baseline — matches the fcce027 precedent exactly.

## Numbers

- Working tree: 23 files changed, +133 / −976 lines (net −843).
- New: 12 package files under `packages/domain/catalog/`.
- Deleted: 6 shims.
- Migrated: 9 caller files (2 worker/src, 3 routes, 3 tests, 1 test-setup preload).

## Lessons

1. **Two module instances ≠ one dual-version bug.** When the same dep is physically copied into two node_modules paths, `===` on their default exports is false, and side-effect patches apply to only one copy. Probe with `a === b` before reaching for resolution aliases.
2. **setupFiles are the only reliable patch-timing hook.** Hoisting deps, aliasing zod→cjs, aliasing zod-openapi→root mjs — all failed because they addressed resolution, not timing. The patch must run before the first `import 'zod'` consumer. setupFiles are ordered before test modules → that's the fix.
3. **tsc line-diffs lie about regressions.** Count by `(file, error-code)` signature, not by raw error text. Type-expression rewriting makes old errors "look new" without adding any new broken invariants.
4. **One-nhịp extract+migrate+delete scales.** M2 order/payment/kitchen → M2 catalog: same pattern, same diff shape, no new error classes. The D10 exemplar is repeatable.
