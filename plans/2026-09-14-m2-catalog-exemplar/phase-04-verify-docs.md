# Phase 04 — Verify + docs

**Status:** done · **Depends:** phase 03

## Steps

1. Full suite: `npm test -- --run` — 100% green, count vs baseline 3274
2. tsc: root `npx tsc -p worker/tsconfig.json` (NOT worker-local — v4.9.5 can't parse bundler resolution) — error count vs baseline 1239, legacy band only
3. Changelog: append M2 catalog entry to `docs/12_CHANGELOG.md` — files moved, policies extracted, callers migrated, zero contract change
4. Journal: `plans/2026-09-14-m2-catalog-exemplar/journal.md` — outcome, chronological, lessons, numbers (files changed, net LOC)
5. Phase-map: update catalog routes status in the M2 section of the phase-map doc
6. TaskUpdate #27/#28/#29 → completed

## Acceptance (D10 — final check)

- [ ] Menu renders from `@aura/domain-catalog` (same payload shape)
- [ ] Availability filter enforced server-side via `policies/availability.ts`
- [ ] Happy-hour price eval server-side via `policies/pricing.ts`
- [ ] Suite green · tsc within band
- [ ] Changelog + journal + phase-map updated
