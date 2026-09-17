# Phase 05 — Campaign Engine

**Priority:** MEDIUM — automated marketing triggers + channels.
**Status:** ✅ COMPLETE

## Overview
Migrate `worker/src/tree/campaigns/` (engine, 5 triggers, 3 channels, cron-handler, templates) → `packages/domain/crm/commands/campaign/`. Thin route handlers for admin CRUD stay in `worker/src/routes/campaigns.ts` but delegate trigger detection + template rendering to domain.

## Key Insights

- 5 triggers: `welcome` (24h new customers), `birthday` (matching month, once/year), `winback` (30d inactive), `post_visit` (24-48h after completed order), `cashback_expiry` (7 days before expires).
- Channel priority cascade: welcome → [sms, email], birthday → [sms, zalo], winback/post-visit → [sms], cashback_expiry → [sms]. First success wins, break cascade.
- `campaign_logs` dedup: prevent re-send within cooldown window.
- `campaign_configs` KV-ish config per trigger (is_active, channels JSON, timing).
- Cron orchestrator (`cron-handler.ts`) loops triggers → detect → send → log — non-blocking per trigger, swallows errors.
- Templates are bilingual (VN + EN) with subject/sms/html variants.

## Requirements

- `campaign/types.ts` — shared types (CampaignTrigger, CampaignChannel, CampaignCustomer, CampaignMessage, CampaignResult, CampaignLogRow).
- `campaign/templates.ts` — pure `renderTemplate(trigger, params)` → `{ subject, sms, html }`. Bilingual.
- `campaign/dedup.ts` — `deduplicate(db, customerId, trigger, sinceDays)` + `logSend(db, result)`.
- `campaign/detect.ts` — pure-ish detector functions (welcome/birthday/winback/post-visit/cashback-expiry).
- Migration: `campaign_logs` + `campaign_configs` tables already in production backup (need to add to `schema.sql` if missing).
- Routes: `routes/campaigns.ts` CRUD thin wrapper. Cron stays in `worker` (it touches env SMS/email/Zalo clients — integration, not domain).

## Architecture

```
packages/domain/crm/commands/campaign/
├── types.ts        # shared types
├── templates.ts    # pure message templates
├── dedup.ts        # dedup + log
├── detect.ts       # trigger candidate detection
```

## Related Code Files

### Create
- `packages/domain/crm/commands/campaign/types.ts`
- `packages/domain/crm/commands/campaign/templates.ts`
- `packages/domain/crm/commands/campaign/dedup.ts`
- `packages/domain/crm/commands/campaign/detect.ts`
- `tests/crm-campaign.test.ts`

### Modify
- `packages/domain/crm/index.ts` — barrel exports
- `worker/src/routes/campaigns.ts` — thin CRUD, delegate detect/template
- `worker/src/tree/campaigns/cron-handler.ts` — import from domain
- `worker/schema.sql` — add campaign_logs + campaign_configs if absent

## Implementation Steps

1. Create `campaign/types.ts` (shared types).
2. Create `campaign/templates.ts` (pure render).
3. Create `campaign/dedup.ts` (dedup + logSend).
4. Create `campaign/detect.ts` (all 5 trigger detectors).
5. Add `campaign_logs` + `campaign_configs` tables to `schema.sql`.
6. Migrate `cron-handler.ts` to import from domain.
7. Migrate `routes/campaigns.ts` thin CRUD (delegate template/meta to domain).
8. Migrate channels — stay in `worker/src/lib/` (integration), but types from domain.
9. Tests: template rendering, dedup logic, detector SQL candidates, full suite.

## Todo

- [x] `campaign/types.ts`
- [x] `campaign/templates.ts`
- [x] `campaign/dedup.ts`
- [x] `campaign/detect.ts`
- [x] `schema.sql` — campaign tables
- [x] Migrate `cron-handler.ts`
- [x] Migrate `routes/campaigns.ts`
- [x] Tests
- [x] Run full suite
- [ ] Update CHANGELOG.md

## Success Criteria

- Templates pure + bilingual.
- Detectors return candidate arrays; dedup prevents re-send.
- Cron orchestrator unchanged behavior.
- tsc clean.

## Security

- Customer data (phone, email, DOB) used only for campaign send; no leak across triggers.
- Campaign configs owner-only admin; triggers run as system.
