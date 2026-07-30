# AURA Mobile — Ship Next Steps

**Date:** 2026-07-12
**Status:** active
**Branch:** main

---

## Mục tiêu (Goal)

Deploy staff mobile auth + backend routes lên production → wire frontend → E2E → release.

---

## Phase 0 — D1 Migration + Deploy (TODAY)

### Step 0.1: Apply D1 migration
```bash
cd /Users/macbook/FnB-Container-Caffe
bash scripts/apply-migrations.sh
```
- Migration file: `worker/db/migrations/20260710_01_staff_roles.sql`
- Creates: `staff_devices` table, `role` column on `staff`
- Verifies: `staff_devices` table exists in D1

### Step 0.2: Build + deploy
```bash
cd /Users/macbook/FnB-Container-Caffe
npm run build 2>&1 | tail -5
bash deploy-cloudflare.sh 2>&1 | tail -10
```
- Expected: 0 TS errors, deploy exit 0
- Deploy URL: `https://aura-space-worker.agencyos-openclaw.workers.dev`

### Step 0.3: Verify production endpoints
```bash
# Health check
curl -s https://aura-space-worker.agencyos-openclaw.workers.dev/api/health

# Version endpoint
curl -s https://aura-space-worker.agencyos-openclaw.workers.dev/api/version

# Staff mobile login (mock test)
curl -s -X POST https://aura-space-worker.agencyos-openclaw.workers.dev/mobile/login \
  -H "Content-Type: application/json" \
  -d '{"device_token":"test","pin":"1234"}'
# Expected: 404 (device not registered) — proves endpoint mounted
```

**Mục tiêu:** Production có `/mobile/login`, `/mobile/refresh`, `/mobile/devices/*`, `/mobile/kds/*`, `/mobile/orders/*`, `/mobile/tables/*`, `/mobile/notifications/*`

---

## Phase 1 — Frontend Hooks (Day 2-3)

### Step 1.1: Create `src/hooks/use-mobile-auth.ts`
- Reads/writes JWT to localStorage
- `login(device_token, pin)` → `POST /mobile/login`
- `refresh()` → `POST /mobile/refresh`
- `logout()` → clear storage
- Returns: `{ user, token, loading, login, logout, refresh }`

### Step 1.2: Create `src/hooks/use-offline-sync.ts`
- Reads/writes IndexedDB via `offline-db.ts`
- Queue mutations when offline
- Sync on reconnect (navigator.onLine event)
- Returns: `{ queue, sync, isOnline, pendingCount }`

### Step 1.3: Wire `mobile-login.tsx` → backend
- Connect PIN form → `use-mobile-auth.login()`
- On success → navigate to `/mobile` shell
- Show loading/error states

### Step 1.4: Mount mobile routes in `src/App.tsx`
```tsx
// Add to router (if exists) or route map
{
  path: '/mobile/login',
  element: <MobileLogin />
},
{
  path: '/mobile',
  element: <MobileLayout />,
  children: [
    { path: 'kds', element: <KitchenDisplay /> },
    { path: 'orders', element: <WaiterOrders /> },
    { path: 'tables', element: <TableManager /> },
    { path: 'notifications', element: <NotifPanel /> },
    { path: 'profile', element: <ProfilePanel /> },
  ]
}
```

---

## Phase 2 — KDS + Table Flows (Day 4-5)

### Step 2.1: Wire `kitchen-display.tsx` → `GET /mobile/kds/orders`
- Fetch pending orders (status: `pending` | `preparing`)
- Show: table number, items, time elapsed, status buttons
- Status flow: pending → preparing → ready → served → paid
- Push: Listen for `orders-mobile.ts` real-time updates (polling fallback)

### Step 2.2: Wire `table-manager.tsx` → `GET/PATCH /mobile/tables`
- Fetch table list (available | occupied | paid | reserved)
- Toggle table status via `PATCH`
- Show: table number, current order, elapsed time, QR code
- Manager-only: create/close/edit tables

### Step 2.3: Wire `waiter-orders.tsx` → `POST /mobile/orders`
- Create order: table_id + items → D1
- Update status: pending → preparing → served
- Filter by: my orders | all (owner/manager)

### Step 2.4: Offline sync test
- Take 2 devices offline → queue mutations
- Go online → verify sync (last-write-wins for same order?)
- Edge case: 2 waiters update same order → conflict resolution

---

## Phase 3 — E2E + PWA Polish (Day 6-7)

### Step 3.1: E2E tests (Playwright)
```
tests/e2e/mobile/
  ├── staff-login.spec.ts      # PIN flow + JWT
  ├── kds-flow.spec.ts         # pending → served
  ├── table-manager.spec.ts    # status toggle
  └── offline-sync.spec.ts     # queue → sync
```
- 5-10 tests minimum
- Run: `npx playwright test --config=playwright.config.prod.ts`

### Step 3.2: PWA install prompt
- iOS Safari: `<meta name="apple-mobile-web-app-capable">`
- Android Chrome: `BeforeInstallPromptEvent` handler
- Service worker: cache strategy (stale-while-revalidate)
- manifest: separate for staff app (`manifest-mobile.json`)

### Step 3.3: Push notification flow
- `GET /api/vapid-key` (public key)
- `POST /mobile/notifications/subscribe` with push subscription JSON
- Listen for `PushEvent` in `sw-mobile.js`
- Show notification on new KDS order

### Step 3.4: Admin — Device Management page
- Register device: enter staff name + device name + role + PIN
- Revoke device: delete from staff_devices
- List devices: show last login, role

---

## Phase 4 — Beta + Release (Day 8-10)

### Step 4.1: Internal beta
- 2 staff tablets → install PWA → test KDS
- 1 waiter phone → PIN → take orders
- 1 manager phone → table management

### Step 4.2: Bug fixes + polish
- Fix edge cases from beta
- Add loading spinners, error boundaries
- UIImage CORS issues (table QR preview)

### Step 4.3: Production release
- Deploy: `bash deploy-cloudflare.sh`
- SHAs match → green report
- QA: all E2E pass → ship

---

## Files to Modify/Create

| File | Action |
|------|--------|
| `worker/db/migrations/20260710_01_staff_roles.sql` | Apply (not modified) |
| `src/hooks/use-mobile-auth.ts` | CREATE |
| `src/hooks/use-offline-sync.ts` | CREATE |
| `src/pages/mobile/mobile-login.tsx` | EDIT (wire backend) |
| `src/App.tsx` | EDIT (add routes) |
| `worker/src/index.ts` | EDIT (mount /mobile/*) |
| `tests/e2e/mobile/*.spec.ts` | CREATE (4 files) |

---

## Acceptance Criteria

- [ ] D1 migration applied → `staff_devices` table exists
- [ ] Build 0 TS errors → deploy exit 0
- [ ] `/api/version` shortSha matches local commit
- [ ] POST `/mobile/login` returns 200 with JWT + role
- [ ] STAFF only sees role-appropriate screens
- [ ] Kitchen push notification on new order (real device)
- [ ] 5+ E2E tests pass (staged → production)
- [ ] PWA installable on iOS Safari + Android Chrome

---

**Estimated total:** 10 days (1 dev)
**Parallelization:** Frontend hooks (Step 1) có thể song song với backend deploy (Step 0)
**Risk:** Offline sync conflict resolution cần design decision trước khi implement.
