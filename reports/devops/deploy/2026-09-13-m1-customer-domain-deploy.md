# Deploy Report — M1 Customer Domain (2026-09-13)

## Scope shipped

Commit `58ca0f4` — customer-data foundation, additive and non-blocking:

- `tree/customer/` — identify-customer, record-consent, record-visit,
  link-order + helpers (all capture failures log-only, never throw)
- D1 migration `20260913_01` applied to remote: customer_identities,
  consents, customer_events, visits (4/4 verified via sqlite_master)
- Wiring: checkout identify+link, signup phone identity + crm consent,
  served/completed visit capture (channel from order_type + table_id)

## Pre-flight

| Check | Status |
|-------|--------|
| Customer-domain unit tests | ✅ 16/16 |
| Full worker suite | ✅ 152 files / 1567 tests |
| tsc --noEmit (tree/* scope) | ✅ no errors in touched trees |
| D1 remote tables | ✅ 4/4 present |

## Deploy

| Item | Value |
|------|-------|
| Worker version | `70fa14c4-1a81-4f9b-9943-c1cc3aac8709` |
| URL | https://aura-space-worker.sadec-marketing-hub.workers.dev |

## Post-deploy smoke

- GET `/api/health` → `{"status":"ok",...}` ✅
- Root `/` → auth gate active (`Unauthorized`) — expected for unauthenticated request ✅
- Rollback: previous version `v92f52c22...` kept live via wrangler versions; new writes swallow errors so checkout path unaffected even under partial failure.

## Untouched

- No existing endpoint contract changed; orders/loyalty flows identical on success path.
- Old bundle deployable at every step (migration is CREATE TABLE IF NOT EXISTS; wiring additive).
