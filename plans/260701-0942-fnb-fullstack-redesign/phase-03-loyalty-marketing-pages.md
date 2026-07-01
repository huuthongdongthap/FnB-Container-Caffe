---
phase: 3
title: "Loyalty + Marketing Pages"
status: completed
priority: P2
dependencies: [1]
effort: "8h"
---

# Phase 3: Loyalty + Marketing Pages

## Overview

Migrate loyalty and marketing pages from static HTML to React components. These pages drive customer retention and growth.

**Red-team corrections:** Referral model is flat 10,000đ cashback (not 30% commission). loyalty-calculator.html excluded from current Vite build — audit dependencies before migration.

## Pages

| Page | Current | Lines | New Component |
|------|---------|-------|---------------|
| Loyalty | `loyalty.html` | ~220 | `src/pages/Loyalty.tsx` |
| Loyalty Calculator | `loyalty-calculator.html` | 739 | `src/pages/LoyaltyCalculator.tsx` |
| Referral | `referral.html` | ~140 | `src/pages/Referral.tsx` |
| Promotions | `promotions.html` | ~200 | `src/pages/Promotions.tsx` |
| Events | `events.html` | ~240 | `src/pages/Events.tsx` |

## Architecture

```
src/
├── pages/
│   ├── Loyalty.tsx, LoyaltyCalculator.tsx, Referral.tsx
│   ├── Promotions.tsx, Events.tsx
├── components/
│   ├── loyalty/
│   │   ├── TierCard.tsx, PointsBadge.tsx, RewardsGrid.tsx, PointsHistory.tsx
│   │   ├── BirthdayReward.tsx, CheckinTracker.tsx, TierProgress.tsx
│   ├── referral/
│   │   ├── ReferralLink.tsx, ReferralStats.tsx, CashbackDisplay.tsx
│   ├── promotions/
│   │   ├── PromotionCard.tsx, VoucherCode.tsx, CountdownTimer.tsx
│   └── events/
│       ├── EventCard.tsx, EventCalendar.tsx, TicketPurchase.tsx
├── hooks/
│   ├── useLoyalty.ts       # GET /api/loyalty
│   ├── useReferral.ts      # GET /api/referrals (flat 10Kđ cashback model)
│   ├── usePromotions.ts    # GET /api/promotions
│   └── useEvents.ts        # pretix proxy via worker
```

## TDD: Tests to Write First

1. `src/components/loyalty/__tests__/tier-card.test.tsx` — Bronze/Silver/Gold/Platinum, points, progress bar, benefits
2. `src/components/loyalty/__tests__/tier-progress.test.tsx` — spend-to-next-tier, progress %, upgrade CTA
3. `src/components/loyalty/__tests__/rewards-grid.test.tsx` — available rewards, redeem button, points cost
4. `src/components/referral/__tests__/referral-link.test.tsx` — copy link, share CTAs, referral count
5. `src/components/referral/__tests__/cashback-display.test.tsx` — 10,000đ cashback display, earned history, tier modifiers (if any)
6. `src/components/promotions/__tests__/promotion-card.test.tsx` — discount, validity dates, voucher code copy
7. `src/hooks/__tests__/use-loyalty.test.ts` — tier/points fetch, 0 points, max tier
8. `src/components/loyalty/__tests__/loyalty-calculator.test.tsx` — input spend → output points + tier projection, 0 and max edge cases

## Implementation Steps

### 3.1 Loyalty Components — DONE
- [x] TierCard with tier badge, points display, progress bar (Bronze→Silver→Gold→Platinum)
- [x] PointsHistory table from API
- [x] RewardsGrid with redeem flow
- [x] BirthdayReward notification
- [x] CheckinTracker (daily check-in streak)
- [x] TierProgress calculator

### 3.2 Loyalty Calculator — DONE
- [x] Port from 739-line HTML to React with proper state management
- [x] Input: monthly spend, visit frequency, referral count
- [x] Output: projected tier, points earned, cashback value, referral earnings
- [x] **Audit:** `vite.config.js` no longer excludes `loyalty-calculator.html` — deps resolved

### 3.3 Referral Page — DONE
- [x] ReferralLink with copy-to-clipboard
- [x] ReferralStats (clicks, signups, cashback earned)
- [x] CashbackDisplay: **flat 10,000đ per successful referral** (NOT 30% commission). Matches `worker/src/routes/referrals.js` v3 logic.
- [x] Share buttons (Facebook, Zalo, copy link)

### 3.4 Promotions + Events — DONE
- [x] PromotionCard grid with active/upcoming/expired states
- [x] VoucherCode with copy and apply-to-cart
- [x] CountdownTimer for limited-time offers
- [x] EventCard with pretix ticket purchase integration
- [x] EventCalendar (past/upcoming toggle)

## Success Criteria

- [x] All 8 TDD test files written and passing (66/66 tests)
- [x] Loyalty: tier display, points, rewards redeem functional
- [x] Calculator: same outputs as current 739-line HTML version
- [x] Referral: 10,000đ flat cashback model, not 30% commission
- [x] loyalty-calculator dependency issues resolved (no vite exclusion)
- [x] Promotions: voucher copy, countdown timers accurate
- [x] Events: pretix ticket purchase flow functional
- [x] All pages responsive at 4 breakpoints
- [x] 0 TypeScript errors in Phase 3 files (1 pre-existing error in use-checkout.test.ts outside ownership)

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| loyalty-calculator.html has missing deps per vite.config.js | Audit and resolve before Phase 3 starts; document findings |
| Referral API contract mismatch (30% vs 10Kđ) | Pin to actual `referrals.js` v3 logic; verify with grep |
| pretix ticket embed conflicts with React | Use pretix widget in iframe; test cross-origin behavior |
