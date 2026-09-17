# Phase 05 — Campaigns + Retention

**Priority:** MEDIUM — growth loop + churn defense.
**Status:** ⏳ PLANNED

## Overview
Campaign = (segment, action, cooldown). V1 action = staff notification (owner alert). Retention = lapsing/dormant segment monitoring + trend.

## Key Insights

- Campaigns are write-once-then-trigger. Recipients logged idempotently.
- Retention reuses segments — no new computation, just a trend API.
- Email/SMS deferred to integration layer (V1 = in-app staff notification only).

## Requirements

- `campaign-policy.ts` — pure: validate campaign shape, cooldown check.
- `createCampaign(db, { segmentKey, action, message, cooldownDays })` → campaign row.
- `triggerCampaign(db, id)` → evaluates segment, logs `campaign_recipients`, emits action.
- `listCampaigns(db, { from, to })` → campaigns + recipient counts.
- `getRetentionOverview(db)` → { lapsingCount, dormantCount, trend: [{ date, lapsing, dormant }] }.
- Migrations: `campaigns` + `campaign_recipients` tables.

## Architecture

```
packages/domain/crm/commands/
├── campaign-policy.ts    # pure validation
├── campaign.ts           # create/trigger/list
├── retention.ts          # getRetentionOverview
```

## Related Code Files

### Create
- `packages/domain/crm/commands/campaign-policy.ts`
- `packages/domain/crm/commands/campaign.ts`
- `packages/domain/crm/commands/retention.ts`
- `migrations/<date>_03_campaigns.up.sql` + `.down.sql`
- `tests/crm-campaign.test.ts`

### Modify
- `packages/domain/crm/index.ts` — barrel exports
- `worker/src/routes/crm.ts` — add routes

## Implementation Steps

1. Create `campaign-policy.ts` (pure).
2. Create `campaign.ts` (create/trigger/list).
3. Create `retention.ts` (overview).
4. Migrations: `campaigns`, `campaign_recipients`.
5. Routes: `GET /campaigns`, `POST /campaigns`, `POST /campaigns/:id/trigger`, `GET /retention/overview`.
6. Tests: campaign create, trigger idempotency, recipient logging, retention counts.
7. Run full suite.

## Todo

- [ ] `campaign-policy.ts`
- [ ] `campaign.ts`
- [ ] `retention.ts`
- [ ] Migrations
- [ ] Routes
- [ ] Tests
- [ ] Run full suite

## Success Criteria

- Campaign creates + triggers against segment.
- Recipients logged once per campaign (idempotent re-trigger).
- Retention overview returns lapsing/dormant counts.
- tsc clean.

## Security

- Owner/staff only.
- Campaign message sanitized (no HTML injection into staff notification).
