---
phase: 4
title: Cron integration
status: completed
priority: P1
effort: 2h
dependencies: [3]
---

# Phase 4: Cron Integration

## Changes

### `routes/cron.ts`

Add new export handlers:
```typescript
export async function runCampaignTriggers(env: Record<string, unknown>): Promise<{ triggered: number; sent: number }> {
  // Run all auto-campaign triggers in a single cron tick
}

// Re-export from tree/campaigns/cron-handler
```

### Scheduling

| Trigger | Frequency | Handler | Notes |
|---------|-----------|---------|-------|
| Welcome | Every 15 min | `detectWelcomeCandidates` | Low volume, quick check |
| Birthday | Daily at 00:00 | `detectBirthdayCandidates` | Once per day |
| Winback | Daily at 06:00 | `detectWinbackCandidates` | Once per day |
| Post-visit | Every 30 min | `detectPostVisitCandidates` | Time-sensitive |
| Cashback expiry | Daily at 08:00 | `detectCashbackExpiry` | Once per day |

### Index Registration

Add campaign cron handler to `worker/src/index.ts` — register as new export alongside existing cron functions.

## TDD Steps

1. Write tests:
   - Each cron handler runs without throwing
   - `runCampaignTriggers` returns correct counts
   - Existing cron functions still export correctly
   - No circular imports
2. Implement cron wiring
3. `npm test` → all pass (1,033+ existing + new)
4. Commit: `feat(campaigns): wire campaign triggers to cron schedule`
