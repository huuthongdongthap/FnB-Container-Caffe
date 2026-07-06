---
phase: 1
gap: G4
title: Staff Push Notifications — Execution
status: pending
effort: 12h
priority: P1
depends_on: []
---

# Phase 1: G4 Staff Push Notifications (12h, P1)

> **Execution phase for plan `260706-1429-g4-g9-analytics-remaining`**
> Reports: `/Users/macbook/FnB-Container-Caffe/plans/reports/`

---

## Reality Check (from codebase audit)

Most infrastructure already exists on the `main` branch but is **not connected**:

| Component | File | Status |
|-----------|------|--------|
| `sendPushToStaff()` function | `worker/src/tree/push/notifier.ts:101` | **EXISTS** — 59 lines, works |
| `push.ts` routes (subscribe, send-staff, public-key, unsubscribe) | `worker/src/routes/push.ts` | **EXISTS** — 78 lines |
| `NotificationSettings` admin page | `src/pages/admin/NotificationSettings.tsx` | **EXISTS** — 582 lines |
| `usePushNotifications` hook | `src/hooks/use-push-notifications.ts` | **EXISTS** — 141 lines |
| `sw.js` push event handler | `public/sw.js:176` | **EXISTS** — push + notificationclick |
| `staff_shifts` table | `worker/schema.sql:454` | **EXISTS** — needs `clock_in_planned` |
| VAPID keys | `worker/.env.example:95-97` | **DEFINED** — not yet set in `.dev.vars` |
| `web-push` package | `worker/package.json:17` | **INSTALLED** — `^3.6.7` + `@types` |

**Missing / Broken (must fix to make G4 work):**

| Blocker | File | Issue |
|---------|------|-------|
| `push_subscriptions` table | `worker/schema.sql` | **NEVER CREATED** — INSERT/SELECT will 500 |
| Push router not mounted | `worker/src/index.ts:221` | `app.route('/api/shifts', shiftsRouter)` — no `/api/push/*` mount |
| `clock_in_planned` column | `worker/schema.sql:454` | Needed for shift reminder query |
| VAPID keys not set | `worker/.dev.vars` | Empty in `.env.example`; must generate |

---

## Prerequisites (MUST complete before Step 1)

### 1. Generate VAPID Key Pair (one-time, ~2 min)

```bash
cd /Users/macbook/FnB-Container-Caffe/worker
npx web-push generate-vapid-keys
# Example output:
#   Public Key: BGvN8kXqR5M8vW2zYpKsHtFfNqLxVrZa...
#   Private Key: mOaPqRsTuVwXyZaBcDeFgHiJkLmNoPqRsTuVwXy...
```

Add to `worker/.dev.vars` (local) and `worker/.env.example` (template):
```env
VAPID_PUBLIC_KEY=<generated-public-key>
VAPID_PRIVATE_KEY=<generated-private-key>
VAPID_EMAIL=mailto:admin@auraspace.vn
```

**Risk**: Without VAPID keys, `initPush()` in `notifier.ts:36` skips silently — no crash, no push sent.

### 2. Create `/Users/macbook/FnB-Container-Caffe/plans/reports/g4-prerequisites.md`

Log VAPID key generation status and any setup blockers.

---

## Step 1: D1 Migration — `push_subscriptions` table + `staff_shifts.clock_in_planned`

**Effort**: 30 min

### Files

**CREATE**: `worker/migrations/008_push_subscriptions.sql`

```sql
-- 008: Web Push Subscriptions table + staff_shifts.clock_in_planned
-- G4: Staff Push Notifications

-- Push subscription registry (replaces any implicit table)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  endpoint TEXT NOT NULL UNIQUE,
  auth_key TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  user_agent TEXT,
  role TEXT NOT NULL DEFAULT 'customer',
  -- role: customer | staff-kitchen | staff-cashier | staff-all
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_role
  ON push_subscriptions (role);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer
  ON push_subscriptions (customer_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
  ON push_subscriptions (endpoint);

-- Add clock_in_planned to staff_shifts for shift reminders
ALTER TABLE staff_shifts ADD COLUMN clock_in_planned TEXT;
-- Stores the ISO datetime when staff is expected to clock in
```

