# M2 — Shim Caller Migration: Journal

**Date:** 2026-09-14 · **Commit:** `fcce027` · **Status:** ✅ Complete

## Outcome

All callers migrated off shim paths to direct `@aura/domain-*` imports; all shims + `worker/src/tree/orders/` deleted. 360 files / 3274 tests green, tsc delta −1 (1240→1239, legacy band only).

## What happened (chronological)

1. **Phase 01-02** — `index.ts`, orders router, `orders-hono.ts`, `cron-admin.ts` migrated to domain imports. Discovered en route: 12 dynamic `await import()` calls in `create-order.ts` / `update-order.ts` / `loyalty-trigger.ts` used tree-relative paths that **never resolved** after the domain move — the code paths were silently dead. Repointed to `worker/src/...` aliases.
2. **Phase 03** — 17 test files migrated. Critical catch: 3 `vi.mock()` calls (telegram ×2, loyalty-trigger ×1) targeted the tree copy. Had the tree been deleted without repointing, those mocks would silently no-op → false-green tests. Repointed to `packages/domain/order/...` first.
3. **Phase 04** — Deleted 6 route shims + `routes/orders.ts` + `tree/orders/` (14 files). Deletion surfaced 4 straggler importers the grep sweep missed (webhooks.ts, tests/orders.test.ts, kitchen-stations test) — 6 test failures → migrated → green.
4. **Phase 05** — Full suite + tsc verification. One straggler TS2307 outside the legacy band (`../../types/env` in create-order.ts:258) → fixed to `worker/src/types/env`.

## Lessons

- **Silent dead dynamic imports**: relative `await import()` breaks silently when a file moves — no build error, only a runtime 404-shaped failure. Alias paths are load-bearing for dynamic imports across package boundaries.
- **vi.mock path coupling**: vitest mocks bind to the module *specifier string*. Migration = grep both `import` and `vi.mock('/import(` call sites; deleting a tree without repointing mocks creates false-green suites.
- **Stragglers always exist**: grep sweeps miss test files outside the obvious dirs (`tests/` root vs `worker/src/__tests__/`). Post-deletion test run is the only real sweep.
- **Tooling quirk**: worker-local tsc is v4.9.5 (can't parse `moduleResolution: bundler`); must run root `npx tsc -p worker/tsconfig.json` (v6.0.3).

## Numbers

- 50 files changed: +117 / −1382 (net −1265 lines)
- Domains now canonical: `packages/domain/{order,payment,kitchen}` — zero shim indirection
- Zero DDL, zero contract change, zero frontend impact

## Next

- M3 per BLUEPRINT ladder (repo split / worker domain boundaries).
- Optional: retire `worker/src` alias for domain↔worker intra-deps once domains are fully self-contained (M3+ scope).
