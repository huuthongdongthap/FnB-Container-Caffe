# Phase 04 — Verify + docs

**Status:** completed · **Depends:** phase 03

## Steps

1. Full suite: `npm test -- --run` — 100% green, count vs baseline 3274
2. tsc: root `npx tsc -p worker/tsconfig.json` — error count vs baseline 576, M1 band only (TS2307/TS6059/TS2305/TS2554 classes from domain alias)
3. Changelog: append M2 tables entry to `docs/12_CHANGELOG.md`
4. Journal: `plans/2026-09-14-m2-tables-exemplar/journal.md` — outcome, numbers, lessons
5. Phase-map: update `.ai/specs/phase-map.md` M2 section — tables done, staff/shifts next
6. TaskUpdate → completed

## Acceptance (final check)

- [ ] `/api/tables` CRUD + filters serve from `@aura/domain-table` (same payload shape)
- [ ] `/api/qr/:slug` verify + resolve unchanged (signer stays in `worker/src/tree/qr`)
- [ ] Status policy extracted (`policies/status.ts`), v1 permissive semantics preserved
- [ ] Suite green · tsc within band
- [ ] Changelog + journal + phase-map updated