### Apply migration

```bash
cd /Users/macbook/FnB-Container-Caffe/worker
wrangler d1 execute fnb-caffe-db --file=migrations/008_push_subscriptions.sql
```

**Or use existing script**:
```bash
bash /Users/macbook/FnB-Container-Caffe/scripts/apply-migrations.sh
```

### Acceptance Criteria

- [ ] Table `push_subscriptions` exists in D1 (`SHOW TABLES` includes it)
- [ ] `staff_shifts` has `clock_in_planned` column
- [ ] No D1 errors on migration apply

### Risk

- **MEDIUM**: D1 `ALTER TABLE` locks table briefly. Low traffic: safe. Schedule during off-peak.
- **LOW**: `CREATE TABLE IF NOT EXISTS` is idempotent — safe to re-run.

---

## Step 2: Mount Push Router in `worker/src/index.ts`

**Effort**: 5 min

### File to Modify

`worker/src/index.ts` — add import and route mount **after line 221** (after `app.route('/api/shifts', shiftsRouter)`):

**INSERT** at line 222 (new):
```typescript
import { pushRouter } from './routes/push.js';  // add to existing imports block at ~line 53
```

Then after line 221, add:
```typescript
app.route('/api/push', pushRouter);
```

**Exact edit locations:**

1. **Import block** — add after `import { shiftsRouter } from './routes/shifts';` at line 43:
   ```typescript
   import { pushRouter } from './routes/push.js';
   ```

2. **Route mount** — add after `app.route('/api/shifts', shiftsRouter);` at line 221:
   ```typescript
   app.route('/api/push', pushRouter);
   ```

### Acceptance Criteria

- [ ] `npm run typecheck` in `worker/` passes (0 TS errors)
- [ ] `GET /api/push/public-key` returns `{ success: true, publicKey: "..." }`
- [ ] All existing push routes (`/subscribe`, `/unsubscribe`, `/send-staff`) accessible under `/api/push/*`

### Risk

- **LOW**: Simple route mount. No behavioral change to existing routes.

---

## Step 3: Wire Order Alert Trigger in `create-order.ts`

**Effort**: 20 min

### File to Modify

`worker/src/tree/orders/create-order.ts`

**EXISTING imports** at lines 1-14:
```typescript
import { Hono } from 'hono';          // not used here, handler pattern
import { jsonResponse, errorResponse } from '../../middleware/cors';
import { createLogger } from '../../middleware/logger';
import { createOrderSchema, paymentMethodSchema } from '../../lib/validators';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { generateId, parseJSON } from './helpers';
import { notifyTelegram } from './telegram';
import { deductInventoryForOrder } from '../../routes/inventory/order-deduction';
import { syncOrderToERPNext } from '../../tree/erpnext/sync.js';
```

**ADD** after last import:
```typescript
import { sendPushToStaff } from '../../tree/push/notifier.js';
```

**INSERT** new section after line 123 (after Telegram block, before metrics):

```typescript
  // G4: Push notification to kitchen staff on new order (fire-and-forget)
  if (ctx?.waitUntil) {
    const kitchenItems = (data.items || []).filter((i: Record<string, unknown>) =>
      ['food', 'drink', 'kitchen'].includes(String(i.category || '').toLowerCase())
    );
    if (kitchenItems.length > 0) {
      ctx.waitUntil(
        sendPushToStaff(c.env as Record<string, unknown>, {
          title: 'Don hang moi 🍳',
          body: `Ban ${resolvedTableId ? (await db.prepare('SELECT table_number FROM cafe_tables WHERE id = ?').bind(resolvedTableId).first<{ table_number: string }>())?.table_number || resolvedTableId.slice(0, 8) : 'Mang ve'} — ${kitchenItems.length} mon`,
          data: { url: '/kds', orderId },
        }, 'staff-kitchen')
      );
    }
  }
```

