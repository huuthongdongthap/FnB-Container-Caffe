# M2 — Shim Caller Migration

M1 Batch 6 is fully closed. All three domains (order / payment / kitchen) live in `packages/domain/*` with re-export shims at the old route paths. M2 migrates every caller off the shim paths onto direct `@aura/domain-*` imports, then deletes the shim files and the now-redundant `worker/src/tree/orders/` directory.

**Verified safe to delete** — `git diff c1db222..HEAD -- worker/src/tree/orders/` is empty (zero drift since domain extraction); `packages/domain/order` is the canonical copy, identical modulo the aliased import paths that vite/vitest resolve.

## Work breakdown

| Phase | Scope | Task | Status |
|-------|-------|------|--------|
| 01 | index.ts | Migrate 5 shim imports (payments, nowpayments, kitchen-stations, kds-stream, kds-mobile) → `@aura/domain-payment` + `@aura/domain-kitchen`. Keep orders block on `routes/orders` until phase 02 converts that router. | **done** |
| 02 | Orders router | Convert `worker/src/routes/orders.ts` from `tree/orders/*` re-exports → `@aura/domain-order` re-exports. Update `worker/src/index.ts` orders block + `cron-admin.ts` `notifyTelegram` import + `orders-hono.ts` `buildOrderTail` import → `@aura/domain-order`. | **done** (incl. 12 broken dynamic imports fixed: `create-order.ts`/`update-order.ts`/`loyalty-trigger.ts` had tree-relative `await import()` paths that never resolved from domain location — now aliased) |
| 03 | Test files | Migrate 15 test files off shim/tree paths → direct domain imports. | **done** (17 files: 11 tree/orders tests, loyalty-dual-trigger, 6 route tests incl. tests/payments.test.ts + tests/orders.test.ts; vi.mock dead-path repoints to domain paths) |
| 04 | Delete shims | Delete 6 route shims (`payments.ts`, `payments/momo-create.ts`, `payments-nowpayments.ts`, `kds-mobile.ts`, `kds-stream.ts`, `kitchen-stations.ts`) + entire `worker/src/tree/orders/` dir. | **done** (also deleted `routes/orders.ts` domain shim — all callers migrated in phase 03; fixed 4 straggler importers: webhooks.ts, tests/orders.test.ts, kitchen-stations test) |
| 05 | Verify | Full suite green (order 14+, payment 16, kitchen 14 = 3274+), worker/tsc delta within known-legacy band. Commit + changelog. | **done** (360 files / 3274 tests = 100% green; tsc 1240→1239 baseline delta −1, all TS2307 within known legacy alias band, zero refs to deleted files) |

## Acceptance criteria

- Zero `tree/orders/*` references anywhere in `worker/src`, `src`, or `tests`.
- Zero shim-route references (`routes/payments`, `routes/payments/*`, `routes/payments-nowpayments`, `routes/kitchen-stations`, `routes/kds-{mobile,stream}`) except inside the domain packages themselves.
- All importers use `@aura/domain-order` / `@aura/domain-payment` / `@aura/domain-kitchen`.
- `worker/src/routes/orders.ts` still re-exports the order public surface so external tests/routes keep resolving (becomes a domain shim, not a tree shim) — or is deleted if fully inlined into index.ts. Decision in phase 02.
- Full test suite green, no new TS errors beyond known-legacy TS2307/TS6059.
- No DDL, no contract change.

## Out of scope (explicit)

- Frontend (`src/**`) — untouched, no cross-imports.
- Other domains (customer/crm) — already on direct imports.
- ERPNext / inventory / other worker routes — out of scope.
- Vitest alias removal — `worker/src` alias retained for domain↔worker intra-deps.

## Key risks

- `orders.ts` is consumed by `index.ts` AND two route tests (`orders.test.ts`, `orders-snapshot.test.ts`). If we delete `orders.ts`, those tests must be migrated in phase 03 first.
- `orders.ts` exposes `createOrder, getOrder, updateOrder, getLatestOrderTimestamp, getAdminOrders, getStats, notifyTelegram, splitOrders` — all present in `@aura/domain-order` barrel. Safe to re-export from domain.
