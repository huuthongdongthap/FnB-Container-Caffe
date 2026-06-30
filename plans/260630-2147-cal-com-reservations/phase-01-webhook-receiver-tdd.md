# Phase 01 — Cal.com Webhook Receiver (TDD)

**Status:** ✅ complete
**Priority:** High
**TDD:** ✅ Write tests first, then implement

## Overview

Build webhook endpoint that receives Cal.com booking events, validates them, assigns an available cafe table, and writes to D1 `reservations` table.

## Test Cases (write BEFORE implementation)

1. Valid booking → assigns table, inserts reservation, returns 200
2. Missing/invalid webhook secret → returns 401
3. Invalid payload (missing fields) → returns 400
4. No available tables → returns 409
5. Duplicate booking (idempotent) → returns 200, no duplicate insert
6. Booking cancelled webhook → marks reservation as cancelled
7. Table assignment logic: prefers zone match, respects seat capacity

## Implementation

### New File: `worker/src/routes/cal-booking-webhook.js`

```javascript
// POST /api/webhooks/cal-booking
// Receives: Cal.com booking.created / booking.cancelled webhook
// Header: x-cal-webhook-secret for validation
// Body: { triggerEvent, payload: { uid, startTime, endTime, attendees[], metadata } }

export async function handleCalBookingWebhook(request, env) {
  // 1. Validate webhook secret header
  // 2. Parse body → triggerEvent, uid, startTime, endTime, attendees
  // 3. If booking.created: find available table → INSERT reservation
  // 4. If booking.cancelled: find reservation by cal_booking_uid → UPDATE status
  // 5. Return { success: true }
}
```

### Table allocation logic
- Extract guest_count from attendees.length
- Query cafe_tables WHERE seats >= guest_count AND status = 'Available'
- Prefer same zone if metadata.zone is provided
- Assign first matching table
- Add cal_booking_uid to reservations table (new column or notes field)

### Route registration in index.js
```javascript
app.post('/api/webhooks/cal-booking', (c) => handleCalBookingWebhook(c.req.raw, c.env));
```

## Touchpoints

- **NEW:** `worker/src/routes/cal-booking-webhook.js`
- **NEW:** `tests/cal-booking-webhook.test.js`
- **MODIFY:** `worker/src/index.js` (add route)
- **UNCHANGED:** `reservations.js`, `schema.sql`

## Success Criteria

- [x] 8 tests written and pass (7 planned + 1 zone-preference bonus)
- [x] Webhook validates secret header
- [x] Booking creates reservation with table assignment
- [x] Cancellation updates reservation status
- [x] Idempotent: duplicate webhook doesn't double-book
- [x] No available table returns 409
- [x] Build passes, existing tests pass

## Risk

- Cal.com webhook signature validation may differ from simple secret header — check docs
- If cafe_tables empty, all bookings fail — seed tables first
- Time slot conflict detection: Cal.com handles this; Worker just assigns tables
