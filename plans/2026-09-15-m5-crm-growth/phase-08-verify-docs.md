# Phase 08 — Full Verification & Documentation

**Priority:** HIGH — M5 done gate.
**Status:** ⏳ PLANNED

## Overview
Final M5 verification: full test suite green, tsc within legacy band, docs updated.

## Key Insights

- Gate: tsc delta within established M1–M4 band (TS2307/2339/2345 legacy only).
- All new commands covered by unit tests (pure functions) + integration tests (routes).

## Requirements

- Full vitest suite green (367+ files → 375+ expected).
- tsc clean on new files.
- `docs/12_CHANGELOG.md` updated with M5 section.
- `.ai/specs/phase-map.md` M5 row updated.
- This plan status → ✅ DONE.

## Related Code Files

### Modify
- `docs/12_CHANGELOG.md`
- `.ai/specs/phase-map.md`
- `plans/2026-09-15-m5-crm-growth/plan.md`

## Implementation Steps

1. Run `npx vitest run` — confirm green.
2. Run `npx tsc --noEmit` — confirm within band.
3. Update `docs/12_CHANGELOG.md` — M5 section per phase.
4. Update `.ai/specs/phase-map.md` — M5 status.
5. Update plan.md → ✅ DONE.

## Todo

- [ ] Full vitest green
- [ ] tsc within band
- [ ] Changelog updated
- [ ] Phase-map updated
- [ ] Plan status → DONE

## Success Criteria

- Suite green, tsc band clean, docs in sync.
