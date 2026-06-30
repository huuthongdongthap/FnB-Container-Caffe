# Plan — Cal.com Reservation Integration

**Plan ID:** 260630-2147-cal-com-reservations
**Date:** 2026-06-30
**Status:** complete
**Effort:** 5h (actual; estimated 6-8h)

**TDD:** Tests before implementation per phase

## Overview

Integrate Cal.com embed widget as booking frontend. Cal.com handles calendar UI + time slots. Cloudflare Worker webhook receiver assigns cafe tables. Existing reservation system remains source of truth.

## Architecture

```
Customer → Cal.com embed widget (popup) → books time slot
  → Cal.com webhook → POST /api/webhooks/cal-booking
  → Worker: validate → assign table → INSERT reservations D1
  → GET /api/reservations/availability unchanged
```

## Phases

| Phase | Description | Effort | Status |
|-------|-------------|--------|--------|
| 01 | Webhook receiver + table allocator (TDD) | 3h | ✅ complete |
| 02 | Frontend embed widget | 1h | ✅ complete |
| 03 | Integration tests + finalize | 2h | ✅ complete |

## Code Review Fixes Applied

- **CRITICAL:** `seats` → `capacity` column name (matched D1 schema)
- **CRITICAL:** ISO string extraction for date/time (CF Worker UTC timezone fix)
- **CRITICAL:** Error message leak → generic 500 response
- **HIGH:** Index `idx_reservations_cal_uid` added to schema
- **HIGH:** Conflict check added to BOOKING_RESCHEDULED
- **HIGH:** guest_count validation (clamp 1–20), zone sanitization

## Quality Gates

- 653/653 tests pass, 0 build errors
- Cal.com embed widget on table-reservation.html with dark theme

## Dependencies

- Cal.com free account + event type "Đặt Bàn" configured
- CAL_WEBHOOK_SECRET env var in CF Worker
- Existing reservations API (no changes needed)

## Files Changed

- **NEW:** `worker/src/routes/cal-booking-webhook.js` — webhook receiver
- **NEW:** `tests/cal-booking-webhook.test.js` — 8 TDD tests
- **MODIFY:** `worker/src/index.js` — register webhook route
- **MODIFY:** `worker/schema.sql` — cal_booking_uid column + index
- **MODIFY:** `worker/src/routes/reservations.js` — capacity column fix
- **MODIFY:** `table-reservation.html` — embed Cal.com widget
- **MODIFY:** `table-reservation.css` — Cal.com button styles
