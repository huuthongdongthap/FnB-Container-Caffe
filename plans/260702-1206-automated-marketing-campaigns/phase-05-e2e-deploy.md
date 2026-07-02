---
phase: 5
title: E2E + deploy
status: completed
priority: P1
effort: 2h
dependencies: [4]
---

# Phase 5: E2E Integration + Deploy

## Checks

1. **Full test suite:** `npm test` → 1,033+ pass (no regressions)
2. **TypeScript:** `npx tsc --noEmit` → 0 errors, zero `:any`
3. **Build:** `npm run build` → 0 errors
4. **Integration test:** Full campaign flow — trigger → channel → log
5. **Index.ts contract:** All new exports properly registered

## D1 Migration

Create migration `005-campaign-logs.sql`:
```sql
CREATE TABLE IF NOT EXISTS campaign_logs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  trigger TEXT NOT NULL,
  channel TEXT NOT NULL,
  sent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_customer ON campaign_logs(customer_id, trigger);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_sent_at ON campaign_logs(sent_at);
```

## Verification

- [x] All 5 campaign triggers detect correct customer segments
- [x] SMS channel sends via SpeedSMS
- [x] Email channel sends via SendGrid
- [x] Dedup prevents double-send within cooldown
- [x] Campaign logs recorded for audit trail
- [x] Existing cashback expiry still works (refactored)
- [x] Zero regressions on 1,033 existing tests
- [x] Deploy with SHA verification

## Commit

`feat(campaigns): automated marketing campaigns — welcome, birthday, winback, post-visit, cashback expiry`
