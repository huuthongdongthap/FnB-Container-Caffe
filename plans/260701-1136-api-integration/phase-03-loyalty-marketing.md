---
phase: 3
title: "Loyalty + Marketing"
status: completed
priority: P2
effort: "4h"
dependencies: [1]
---

# Phase 3: Loyalty + Marketing

## Overview

Wire loyalty program pages (Loyalty, LoyaltyCalculator, Referral, Promotions, Events) to real backend data. Customers see actual points, tier status, rewards, referral codes, and active promotions.

## Requirements

- Functional: Display customer loyalty tier + points + cashback rate, calculate potential rewards, show referral code + stats, list active promotions, show events calendar
- Non-functional: Auth-required for loyalty/referral (customer must be logged in), optimistic UI for referral code copy, responsive tier cards

## Architecture

```
use-loyalty-store.ts
  State: { tier, points, cashbackRate, rewards[], history[], loading, error }
  Actions: fetchLoyalty(), redeemReward(rewardId), calculateCashback(amount), phoneAuth(phone)
  Note: Loyalty endpoints require customer context (phone-auth OR JWT). Phone-auth via POST /api/loyalty/phone-auth returns customer token.

use-referral-store.ts
  State: { referralCode, stats, cashbackEarned, loading, error }
  Actions: fetchReferralData(), applyReferralCode(code), copyReferralLink()
  Note: Referral endpoints are at /api/loyalty/referral/* (NOT /api/referrals/*)

Pages wired:
  Loyalty → TierCard, TierProgress, RewardsGrid (use-loyalty-store)
  LoyaltyCalculator → use-loyalty-store.calculateCashback()
  Referral → ReferralLink, CashbackDisplay (use-referral-store)
  Promotions → PromotionCard[] (static + DB-driven if API exists)
  Events → EventCard[] (static for now, CRM integration later)
```

## Related Code Files

- Create: `src/hooks/stores/use-loyalty-store.ts`
- Create: `src/hooks/stores/use-referral-store.ts`
- Create: `src/hooks/stores/__tests__/use-loyalty-store.test.ts`
- Create: `src/hooks/stores/__tests__/use-referral-store.test.ts`
- Modify: `src/components/loyalty/tier-card.tsx` — accept real data props
- Modify: `src/components/loyalty/tier-progress.tsx` — accept real points
- Modify: `src/components/loyalty/rewards-grid.tsx` — accept real rewards[]
- Modify: `src/components/loyalty/loyalty-calculator.tsx` — wire calculateCashback
- Modify: `src/components/referral/referral-link.tsx` — accept real code
- Modify: `src/components/referral/cashback-display.tsx` — accept real stats
- Modify: `src/components/promotions/promotion-card.tsx` — accept real data
- Modify: `src/pages/loyalty.tsx` — wire stores
- Modify: `src/pages/loyalty-calculator.tsx` — wire stores
- Modify: `src/pages/referral.tsx` — wire stores
- Modify: `src/pages/promotions.tsx` — wire stores
- Modify: `src/pages/events.tsx` — wire stores (or data fetch)

## Implementation Steps

### TDD: Write tests first

1. **`use-loyalty-store.test.ts`**
   - `fetchLoyalty()`: populates tier + points + cashbackRate, requires auth token
   - `fetchLoyalty()`: sets error when not authenticated (401)
   - `calculateCashback(amount)`: returns correct cashback based on tier rate
   - `redeemReward(id)`: calls POST /api/loyalty/redeem, updates points

2. **`use-referral-store.test.ts`**
   - `fetchReferralData()`: populates code + stats + cashbackEarned
   - `applyReferralCode(code)`: calls POST /api/loyalty/referral/apply
   - `applyReferralCode(code)`: sets error on invalid code

### Implement

3. Create `use-loyalty-store.ts` — fetch loyalty data from `/api/loyalty/summary`, `/api/loyalty/points`, `/api/loyalty/cashback`, `/api/loyalty/tiers`. Calculate cashback locally (tier rates: bronze 3%, silver 5%, gold 7%, platinum 10%). Include `phoneAuth(phone)` calling POST `/api/loyalty/phone-auth` for customer context.

4. Create `use-referral-store.ts` — fetch referral code from `/api/loyalty/referral/code`, stats from `/api/loyalty/referral/stats`, apply code via `/api/loyalty/referral/apply`. Clipboard copy helper.

5. Wire loyalty components: TierCard reads tier/points/cashbackRate, TierProgress reads points+nextTier threshold, RewardsGrid reads available rewards, LoyaltyCalculator uses calculateCashback

6. Wire referral components: ReferralLink reads code + copy action, CashbackDisplay reads cashbackEarned + stats

7. Wire promotions page: Map active promotions from API or config, render as PromotionCard list

8. Wire events page: Display event calendar/list (static data acceptable; CRM integration is future work)

### Verify

9. Run all 268 existing tests — must pass
10. New store tests — all pass
11. `npm run build` — 0 TypeScript errors

## Success Criteria

- [x] Loyalty page displays real tier + points + cashback rate from API
- [x] Tier progress bar reflects actual points toward next tier
- [x] Loyalty calculator shows accurate cashback for input amount
- [x] Referral page shows real referral code + share link
- [x] Referral code can be copied to clipboard
- [x] Referral cashback stats display real earned amounts
- [x] Promotions page lists active promotions (API or config-based)
- [x] Empty/loading/error states handled for all API calls
- [x] Unauthenticated user sees appropriate message on loyalty page
- [x] 268 existing tests still pass + new store tests pass
- [x] `npm run build` — 0 TypeScript errors (new files)
