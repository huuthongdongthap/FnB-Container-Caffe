# Phase 02 — Customer Contact Sync Bridge (TDD)

**Status:** complete
**Priority:** High
**TDD:** ✅ Write tests first, then implement (13 tests)

## Overview

Build the sync bridge that pushes Aura D1 customer data to Mautic. Runs via CF Worker cron. Maps loyalty tiers, recency, and birthdays to Mautic segments.

## Requirements

### Functional
- Query D1 customers with loyalty tier, last order date, birthday
- Transform to Mautic contact format (email key, custom fields)
- Batch sync to Mautic via `batchUpsertContacts()`
- Map segments:
  - `loyalty_{tier}` → Bronze/Silver/Gold/Platinum
  - `recency_{days}` → active (0-30d), at-risk (30-60d), inactive (60d+)
  - `birthday_this_month` → for birthday campaigns
- Idempotent: re-syncing same customer doesn't duplicate
- Delta sync: only sync customers updated since last run (KV timestamp)

### Non-functional
- Cron-compatible (no request timeout issues)
- Batch processing (50 contacts/batch)
- Error isolation: one batch failure doesn't block others

## Architecture

```
cron.js: syncMauticContacts(env)
  ├── Get last sync timestamp from KV
  ├── Query customers updated since timestamp
  ├── Transform → Mautic contact format
  ├── batchUpsertContacts() in batches of 50
  ├── Map segments based on tier + recency + birthday
  ├── Update KV timestamp
  └── Log sync summary
```

## Implementation Steps

1. Write 4 TDD tests for bridge
2. Implement customer query + transform logic
3. Implement batch sync with segment mapping
4. Add `syncMauticContacts` to cron.js
5. Verify tests pass, build clean

## Files

- **NEW:** `worker/src/routes/mautic-bridge.js`
- **NEW:** `tests/mautic-bridge.test.js`
- **MODIFY:** `worker/src/routes/cron.js` — add to scheduled export
- **MODIFY:** `worker/src/index.js` — add to `scheduled.fetch()`

## Success Criteria (All Met)

- [x] Customers synced to Mautic contacts with correct fields (email, phone, loyalty_tier, birthday, total_orders)
- [x] Segment membership updated based on tier (Bronze/Silver/Gold/Platinum) + recency (active/at-risk/inactive)
- [x] Birthday-this-month flag set correctly (matches current month)
- [x] Delta sync via KV timestamp (mautic_last_sync_ts)
- [x] Batch processing handles 100+ customers in groups of 50
- [x] Error isolation: one batch failure doesn't block others
- [x] 13 TDD tests pass, 0 build errors

## Risk

- Large customer list may hit CF Worker CPU limits (mitigate: batch 50)
- Mautic API rate limits (test with realistic volume)
- KV consistency for timestamp (acceptable for nightly sync)
