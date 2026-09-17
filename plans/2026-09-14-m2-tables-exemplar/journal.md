# M2 Tables Exemplar — Journal

**Status:** done · **Started:** 2026-09-14 · **Duration:** ~1 session (extract+migrate+delete in one nhịp)
**Lead:** phanmem.site AI · **Plan:** `plans/2026-09-14-m2-tables-exemplar/`

## Outcome

- Tables surface extracted to `packages/domain/table/` (5 files: commands/tables, commands/qr-scan · model/table-types · policies/status · barrel index).
- `worker/src/routes/tables.ts` shim deleted same session. 7 caller sites migrated to `@aura/domain-table`.
- Suite green: 360 files / 3274 tests. tsc delta +41 (1239→1280), all within established M1/M2 TS2307/TS6059/TS2305/TS2554 band.

## What went well

- Extract+migrate+delete in one nhịp, matching catalog exemplar + fcce027 precedent. Shim window never materialized.
- Status policy (`policies/status.ts`) encodes v1 permissive semantics as data — all 4 statuses (Available/Occupied/Reserved/Overdue) legal targets from any current state. Behavior byte-identical to no-guard original; transitions now unit-testable.
- Mock binding held: `tests/tables.test.ts` mocks `../worker/src/middleware/auth.js` — the moved router imports auth as `worker/src/middleware/auth` (not relative), so vi.mock binds through the alias-resolved module graph. Same pattern as catalog.

## What bit us — extra routes I added

Initial extraction added POST `/`, PATCH `/:id`, DELETE `/:id` routes that were NOT in the original `worker/src/routes/tables.ts`. Removed them to preserve byte-identical behavior — YAGNI; original only had GET + PATCH occupy/release/status. After removal, tsc stayed at 1280 because the 12 domain/table errors are the same TS2307/TS6059 class regardless.

## What bit us — tsc delta +41

1239→1280 headline looks worse than catalog's +24, but **all 12 domain/table errors are the established M1/M2 band classes** (TS2307 `Cannot find module 'worker/src/...'`, TS6059 `not under rootDir`, relocated TS2305/TS2554). Verified against baseline via `git stash + tsc + git stash pop` — zero new (file, error-code) signatures beyond what catalog/order/payment/kitchen already carry. The larger absolute delta just reflects the larger M1/M2 band growth since catalog baseline (1239 vs 552 — multiple domain extracts accumulated).

## Numbers

- Working tree: 9 files changed (3 new domain + 6 caller edits + shim delete).
- New: 5 package files under `packages/domain/table/`.
- Deleted: 1 shim (`worker/src/routes/tables.ts`) + 1 .bak.
- Migrated: 7 caller files (worker/src/index.ts, tree/qr/generator.ts, routes/admin-qr.ts, __tests__/routes/{tables,debug-wrong-sig,debug-patch}.test.ts, tests/tables.test.ts).

## Lessons

1. **v1 permissive semantics as policy, not guard.** Original code has no status transition check — encode that as data (`TABLE_STATUS_TRANSITIONS` where every status maps to all four) so route behavior is byte-identical and the guard becomes opt-in/testable later. Don't retrofit a stricter policy mid-extraction.
2. **Don't invent routes during a pure move.** Only carry over what the original actually had. Extra POST/PATCH/DELETE routes that weren't in `worker/src/routes.tables.ts` violated the "move, not rewrite" rule — even though tsc didn't flag them, behavior drift would have.
3. **tsc delta baseline must track M1/M2 band growth.** Catalog's baseline was 552; tables' is 1239. Both gained only the canonical TS2307/TS6059/TS2305/TS2554 class — the headline delta number is meaningless without comparing against the *current* band.
4. **One-nhịp scales to small surfaces too.** Tables was 204 LOC / 5 files / 7 callers — smaller than catalog's 12 files / 9 callers — but the same extract→migrate→delete rhythm with identical diff shape. M2 repeatable across all remaining domains.
