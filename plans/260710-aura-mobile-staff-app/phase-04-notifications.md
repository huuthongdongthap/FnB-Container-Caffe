# Phase 4: Push Notifications — Web Push for Kitchen

**Duration:** 1h | **Agent:** backend-device

## Context

Kitchen staff needs immediate notification when new orders come in, regardless of app state.

## Requirements

1. **Web Push subscription flow**:
   - `POST /mobile/notifications/subscribe` — save subscription to `push_subscriptions` D1 table
   - `POST /mobile/notifications/unsubscribe` — remove subscription
   - Link subscription to staff_id + role

2. **Trigger push on events**:
   - New customer order → push to all `staff` role devices ("Đơn hàng mới 🍳")
   - Order status → `served` → push to owning table's waiter (if assigned)
   - Kitchen can dismiss individual notifications

3. **Extend existing push system**:
   - Existing `worker/src/tree/push/notifier.js` handles Firebase + VAPID
   - Reuse VAPID keys (add to `worker/src/types/env.ts` if missing: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`)

## Files

- `worker/src/routes/notifications.ts` (new) — or extend `pushRouter` at `/api/push`
- `worker/src/lib/push-notifier.ts` (new) — thin wrapper over `notifier.js` for Web Push
- `worker/src/types/env.ts` — add VAPID keys to Env type

## Constraints

- Max 1 notification per order (no spam if waiter also has the device)
- Notification includes: order_id, table_name, item_count, timestamp
- Payload max 4KB (Web Push limit)