**Exact insertion point**: After line 124 (`await telegramPromise;` or `}` after the else block at line 123), before line 126 (`if (ctx?.waitUntil)` for metrics).

### Acceptance Criteria

- [ ] `npm run typecheck` in `worker/` passes
- [ ] Creating order triggers `sendPushToStaff` with role `staff-kitchen`
- [ ] Push title = `'Don hang moi 🍳'`, body shows table + item count
- [ ] `data.url = '/kds'` passed in payload
- [ ] Fire-and-forget (doesn't block order creation response)
- [ ] Console log from notifier shows "Staff push sent" for kitchen items

### Risk

- **MEDIUM**: Table number query adds a small DB read inside the fire-and-forget. If `cafe_tables` row not found, falls back to `resolvedTableId.slice(0,8)`. Double-fetch is acceptable since it's non-blocking.
- **LOW**: `kitchenItems` filter uses category. If item categories are inconsistent, push may not fire. Mitigation: fallback to always send for any order with items.

---

## Step 4: Shift Reminder Cron — `worker/src/routes/shift-reminders.ts`

**Effort**: 1h

### Files

**CREATE**: `worker/src/routes/shift-reminders.ts`

```typescript
/**
 * Shift Reminder Cron — /api/cron/shift-reminders
 * Sends push notification 30 min before planned clock-in.
 * Called via Worker scheduled trigger (add to wrangler.toml crons).
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { sendPushToStaff } from '../tree/push/notifier';

interface ShiftWithSubscriptions {
  id: string;
  staff_name: string;
  role: string;
  clock_in_planned: string;
  endpoint: string;
  auth_key: string;
  p256dh_key: string;
}

export const shiftRemindersRouter = new Hono<{ Bindings: Env }>();

// GET /api/cron/shift-reminders — find shifts starting in 15-45 min, send push
shiftRemindersRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const now = new Date().toISOString();
  const in15 = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const in45 = new Date(Date.now() + 45 * 60 * 1000).toISOString();

  // Find staff with shifts starting in 15-45 min who have push subscriptions
  const { results } = await db.prepare(`
    SELECT s.staff_name, s.role, s.clock_in_planned, p.endpoint, p.auth_key, p.p256dh_key
    FROM staff_shifts s
    JOIN push_subscriptions p ON p.role = 'staff-' || s.role
    WHERE s.clock_in_planned IS NOT NULL
      AND s.clock_in_planned BETWEEN ? AND ?
      AND s.date = date(?)
      AND s.is_active = 1
  `).bind(in15, in45, now).all<ShiftWithSubscriptions>();

  if (!results || results.length === 0) {
    return c.json({ success: true, sent: 0, message: 'No upcoming shifts found' });
  }

  // Deduplicate by staff_name (avoid double-send if same staff has multiple subs)
  const byStaff = new Map<string, ShiftWithSubscriptions>();
  for (const r of results) {
    if (!byStaff.has(r.staff_name)) byStaff.set(r.staff_name, r);
  }

  let sent = 0;
  for (const [staffName, sub] of byStaff) {
    const plannedTime = new Date(sub.clock_in_planned).toLocaleTimeString('vi-VN', {
      hour: '2-digit', minute: '2-digit',
    });
    const result = await sendPushToStaff(c.env as Env, {
      title: 'Nhap ca sau 30 phut ⏰',
      body: `${staffName} — Ca lam luc ${plannedTime}`,
      data: { url: '/admin/staff', type: 'shift-reminder' },
    }, `staff-${sub.role}`);
    sent += result.sent;
  }

  return c.json({ success: true, sent, checked: byStaff.size });
});
```

### File to Modify

`worker/src/index.ts` — mount the cron route and add to scheduled handler.

**ADD** import after line 57 (after `runCampaignTriggers`):
```typescript
import { shiftRemindersRouter } from './routes/shift-reminders.js';
```

**ADD** route mount after line 335 (after `/cron/digest`):
```typescript
// Shift reminder push cron
app.route('/api/cron/shift-reminders', shiftRemindersRouter);
```

**ADD** to `scheduled` handler (line 448+), add new waitUntil inside scheduled():
```typescript
ctx.waitUntil(
  (async () => {
    const resp = await fetch(`${c.env.FE_BASE_URL}/api/cron/shift-reminders`, {
      headers: { 'X-Cron-Secret': c.env.CRON_SECRET || '' },
    });
    return resp.json();
  })()
);
```

**Exact insertion**: Inside `export const scheduled = { fetch(...)` at line 447, add the new waitUntil after line 461 (`ctx.waitUntil(runCampaignTriggers(...))`).

**File to Modify**: `worker/wrangler.toml`

**MODIFY** crons line 37:
```toml
# BEFORE:
crons = ["*/5 * * * *"]

# AFTER:
crons = ["*/5 * * * *", "*/15 * * * *"]   # add shift reminder poll every 15 min
```

### Acceptance Criteria

- [ ] `npm run typecheck` in `worker/` passes (0 TS errors)
- [ ] `GET /api/cron/shift-reminders` returns `{ success: true, sent: N }`
- [ ] Cron fires every 15 min per `wrangler.toml`
- [ ] When shift `clock_in_planned` is within 15-45 min window AND staff has `role = 'staff-kitchen'` push subscription → push sent with title `'Nhap ca sau 30 phut'`
- [ ] No duplicate sends for same staff (dedup by `staff_name`)
- [ ] Non-blocking: cron returns 200 even if push service is down

### Risk

- **MEDIUM**: Role name in `staff_shifts` must match push subscription role format. `staff_shifts.role` is `TEXT` — values like `'staff-kitchen'` must be stored consistently when shifts are created. **Mitigation**: Add role mapping in shift creation (`/api/shifts/clock-in` at `routes/shifts.ts:25`).
- **LOW**: `wrangler.toml` cron addition requires `wrangler deploy` to activate. Test locally with `wrangler dev --test-scheduled`.
- **LOW**: FE_BASE_URL may not be set in worker env. **Mitigation**: Fallback to empty string if undefined.

---

## Step 5: Ensure Staff Role Mapping in Shift Creation

**Effort**: 10 min

### File to Modify

`worker/src/routes/shifts.ts` — ensure role is passed correctly when clocking in.

**Current** `clock-in` handler (line 25-49): receives `staff_id` and `staff_name`. Does NOT receive `role`.

**Action**: The `staff` table (or equivalent) already stores role. The shift creation query already inserts `role` from body. Verify the `clockInSchema` includes `role` field.

```bash
grep -n "clockInSchema" /Users/macbook/FnB-Container-Caffe/worker/src/lib/validators.ts
```

**If `role` is missing from schema**, add it:
```typescript
// In validators.ts — clockInSchema
role: z.string().optional().default('staff'),
```

**If `staff` table lookup exists**, pull role from there:
```typescript
const staffRow = await db.prepare(
  'SELECT role FROM staff WHERE id = ?'
).bind(data.staff_id).first<{ role: string }>();
const staffRole = staffRow?.role || data.role || 'staff';
```

**Note**: This is a **verification step**. If role is already passed through, no code change needed.

### Acceptance Criteria

- [ ] `staff_shifts.role` populated correctly on clock-in
- [ ] Role format matches push subscription role (`staff-kitchen`, `staff-cashier`, `staff-all`)

### Risk

- **LOW**: If staff table doesn't have role column, add it or use a default. Impact limited to shift reminders.

---

## Step 6: Frontend — Staff Notification Settings Integration

**Effort**: 1.5h

### Verification: Current State of `NotificationSettings.tsx`

The page **already exists** at `src/pages/admin/NotificationSettings.tsx` (582 lines). It is already routed at `/admin/notification-settings` in `src/App.tsx:124`.

**What the existing page does:**
- Fetches subscriptions from `/api/push/list-subscriptions` (endpoint doesn't exist yet — see Step 7)
- Allows adding/removing subscriptions with role selection
- Toggles for `autoNotifyNewOrder` and `soundAlerts` (PATCH to `/api/admin/notification-settings`)
- Test send via `/api/push/send-staff`

**What needs to be done:**

#### 6a. Fix API URL in `NotificationSettings.tsx`

**File**: `src/pages/admin/NotificationSettings.tsx` line 88-89

**Current** (broken):
```typescript
const resp = await apiFetch<{ success: boolean; subscriptions?: StaffSubscription[] }>(
  '/api/push/list-subscriptions',  // <-- THIS ENDPOINT DOESN'T EXIST
  { method: 'GET' },
);
```

**No `list-subscriptions` endpoint exists in push.ts.** Add it (see Step 7), OR use the existing `/api/push/send-staff` as a test, OR create the endpoint.

**Recommended fix**: Create `GET /api/push/list-subscriptions` in push.ts (Step 7).

#### 6b. Connect Staff Page — Add Notification Badge/Toggle

**File**: `src/pages/admin/Staff.tsx`

**ADD** a small push notification badge on each staff card (after line 103, inside the staff card):

```tsx
{/* Notification status (G4) */}
<div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
  <Bell size={12} />
  <span>
    {isSubscribed ? 'Thông báo: Bật' : 'Thông báo: Tắt'}
  </span>
</div>
```

This is a **UI-only addition** — the actual subscription happens via `usePushNotifications` hook when staff opens the notification settings page.

#### 6c. Add `usePushNotifications` to Staff Page (optional enhancement)

If staff should opt-in directly from the Staff page, wrap the `usePushNotifications` hook and pass `role: 'staff-kitchen'` or similar based on their actual role.

**Not required for MVP** — staff can use `/admin/notification-settings` directly.

#### 6d. Translation Keys

**File**: `src/locales/translations.json` (or wherever i18n keys live)

**VERIFY** these keys exist (used by `NotificationSettings.tsx` and `notification-banner.tsx`):
```
pushNotify.enableOrderNotif
pushNotify.notifDesc
notificationSettings.testing
```

If missing, add bilingual VN/EN entries.

### Acceptance Criteria

- [ ] `/admin/notification-settings` loads without 404/500
- [ ] Fetching subscriptions works (returns data or empty array, no crash)
- [ ] Add staff form: name + role dropdown visible and functional
- [ ] Test send button triggers push to selected role
- [ ] Staff page shows notification status badge
- [ ] All text bilingual VN/EN

### Risk

- **MEDIUM**: `NotificationSettings.tsx` calls `/api/push/list-subscriptions` which doesn't exist. Will cause fetch failure on page load. **Mitigation**: Step 7 creates this endpoint.
- **LOW**: i18n keys referenced via `t()` — if missing, falls back to key name. Not a crash, but ugly.

---

## Step 7: Add `GET /api/push/list-subscriptions` Endpoint

**Effort**: 15 min

### File to Modify

`worker/src/routes/push.ts`

**ADD** after line 55 (after the `public-key` GET endpoint):

```typescript
// GET /api/push/list-subscriptions — enumerate subscriptions (admin view)
pushRouter.get('/list-subscriptions', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const role = c.req.query('role');

  let query = 'SELECT id, customer_id, endpoint, user_agent, role, created_at FROM push_subscriptions';
  const params: unknown[] = [];

  if (role) {
    query += ' WHERE role = ?';
    params.push(role);
  }

  query += ' ORDER BY created_at DESC LIMIT 100';

  const { results } = await db.prepare(query).bind(...params).all<{
    id: string;
    customer_id: string | null;
    endpoint: string;
    user_agent: string | null;
    role: string;
    created_at: string;
  }>();

  return c.json({
    success: true,
    subscriptions: (results || []).map((r) => ({
      name: r.customer_id || r.endpoint.slice(0, 30),
      role: r.role,
      endpoint: r.endpoint,
      subscribed: true,
      createdAt: r.created_at,
    })),
  });
});
```

### Acceptance Criteria

- [ ] `GET /api/push/list-subscriptions` returns `{ success: true, subscriptions: [...] }`
- [ ] `?role=staff-kitchen` filters correctly
- [ ] `requireAuth(['owner', 'staff'])` works
- [ ] `npm run typecheck` passes

### Risk

- **LOW**: Read-only query, no data mutation.

---

## Step 8: Verify End-to-End Push Flow

**Effort**: 30 min

### Manual Test Sequence

1. **Verify D1 table exists**:
   ```bash
   cd worker && npx wrangler d1 execute fnb-caffe-db --command="SELECT name FROM sqlite_master WHERE type='table' AND name='push_subscriptions'"
   ```

2. **Verify VAPID keys loaded**:
   ```bash
   curl -s http://localhost:8787/api/push/public-key | jq .
   # Should return { success: true, publicKey: "B..." }
   ```

3. **Test subscribe** (from browser console on `localhost:8081`):
   ```javascript
   fetch('/api/push/subscribe', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       endpoint: 'https://test.example.com/fake',
       auth_key: 'test_auth',
       p256dh_key: 'test_p256dh',
       role: 'staff-kitchen',
       customer_id: null,
       user_agent: 'test'
     }),
   }).then(r => r.json())
   ```

4. **Test send-staff**:
   ```bash
   curl -X POST http://localhost:8787/api/push/send-staff \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer <owner-jwt>" \
     -d '{"title":"Test","body":"Hello staff","role":"staff-kitchen"}'
   ```

5. **Test order creation triggers push**:
   ```bash
   curl -X POST http://localhost:8787/api/orders \
     -H "Content-Type: application/json" \
     -d '{"items":[{"name":"Ca phe","price":25000,"quantity":1,"category":"kitchen"}],"total":25000,"payment_method":"cod","customer_name":"Test"}'
   ```
   Check worker logs for: `Staff push sent: { sent: 1, failed: 0 }`

6. **Test notification settings page**: Navigate to `/admin/notification-settings` → verify table loads, add button works.

### Acceptance Criteria

- [ ] All 6 test steps above pass
- [ ] Push notification received on real browser (use `web-push` test or browser dev tools)
- [ ] Order creation → push fires in <2s (async, non-blocking)
- [ ] No console errors in worker or frontend

### Risk

- **MEDIUM**: Using fake `endpoint` in Step 3 won't actually deliver a push (endpoint doesn't exist). Use real push subscription from browser for full E2E test.
- **LOW**: Requires owner JWT for authenticated endpoints. Use `/api/auth/login` to get token first.

---

## Rollback Plan

| Step | Rollback |
|------|----------|
| 1 (Migration) | D1 table `push_subscriptions` is additive. To remove: `DROP TABLE push_subscriptions`. Safe. |
| 2 (Route mount) | Remove `app.route('/api/push', pushRouter)` line. Existing routes unaffected. |
| 3 (Order trigger) | Remove the `import` + `ctx.waitUntil(sendPushToStaff(...))` block. Order flow unchanged. |
| 4 (Cron) | Remove from `scheduled()` and `wrangler.toml` crons. No side effects. |
| 5 (Shift role) | Revert schema change. Shifts still work, just no role targeting. |
| 6 (Frontend) | Revert `NotificationSettings.tsx` changes. Page already existed, revert to original. |
| 7 (List endpoint) | Remove the new GET handler. Other endpoints untouched. |
| 8 (E2E test) | No code changes — just verification. |

**Global rollback**: `git revert <commit-range>` if multiple steps committed together.

---

## File Ownership (Parallel-safe)

| Owner | Files | Notes |
|-------|-------|-------|
| Backend (you) | `worker/migrations/008_*`, `worker/src/routes/push.ts`, `worker/src/routes/shift-reminders.ts`, `worker/src/index.ts`, `worker/src/tree/orders/create-order.ts` | Backend-first sequence (1→2→3→4→5→7) |
| Frontend (you) | `src/pages/admin/NotificationSettings.tsx`, `src/pages/admin/Staff.tsx`, `src/locales/` | Can start after Step 1 (no DB dependency) |
| Shared (serialize) | `worker/wrangler.toml` (Step 4 + VAPID) | Do after Step 4 complete |

---

## Acceptance Criteria (Phase-level)

### Must-pass (blocking)

1. **Table exists**: `push_subscriptions` table in D1, `staff_shifts.clock_in_planned` column present
2. **Routes mounted**: `GET /api/push/public-key`, `POST /api/push/subscribe`, `POST /api/push/send-staff`, `GET /api/push/list-subscriptions` all return 200/201
3. **Order trigger**: Creating an order with `category: "kitchen"` items fires `sendPushToStaff(..., 'staff-kitchen')` (verify via worker logs)
4. **VAPID configured**: `web-push` initializes without silent-fail path
5. **NotificationSettings page loads**: No fetch errors, subscription table renders

### Should-pass (non-blocking, P2)

6. **Shift reminder sends**: Cron finds 1+ staff with upcoming shifts and sends push with clock-in time
7. **Staff page badge**: Shows notification status per staff card
8. **i18n**: All push-related text bilingual VN/EN

### Nice-to-have (skip if time-constrained)

9. Sound alert toggle functional
10. `autoNotifyNewOrder` setting stored persistently

---

## Unresolved Questions

1. **Staff role format**: `staff_shifts.role` is free text. Is there a role enum (e.g., `kitchen`, `cashier`, `waiter`)? Need to verify against actual shift data before our `staff-{role}` join works.
2. **Owner JWT for push endpoints**: `send-staff` requires owner auth. Are staff devices (kitchen tablets) using owner accounts or a shared staff token? If tablets use `staff` role, `requireAuth(['owner'])` will block them.
3. **Push subscription TTL**: `web-push` subscriptions expire. Do we need a cleanup job, or rely on 410 Gone handling (already implemented in `notifier.ts:86-89`)?
4. **iOS Safari**: `Notification.requestPermission()` requires user gesture. Our `usePushNotifications` hook requests it on click (good), but if staff use PWA home screen on iOS, lifecycle differs. Test needed.

---

## Test Matrix

| Layer | What | Command |
|-------|-------|---------|
| Unit | `notifier.ts` 410 cleanup | `npx vitest run worker/src/tree/push/` |
| Unit | `push.ts` route handlers | `npx vitest run worker/src/routes/push.test.ts` |
| Integration | D1 migration apply | `wrangler d1 execute fnb-caffe-db --file=migrations/008_*` |
| Integration | Order → push trigger | Create order via `curl`, check worker logs |
| E2E | Browser push subscribe + receive | Manual: open app, enable notifications, create test order |
| Build | `tsc --noEmit` | `cd worker && npx tsc --noEmit` |
| Build | Frontend build | `npm run build` (root) |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| VAPID keys missing | HIGH | CRITICAL | Prerequisite step + verification in Step 8 |
| `push_subscriptions` table missing | HIGH | CRITICAL | Step 1 migration |
| Staff role mismatch | MEDIUM | HIGH | Verify in Step 5; fallback to `staff-all` |
| Owner-only auth blocks staff tablets | MEDIUM | MEDIUM | Q1 above — may need to relax to `['owner', 'staff']` |
| iOS Safari permission | LOW | MEDIUM | User gesture pattern already in hook |
| Push quota (web-push free tier) | LOW | LOW | web-push VAPID has no quota; only browser push services limit |
| Double-send on shift reminder | LOW | LOW | Dedup by `staff_name` in Step 4 |
