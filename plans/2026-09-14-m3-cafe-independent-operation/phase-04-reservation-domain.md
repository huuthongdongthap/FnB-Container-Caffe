# Phase 04 — Reservation Domain Extraction (`@aura/domain-reservation`)

**Status:** pending · **Depends:** none · **Milestone:** M3

## Overview

Extract table reservation lifecycle and bookings from `worker/src/routes/reservations.ts` into `packages/domain/reservation/`:
- Table reservation creation, cancellation, confirmation, and status updates.
- Slot conflict checking and table capacity matching.
- Integration with `@aura/domain-table` (locking table status to `reserved`) and customer profiles.

## Related Code Files

### Files to create:
- `packages/domain/reservation/package.json`
- `packages/domain/reservation/src/index.ts`
- `packages/domain/reservation/src/model/reservation-types.ts`
- `packages/domain/reservation/src/policies/reservation-policy.ts`
- `packages/domain/reservation/src/routes/reservations.ts`

### Files to modify (Callers):
- `worker/src/index.ts` (Mount reservation router from `@aura/domain-reservation`)
- `tests/reservations.test.ts` (Update import paths)

### Files to delete (Legacy):
- `worker/src/routes/reservations.ts`

## Implementation Steps

1. Create `packages/domain/reservation/` scaffold.
2. Extract models (`ReservationRecord`, `ReservationStatus`, `CreateReservationInput`).
3. Extract conflict-prevention and table-locking policies.
4. Extract routes and mount router.
5. Update callers in `worker/src/index.ts` and test files.
6. Delete legacy `worker/src/routes/reservations.ts`.
7. Verify with `npx vitest run tests/reservations.test.ts`.

## Success Criteria

- [ ] `/api/reservations/*` routes serve from `@aura/domain-reservation`.
- [ ] Legacy `worker/src/routes/reservations.ts` deleted without shims.
- [ ] Reservation tests pass 100% green.
