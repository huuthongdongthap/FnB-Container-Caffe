---
phase: 1
gap: G4
title: Staff Push Notifications
status: pending
effort: 16h
priority: P1
depends_on: []
---

# Phase 1: G4 Staff Push Notifications (16h, P1)

## Mục tiêu / Objective

Staff nhận push notification khi có order mới + shift reminders trên mobile app.

## Existing Infrastructure (KEEP — đã có sẵn)

| File | Status |
|------|--------|
| `public/sw.js` | Push event handler + notification click (đã có) |
| `src/hooks/use-push-notifications.ts` | Subscribe/unsubscribe hook (đã có) |
| `worker/src/routes/push.ts` | Backend: subscribe/unsubscribe + VAPID public-key (đã có) |
| `worker/src/tree/push/notifier.ts` | `sendPushToCustomer()` — gửi push đến customer (đã có) |

## Thiếu / What's Missing

1. **Staff subscription** — subscription hiện chỉ lưu `customer_id`, chưa có role-based targeting cho staff
2. **Order alert trigger** — khi có order mới → trigger push đến assigned staff (kitchen/cashier)
3. **Shift reminder trigger** — reminder trước ca làm việc (30 phút trước)
4. **Staff push hook UI** — toggle notification settings trong staff panel
5. **Backend: sendPushToStaff** — variant của `sendPushToCustomer` target theo `staff_id` hoặc `role`

## Implementation Plan

### Step 1: Extend push_subscriptions table (worker/schema.sql hoặc D1 migration)

Thêm cột `role` vào table `push_subscriptions` để phân biệt customer vs staff:

```sql
ALTER TABLE push_subscriptions ADD COLUMN role TEXT DEFAULT 'customer';
-- role values: 'customer' | 'staff-kitchen' | 'staff-cashier' | 'staff-all'
```

### Step 2: Add `sendPushToStaff` to notifier.ts (worker/src/tree/push/notifier.ts)

Hàm mới query subscriptions theo `role` hoặc `staff_id`:

```typescript
export async function sendPushToStaff(
  env: PushEnv,
  role?: string,
  staffIds?: string[],  // nếu có staff_id mapping
  payload: PushPayload
): Promise<{ sent: number; failed: number }>
```

### Step 3: Add order alert trigger (worker/src/tree/orders/create-order.ts hoặc order-deduction)

Sau khi order được tạo → trigger push notification đến staff:

```typescript
import { sendPushToStaff } from '../push/notifier';

// Sau NẠP order thành công:
await sendPushToStaff(c.env, 'staff-kitchen', null, {
  title: 'Đơn hàng mới 🍳',
  body: `Bàn ${tableId} — ${itemCount} món`,
  data: { url: '/kds' }
});
```

### Step 4: Add shift reminder cron (Next.js API route + schedule)

- API route: `src/app/api/reminders/shifts/route.ts` — query shifts bắt đầu sau 30 phút
- Schedule: dùng CronTrigger hoặcWorker Cron để poll mỗi 15 phút
- Gửi push đến staff có ca sắp đến

```typescript
// Query shifts bắt đầu trong 15-45 phút tới
SELECT s.*, p.push_subscriptions FROM shifts s
JOIN staff p ON s.staff_id = p.id
WHERE s.clock_in IS NULL AND date = TODAY()
AND s.clock_in_planned BETWEEN NOW() + 15m AND NOW() + 45m
```

### Step 5: Add staff notification toggle (frontend)

New page/component: `src/pages/StaffNotifications.tsx` hoặc thêm vào dashboard:

```
src/components/staff/notification-settings.tsx  (NEW)
```

- Toggle "Nhận thông báo đơn hàng"
- Toggle "Nhận reminder ca làm"
- Gọi `/api/push/subscribe` với `role: 'staff-kitchen'`

### Step 6: VAPID keys generation (one-time)

```bash
# Generate VAPID key pair
npx web-push generate-vapid-keys
# → public: BcVi... private: mOaP...
# Add to worker/.env:
VAPID_PUBLIC_KEY=<public>
VAPID_PRIVATE_KEY=<private>
VAPID_EMAIL=mailto:admin@auraspace.vn
```

## Files to Create/Modify

| Action | File |
|--------|------|
| MODIFY | `worker/src/routes/push.ts` — add staff subscribe endpoint |
| MODIFY | `worker/src/tree/push/notifier.ts` — add `sendPushToStaff()` |
| MODIFY | `worker/src/tree/orders/create-order.ts` — trigger push on order |
| CREATE | `src/app/api/reminders/shifts/route.ts` — shift reminder API |
| CREATE | `src/components/staff/notification-settings.tsx` — UI toggle |
| CREATE | `db/migrations/*_g4_push_staff.sql` — D1 schema change |

## Risk/Border

- VAPID keys cần pair (public/private) — chưa có → MUST generate trước khi deploy
- staff_id mapping → hiện chưa có table liên kết push_subscription với staff table. Có thể dùng phone/email làm link.
- iOS Safari requires user gesture for Notification.requestPermission() — handle gracefully.
