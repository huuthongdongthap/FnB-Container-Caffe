---
phase: 3
title: Phase 3 — Clean Up 2 Small Oversized Files
status: completed
priority: P2
effort: 2h
dependencies: [1, 2]
---

# Phase 3: Small Cleanup (2h)

Both files are just over 200 lines. Extract minimal logic to push under 200.

## File 3.1: zalo.ts (229 → ~70 lines)

### Extract Plan

| Source | Destination | Lines |
|--------|-------------|-------|
| ZNS template content strings | `tree/zalo/zns-templates.ts` | ~40 |
| notifyMember helper | `tree/zalo/notify-member.ts` | ~55 |
| sendZNS (core logic ~80 lines) | `tree/zalo/zns-sender.ts` | ~85 |

### Route file after: ~70 lines (router + thin wrapper around tree functions)

**Contract:** `index.ts` imports `sendZNS`. Re-export preserved.

### TDD:
1. `npm test` → 1,033 ✓
2. Extract templates + sender + notifier
3. Rewrite `routes/zalo.ts` with re-exports
4. `npm test` → 1,033 ✓
5. Commit: `refactor(zalo): extract ZNS to tree/zalo/ (229→70 lines)`

## File 3.2: cal-booking-webhook.ts (227 → ~75 lines)

### Extract Plan

| Source | Destination | Lines |
|--------|-------------|-------|
| Booking processing logic (create reservation from booking) | `tree/cal-booking/process-booking.ts` | ~80 |
| Booked time parser | `tree/cal-booking/time-parser.ts` | ~30 |

### Route file after: ~75 lines (webhook router + thin handler)

### TDD:
1. `npm test` → 1,033 ✓
2. Extract booking processing
3. Rewrite `routes/cal-booking-webhook.ts` with imports
4. `npm test` → 1,033 ✓
5. Commit: `refactor(cal-booking): extract processor to tree/cal-booking/ (227→75 lines)`

## Phase 3 Success Criteria

- [ ] zalo.ts: 229 → ≤70 lines
- [ ] cal-booking-webhook.ts: 227 → ≤75 lines
- [ ] 1,033 tests pass (2 commits, each verified)
- [ ] Build: 0 errors
