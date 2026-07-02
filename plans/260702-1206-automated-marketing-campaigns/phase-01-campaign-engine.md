---
phase: 1
title: Campaign engine + types
status: completed
priority: P1
effort: 2h
dependencies: []
---

# Phase 1: Campaign Engine & Types

## Architecture

```
worker/src/tree/campaigns/
├── types.ts              — Campaign types
├── campaign-engine.ts    — Core engine: evaluate, route, dedup
└── __tests__/
    └── campaign-engine.test.ts
```

## Files to Create

### `tree/campaigns/types.ts`

```typescript
export type CampaignTrigger = 'welcome' | 'birthday' | 'winback' | 'post_visit' | 'cashback_expiry';
export type CampaignChannel = 'sms' | 'email' | 'zalo';

export interface CampaignCustomer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyalty_tier?: string;
  total_spent?: number;
  visit_count?: number;
  last_order_date?: string;
  date_of_birth?: string;
  created_at?: string;
}

export interface CampaignMessage {
  trigger: CampaignTrigger;
  channel: CampaignChannel;
  to: string;           // phone or email
  subject?: string;     // for email
  body: string;         // message content
  data?: Record<string, unknown>;
}

export interface CampaignResult {
  trigger: CampaignTrigger;
  channel: CampaignChannel;
  customer_id: string;
  sent: boolean;
  error?: string;
}

// campaign_logs table (CREATE TABLE IF NOT EXISTS — migration)
// id, customer_id, trigger, channel, sent_at, status, error
```

### `tree/campaigns/campaign-engine.ts`

Core engine:
- `deduplicate(db, customerId, trigger, sinceDays)`: Check campaign_logs for recent send
- `logSend(db, result)`: Record send in campaign_logs
- `evaluateTriggers(db, customer)`: Run trigger logic, return messages to send

## TDD Steps

1. Write tests for `types.ts` — verify type exhaustiveness
2. Write tests for engine:
   - `deduplicate` returns false for never-sent customer
   - `deduplicate` returns true for recently-sent (within cooldown)
   - `logSend` inserts record
   - `evaluateTriggers` returns empty for ineligible customer
3. Implement
4. `npm test` → all pass
5. Commit: `feat(campaigns): add campaign engine + types base`
