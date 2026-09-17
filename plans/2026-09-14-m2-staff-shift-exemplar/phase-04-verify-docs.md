# Phase 04 — Verify + docs

**Status:** completed · **Depends:** phase 03

## Steps

1. Full suite: `npm test -- --run` — 100% green, count vs baseline 3274
2. tsc: root `npx tsc -p worker/tsconfig.json` — error count vs baseline 1280, M1/M2 band only (TS2307/TS6059/TS2305/TS2554 from domain alias)
3. Changelog: append M2 staff+shift entry to `docs/12_CHANGELOG.md`
4. Journal: `plans/2026-09-14-m2-staff-shift-exemplar/journal.md` — outcome, numbers, lessons
5. Phase-map: update `.ai/specs/phase-map.md` M2 section — staff + shift done, M2 complete
6. TaskUpdate → completed

## Acceptance (final check)

- [x] `/api/staff/*` handlers (auth, tips) serve from `@aura/domain-staff` (same payload shape)
- [x] `/api/shifts/*` clock-in/out/history serve from `@aura/domain-shift` (same payload shape)
- [x] RBAC (`StaffRole`, `hasPermission`, `visibleRolesFor`, `ROLE_PERMISSIONS`) extracted to `@aura/domain-staff`
- [x] Suite green · tsc within band
- [x] Changelog + journal + phase-map updated
