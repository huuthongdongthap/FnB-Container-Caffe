---
name: 260706-1429-g4-g9-analytics-remaining
title: Phase 2 Remaining — G4 Push Notifications + G9 PWA Offline + Analytics Dashboard
status: pending
date: 2026-07-06
depends_on: [G3 token migration — committed 5d05f26, Stitch Fix 100]
---

# Next Execution Plan: G4 + G9 + Analytics Dashboard

## Mục tiêu

Execute remaining Digital Gap Closure items + Analytics Dashboard in parallel format.
Stitch Fix 100 is functionally complete (widgets injected, tsc passes).

## Tracks

| ID | Track | Effort | Priority | Status | Parallel Group |
|----|-------|--------|----------|--------|----------------|
| G4 | Staff Push Notifications | 16h | P1 | Plan ready, exec pending | Group A (sequential) |
| G9 | PWA Full Offline Mode | 8h | P2 | Plan ready, exec pending | Group B (parallel w/ Analytics) |
| Analytics | Analytics Dashboard | 6h | P2 | Plan at 260702-1532 | Group B (parallel w/ G9) |

## Execution Order

```
Group A: G4 (P1, MUST finish first — 16h)
  └─ sendPushToStaff + order trigger + shift reminder + staff settings UI

Group B (parallel): G9 + Analytics (P2, can run concurrently — 8h + 6h)
  ├─ G9: IndexedDB wrapper + menu cache + offline banner + order queue UI
  └─ Analytics: Dashboard metrics + charts + reports
```

## G4: Staff Push Notifications (P1, 16h)

### Existing Infrastructure (KEEP)

| File | Status |
|------|--------|
| `public/sw.js` | Push event handler + notification click |
| `src/hooks/use-push-notifications.ts` | Subscribe/unsubscribe hook |
| `worker/src/routes/push.ts` | Backend: subscribe/unsubscribe + VAPID |
| `worker/src/tree/push/notifier.ts` | `sendPushToCustomer()` |

### What's Missing

1. D1 migration: `role` column in `push_subscriptions`
2. `sendPushToStaff()` in notifier.ts — role-based targeting
3. Order alert trigger in create-order.ts
4. Shift reminder cron/route
5. Staff notification settings UI
6. VAPID keys generation (one-time)

### Files to Modify/Create

| Action | File |
|--------|------|
| CREATE | `db/migrations/*_g4_push_staff.sql` |
| MODIFY | `worker/src/tree/push/notifier.ts` — add `sendPushToStaff()` |
| MODIFY | `worker/src/routes/push.ts` — add staff subscribe |
| MODIFY | `worker/src/tree/orders/create-order.ts` — trigger push on order |
| CREATE | `worker/src/routes/reminders/shifts/route.ts` |
| CREATE | `src/components/staff/notification-settings.tsx` |

### Risks

- VAPID key pair generation required before deploy
- iOS Safari requires user gesture for Notification.requestPermission()
- staff_id ↔ push_subscription mapping needs phone/email link

## G9: PWA Full Offline Mode (P2, 8h)

### Existing (KEEP)

| Feature | Location | Status |
|---------|----------|--------|
| Cache-first static assets | `public/sw.js` | ✅ |
| Network-first API + offline queue | `public/sw.js` | ✅ |
| Background sync | `public/sw.js` | ✅ |
| Retry queued API | `public/sw.js` | ✅ |
| manifest.json | `public/manifest.json` | ✅ |

### What's Missing

1. IndexedDB wrapper for offline data
2. Menu pre-cache on online
3. Offline order queue UI ("pending sync" indicator)
4. Offline detection banner

### Files to Modify/Create

| Action | File |
|--------|------|
| CREATE | `src/lib/offline-db.ts` — IndexedDB wrapper |
| MODIFY | `src/hooks/use-online-status.ts` — offline detection hook |
| CREATE | `src/components/offline/offline-banner.tsx` — top banner |
| CREATE | `src/components/offline/order-queue-indicator.tsx` — pending sync badge |
| MODIFY | Menu pages — pre-cache menu data to IndexedDB |

## Analytics Dashboard (P2, 6h)

Source: `plans/260702-1532-analytics-dashboard/plan.md`

### Metrics to Implement

| Widget | Data Source |
|--------|-------------|
| Revenue overview (daily/weekly/monthly) | Orders table |
| Top-selling items | Order items aggregation |
| Peak hours heatmap | Order timestamps |
| Customer analytics | Customer table |
| Staff performance | Shift + order data |

### Files to Create/Modify

| Action | File |
|--------|------|
| CREATE | `worker/src/routes/analytics/*` — metrics endpoints |
| CREATE | `src/pages/analytics/[locale]/*.tsx` — dashboard pages |
| MODIFY | Navigation — add analytics link |

## Acceptance Criteria

1. **G4**: Staff receives push when new order placed; settings page has on/off toggles; shift reminder fires 30min before shift
2. **G9**: App loads menu offline; offline banner shows when disconnected; queued orders auto-sync on reconnect
3. **Analytics**: Dashboard shows revenue chart, top items, peak hours; all data queries <500ms

## Out of Scope

- G5 ERPNext (already done per task #11)
- Stitch Fix 100 icon polish (cosmetic, low value)
- Polar/PayPal billing (banned per doctrine)

## Non-Negotiable Constraints

- TypeScript strict mode (`tsc --noEmit` 0 errors)
- No `:any` types
- Zero `console.log` in production
- YAGNI: no over-engineering offline queue
- Follow existing layer architecture (seed/tree/forest/land)
