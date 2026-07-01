---
phase: 2
title: Phase 2 — Extract 3 Medium-Size Route Files
status: completed
priority: P1
effort: 4h
dependencies: [1]
---

# Phase 2: Medium Files (4h)

Extract business logic from mixpost (468), referrals (320), pretix (276). Follow same TDD pattern as Phase 1.

## File 2.1: mixpost.ts (468 → ~110 lines)

### Extract Plan

| Source | Destination | Lines |
|--------|-------------|-------|
| resolveTemplate (451-468) | `tree/mixpost/template-resolver.ts` | ~20 |
| autoPostDailySpecials (235-259) | `tree/mixpost/auto-post-daily-specials.ts` | ~30 |
| autoPostNewPromotions (261-293) | `tree/mixpost/auto-post-new-promotions.ts` | ~35 |
| autoPostWeeklyHighlights (295-319) | `tree/mixpost/auto-post-weekly-highlights.ts` | ~30 |
| handleMixpostRequest (322-449) | `tree/mixpost/legacy-handler.ts` | ~130 |

### Route file after: ~110 lines (Hono router stays, re-exports for cron + legacy)

**Contract preserved:**
```typescript
import { handleMixpostRequest, autoPostDailySpecials, autoPostNewPromotions, autoPostWeeklyHighlights } from './routes/mixpost';
```

### TDD:
1. `npm test` → 1,033 ✓
2. Extract each cron function + legacy handler
3. Rewrite `routes/mixpost.ts` with re-exports
4. `npm test` → 1,033 ✓
5. Commit: `refactor(mixpost): extract cron + legacy to tree/mixpost/ (468→110 lines)`

## File 2.2: referrals.ts (320 → ~60 lines)

### Extract Plan

| Source | Destination | Lines |
|--------|-------------|-------|
| applyReferralForNewCustomer | `tree/referrals/apply-referral.ts` | ~40 |
| processReferralOnFirstOrder | `tree/referrals/process-referral.ts` | ~80 |
| processReferralCashbackOnFirstOrder | `tree/referrals/referral-cashback.ts` | ~70 |
| reverseReferralCashback | `tree/referrals/reverse-cashback.ts` | ~40 |

### Route file after: ~60 lines (Hono router + re-exports)

**Contract:** `index.ts` uses `referralRouter` mounted via `app.route('/api/referral', referralRouter)`. Processing functions used elsewhere — re-export all.

### TDD:
1. `npm test` → 1,033 ✓
2. Extract each processing function
3. Rewrite `routes/referrals.ts` with re-exports
4. `npm test` → 1,033 ✓
5. Commit: `refactor(referrals): extract 4 processors to tree/referrals/ (320→60 lines)`

## File 2.3: pretix.ts (276 → ~85 lines)

### Extract Plan

| Source | Destination | Lines |
|--------|-------------|-------|
| validateWebhookSignature (69-85) | `tree/pretix/hmac-validator.ts` | ~20 |
| getPretixClient (63-67) | `tree/pretix/client-factory.ts` | ~8 |
| Interfaces (18-59) | `tree/pretix/types.ts` | ~40 |

### Route file after: ~85 lines (Hono router, minimal)

### TDD:
1. `npm test` → 1,033 ✓
2. Extract HMAC validator + types + client factory
3. Rewrite `routes/pretix.ts` with imports
4. `npm test` → 1,033 ✓
5. Commit: `refactor(pretix): extract HMAC + types to tree/pretix/ (276→85 lines)`

## Phase 2 Success Criteria

- [ ] mixpost.ts: 468 → ≤110 lines
- [ ] referrals.ts: 320 → ≤60 lines
- [ ] pretix.ts: 276 → ≤85 lines
- [ ] 1,033 tests pass (3 commits, each verified)
- [ ] Build: 0 errors
