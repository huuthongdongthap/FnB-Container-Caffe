---
phase: 3
title: Campaign triggers (5 triggers)
status: completed
priority: P1
effort: 4h
dependencies: [1, 2]
---

# Phase 3: Campaign Triggers

## Files to Create

```
worker/src/tree/campaigns/triggers/
├── welcome.ts           — New signup → welcome message
├── birthday.ts          — Birthday month → birthday discount
├── winback.ts           — 30d inactive → win-back offer
├── post-visit.ts        — 24h after order → review request
├── cashback-expiry.ts   — 7d before expiry → warning (refactor from cron.ts)
└── __tests__/
    └── triggers.test.ts
```

### Trigger Logic

Each trigger function signature:
```typescript
async function detectTrigger(db: D1Database): Promise<CampaignCustomer[]>
```

### Welcome Trigger
- Query: customers created in last 24h, not in campaign_logs (welcome)
- Channel: SMS (preferred), email fallback

### Birthday Trigger
- Query: customers with `date_of_birth` this month, not sent birthday campaign this year
- Channel: SMS + Zalo

### Win-back Trigger
- Query: customers with last order > 30 days ago, phone exists, not in campaign_logs (winback) in last 60 days
- Channel: SMS

### Post-visit Trigger
- Query: orders completed 24-48h ago, customer has phone/email, not sent post-visit for this order
- Channel: SMS

### Cashback Expiry Trigger (refactor from cron.ts:67-101)
- Move existing `sendCashbackExpiryWarnings` logic from `cron.ts` → `tree/campaigns/triggers/cashback-expiry.ts`
- cron.ts re-exports from tree module

## TDD Steps

1. Write tests for each trigger:
   - Welcome: new customer without welcome sent → detected
   - Birthday: birthday month customer not yet contacted → detected
   - Winback: 31+ days inactive → detected; active customer → not detected
   - Post-visit: order 24h ago → detected; order just placed → not detected
   - Cashback expiry: expiring cashback → detected; no expiring → empty
2. Implement each trigger
3. Verify crypto/date boundary conditions
4. `npm test` → all pass
5. Commit: `feat(campaigns): add 4 campaign triggers + refactor cashback expiry`
