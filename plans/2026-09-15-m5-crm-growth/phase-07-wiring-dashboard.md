# Phase 07 — Wiring + Owner Dashboard Feed

**Priority:** MEDIUM — exposes M5 through a single owner entry point.
**Status:** ⏳ PLANNED

## Overview
Wire all M5 commands into routes + barrel. Add a single `GET /api/crm/dashboard` endpoint that returns top-level CRM health for the owner dashboard.

## Key Insights

- Dashboard is a composition of: segment counts, retention overview, feedback summary, points issued today.
- Single endpoint reduces client round-trips for the owner TODAY panel.

## Requirements

- Barrel export all M5 commands.
- `GET /dashboard` → { segments: [...counts], retention: {...}, feedback: {...}, pointsToday, activeCampaigns }.
- All M5 routes registered in `crm.ts`.

## Related Code Files

### Modify
- `packages/domain/crm/index.ts` — full barrel exports
- `worker/src/routes/crm.ts` — add `GET /dashboard` + any missing M5 routes

### Create
- `tests/crm-dashboard.test.ts`

## Implementation Steps

1. Verify all M5 commands barrel-exported.
2. Add `GET /dashboard` route composing segment/retention/feedback/points.
3. Write dashboard test.
4. Run full suite.

## Todo

- [ ] Barrel exports complete
- [ ] `GET /dashboard` route
- [ ] Tests
- [ ] Run full suite

## Success Criteria

- Dashboard returns top-level CRM health.
- All M5 routes registered + tested.
- tsc clean.

## Security

- Owner/staff only.
