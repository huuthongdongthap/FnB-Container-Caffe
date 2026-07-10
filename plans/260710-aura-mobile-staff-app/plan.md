# AURA Mobile — Staff PWA for Orders & Tables

**Status:** proposed
**Date:** 2026-07-10
**Workflow:** ultracode --parallel (8 agents)

## Goal

Build AURA Mobile: a PWA-only staff app (no customer app) that assigns each staff member exactly the features they need: waiters take/update orders, kitchen sees KDS, managers see everything. All routes are staff-protected, offline-first, and mobile-first.

## Why This Now

- QR ordering works → orders now come in fast → staff need mobile access
- KDS page exists but is admin-only (desktop UI, not mobile-friendly)
- No per-role access control → everyone sees everything or nothing
- Staff currently use desktop admin or physical paper → friction
- 17 modified files in working tree → team is active, momentum exists

## Phases

| # | Phase | Agent | Est |
|---|-------|-------|-----|
| 1 | Staff Roles & Mobile Auth | 2 agents | 2h |
| 2 | KDS + Table Management | 3 agents | 4h |
| 3 | Offline Sync + PWA Shell | 2 agents | 3h |
| 4 | Push Notifications | 1 agent | 1h |
| 5 | Mobile UI Screens | 1 agent | 3h |
| 6 | Tests + Deploy | 1 agent | 2h |

## Key Decisions

- **Roles:** `owner`, `manager`, `staff` (kitchen), `waiter` — NOT `customer`
- **Auth:** Same JWT system, `/mobile` routes are staff-protected separate from admin
- **Offline:** D1 + IndexedDB via `offline-db.ts` (already exists), queue mutations, sync on reconnect
- **PWA:** Service worker (auto-register), manifest.json, install prompt
- **No new backend framework** — extend existing Hono + D1

## Files Created (New)

```
worker/src/routes/
  staff-auth.ts          # Staff login (pin-based), token refresh
  kds-mobile.ts          # Mobile KDS endpoints (status updates, elapsed)
  tables-mobile.ts       # Table list, status update, split
  orders-mobile.ts       # Create order, update status, history
  notifications.ts       # Subscribe/unsubscribe push

worker/src/lib/
  staff-roles.ts         # Role definitions, RBAC helpers
  push-notifier.ts       # Web Push API integration (existing push.ts extended)

src/pages/mobile/
  MobileLogin.tsx        # PIN + remember device
  KitchenDisplay.tsx     # KDS cards (elapsed timer, status flow)
  WaiterOrders.tsx       # Order list, create, update
  TableManager.tsx       # Table grid, status, sessions
  OfflineQueue.tsx       # Pending sync indicator
  MobileLayout.tsx       # Shell (bottom nav, role-based menu)

src/hooks/
  use-mobile-auth.ts     # Staff JWT + device token
  use-offline-sync.ts    # Queue + sync hook (extends offline-db.ts)

public/
  manifest-mobile.json   # PWA manifest for staff app
  sw-mobile.js           # Service worker (cache + push)

worker/db/migrations/
  260710_staff_roles.sql # Role column (owner/manager/staff/waiter), push_subscriptions
```

## Files Modified

```
src/App.tsx              # Add /mobile routes (staff-protected)
worker/src/index.ts      # Mount staff mobile routers
src/lib/offline-db.ts    # Extend for order/table sync queue
src/locales/vi.json      # Mobile UI strings
src/locales/en.json      # Mobile UI strings
package.json             # Add workbox-precaching (PWA), web-push
vite.config.js           # Copy manifest-mobile.json + sw-mobile.js to dist
worker/src/lib/validators.ts # Add staff role enums, PIN schema
```

## Risk Flags

- `ordersRouter` exists in both `worker/src/routes/` (legacy JS) and `worker/src/routes/orders-hono.ts` (new TS) — shadow conflict. Staff routes mount at `/mobile` → no overlap, verify no collision.
- Offline sync with D1 is untested beyond `offline-db.ts` stub — test conflict resolution (what if 2 waiters update same order?).
- `manifest-mobile.json` vs existing manifest.json — decide: separate PWA for staff, or extend existing.
- QR ordering E2E just completed — don't break the working `/api/orders` flow staff routes will consume.

## Acceptance

- [ ] Staff login with role returns correct JWT + role claims
- [ ] Waiter sees only order list + create; kitchen sees only KDS
- [ ] Kitchen status update (pending → preparing → served) works offline
- [ ] Table status (available → occupied → paid) updates offline, syncs on reconnect
- [ ] Kitchen receives push notification for new orders
- [ ] PWA installable on iOS Safari + Android Chrome
- [ ] All existing `/api/orders` flows unchanged (zero regression)
- [ ] Tests pass: existing + 50+ new mobile tests
