# M3 — AURA CAFE Independent Operation · Journal

**Milestone goal:** "AURA CAFE can open → sell → produce → serve → reconcile → close using AURA."

## Result

✅ **M3 complete 2026-09-15.** All 6 phases green. 362 test files / 3297 tests passing. Worker tsc delta +16 vs M2 baseline (1317→1333), all within legacy TS2307/TS2339/TS2345 band — 0 new error classes.

## Phase summary

| Phase | What | Tests | Key artifacts |
|-------|------|-------|---------------|
| 01 | Inventory domain extraction | 4/4 | `packages/domain/inventory/` (model, commands, policies, barrel) |
| 02 | Multi-supplier purchasing + BOM | 8/8 | `policies/supplier-policy.ts`, `policies/bom-policy.ts` |
| 03 | Shift cash reconciliation | 5/5 | `packages/domain/shift/commands/reconcile.ts`, `policies/reconcile-policy.ts` |
| 04 | Reservation domain | 6/6 | `packages/domain/reservation/` (model, commands, policies) |
| 05 | KDS dedupe + reconciliation endpoint | 26/26 | `station-policy.ts` (pure, no Hono), `GET /api/reconciliation`, rewritten `GET /:id/tickets` |
| 06 | Verify & docs | — | changelog, phase-map, journal |

Total new tests: **26 unit + 4 integration = 30 tests added in M3.**

## Lessons learned

### 1. Hono `app.fetch` signature is `(request, env, ctx)` — not `(request, method, env, ctx)`

Worth a 5-minute debugging session per new test file. The reconciliation test mock was fine; the test was calling `app.fetch(req, { method: 'GET' }, makeEnv(db), ctx)` — four args. Hono ignores the extra object and treats `env` as `{ method: 'GET' }`, so `c.env.AURA_DB` is undefined → 500. Fix: drop the method object. Pattern working elsewhere in the codebase (`kitchen-stations.test.ts`, `staff-tips.test.ts`, etc.) uses the 3-arg form consistently.

### 2. Pure policy modules pay off in test coverage cost

`station-policy.ts` ships 14 unit tests with zero Hono/D1 mocking — the kind that runs in <50ms. The equivalent coverage through route tests would require `makeScriptedDB` boilerplate per case and 5-10× the runtime. Rule of thumb for future domains: if the function doesn't touch `c.req`/`c.env`/`c.json`, it belongs in `policies/` not `commands/`.

### 3. Sequential mock DB vs content-matched mock DB

First reconciliation test used an `idx` counter that advanced with each `prepare()` call. Fragile — if the endpoint adds a query or reorders, results silently misalign. Rewrote to match on SQL substring (`rowsBySql.find(h => h.match(sql))`). Deterministic regardless of call order.

### 4. Hono + tsc + locally-scoped interface name collision

Defining `DailyReconciliationReport` as a local interface and then returning `c.json({ success: true, data: report })` caused TS2353 ("success does not exist on type DailyReconciliationReport"). Root cause: a stray `satisfies DailyReconciliationReport` clause on the `c.json()` call (leftover from an earlier edit). Fix: remove the `satisfies`. Lesson: `satisfies` on a `c.json()` wrapper object constrains the *whole* wrapper, not just the `data` field.

### 5. KDS dedupe is a read-model concern, not a write-model one

The naive approach would be to normalize `order_item_stations` at write time (when the order is placed) and maintain it on every status change. Instead, routing is derived at read time from `items JSON → category_stations → station_id`. Cheaper to implement, no write-path migration, and trivially testable. Trade-off: O(orders) per KDS poll vs O(1) lookup on a pre-computed table. At café scale (<500 active orders/day) the read-time approach wins.

## Metrics

- **30 new tests** across M3 (all green)
- **6 new policy modules** (inventory, supplier, bom, reconcile, station, reservation)
- **4 new domain packages** (inventory, reservation) + expanded kitchen/shift
- **0 new shims** — single-beat extraction discipline held from M2
- **0 DDL changes** — all M3 work is read-model + endpoint layer on existing tables
- **tsc delta +16** (1317→1333) — all legacy band, no new error classes

## Open items deferred

- **Reservation → inventory auto-deduct** (currently reservation holds a table but doesn't auto-deduct deposit from inventory; Phase 04 scope was domain extraction only)
- **Supplier payment reconciliation** (BOM + PO + supplier exist; payment matching deferred to M4 accounting)
- **Owner dashboard frontend** (endpoint exists; React component deferred to M5/M6 CRM work)
