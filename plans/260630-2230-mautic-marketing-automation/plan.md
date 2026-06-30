# Plan — Mautic Marketing Automation Bridge

**Plan ID:** 260630-2230-mautic-marketing-automation
**Date:** 2026-06-30
**Status:** complete
**Effort:** 25h (actual)
**TDD:** Tests before implementation per phase (73 TDD tests written)

## Overview

One-way sync bridge: CF Worker cron pushes Aura D1 customer data → Mautic API (contacts + segments). Campaign logic configured in Mautic UI. Channels: Email (Resend), SMS (SpeedSMS), Zalo ZNS (existing).

## Architecture

```
D1 customers ──cron──▶ Worker bridge ──REST──▶ Mautic (contacts + segments)
  │                                                   │
  └── orders, loyalty, birthdays               ┌──────┼──────┐
                                               ▼      ▼      ▼
                                            Email   Zalo   SMS
                                           (Resend) (zalo) (SpeedSMS)
```

## Phases

| Phase | Description | Effort | Status | Tests |
|-------|-------------|--------|--------|-------|
| 01 | Mautic API client (OAuth2 + contact/segment CRUD) | 6h | complete | 27 |
| 02 | Customer contact sync (D1 → Mautic bridge) | 4h | complete | 13 |
| 03 | Email + SMS channel integration (Resend + SpeedSMS) | 5h | complete | 21 |
| 04 | Campaign triggers (win-back, birthday, promo) | 5h | complete | 12 |
| 05 | Integration tests + finalize | 3h | complete | — |

**Total new TDD tests: 73 · Overall test suite: 726 pass, 0 build errors**

## Dependencies

- Mautic self-hosted instance (user provisioned: Docker on VPS/RPi)
- Resend API key (free tier)
- SpeedSMS API key (VN phone verification required)
- Zalo ZNS already integrated in `worker/src/routes/zalo.js`

## Files Changed (Actual)

### Created
- `worker/src/lib/mautic-client.js` (527 lines) — Mautic REST API client, OAuth2, retry, FastCGI fallback
- `worker/src/routes/mautic-bridge.js` (598 lines) — sync bridge + campaign enrollment triggers
- `worker/src/lib/resend-client.js` (96 lines) — Resend email client
- `worker/src/lib/speedsms-client.js` (109 lines) — SpeedSMS client with phone normalization
- `worker/src/lib/campaign-templates.js` (99 lines) — win-back, birthday, promo text/email/SMS templates
- `tests/mautic-client.test.js` (541 lines, 27 tests)
- `tests/mautic-bridge.test.js` (437 lines, 13 tests)
- `tests/resend-client.test.js` (141 lines, 9 tests)
- `tests/speedsms-client.test.js` (131 lines, 12 tests)
- `tests/campaign-triggers.test.js` (337 lines, 12 tests)

### Modified
- `worker/src/routes/cron.js` — added Mautic sync + trigger re-exports

### Unchanged
- loyalty.js, birthday.js, zalo.js, orders.js, customers.js, index.js, schema.sql

## Results

- 73 TDD tests written across 5 test files
- 0 build errors, 726 total test suite passes
- Contact sync: D1 customers → Mautic contacts via batch upsert (50/batch)
- Segment sync: loyalty tier, recency bucket, and birthday-this-month mapped to Mautic segments
- Campaign triggers: automated win-back (30d inactive), birthday (month matches), and promo (admin-triggered)
- Email: Resend API with Vietnamese UTF-8 templates, graceful degradation on missing API key
- SMS: SpeedSMS.vn with phone normalization (+84 format), brandname type (2), Vietnamese content
- Campaign enrollment tracking via D1 `campaign_enrollments` table for dedup and audit
- Total monthly cost target: <= $10 (Mautic hosting + SMS)
