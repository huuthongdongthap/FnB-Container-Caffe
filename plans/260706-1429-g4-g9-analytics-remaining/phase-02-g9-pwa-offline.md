---
phase: 2
gap: G9
title: G9 PWA Full Offline Mode Execution
status: pending
effort: 4h
priority: P2
depends_on: [G3]
---

# Phase 2: G9 PWA Full Offline Mode Execution (4h, P2)

Build on existing infrastructure (sw.js, offline-db, offline-banner, use-online-status, order store queue) to close the five remaining gaps: global SW registration, SW update prompt, menu store + categories persistence, order queue UI indicator, and i18n key completeness.

## Existing Code (DO NOT re-write)

| Feature | File | Status |
|---------|------|--------|
| IndexedDB wrapper (orders + menu items) | `src/lib/offline-db.ts:27-101` | ✅ |
| Offline detection hook | `src/hooks/use-online-status.ts:11-37` | ✅ |
| Offline top banner | `src/components/pwa/offline-banner.tsx:16-51` | ✅ |
| Menu page offline hydration | `src/pages/menu.tsx:59-96` | ✅ |
| Order store offline queue | `src/hooks/stores/use-order-store.ts:84-97,224-265` | ✅ |
| Checkout offline flush | `src/pages/checkout.tsx:27` (`useOrderStoreWithOfflineFlush`) | ✅ |
| App wiring (banner in AppBanner) | `src/App.tsx:68-71` | ✅ |
| Service worker (all strategies) | `public/sw.js` | ✅ |
| manifest.json | `public/manifest.json` | ✅ |

## Five Remaining Gaps

1. **No global SW registration** — SW only registered inside `usePushNotifications.subscribe()` at `src/hooks/use-push-notifications.ts:68`. If user never subscribes to push, SW never activates as controller.

2. **No SW update prompt** — `public/sw.js:48-52` handles `SKIP_WAITING` message, but no client listens for `controllerchange` to prompt reload.

3. **Menu store no offline hydration** — `useMenuStore.fetchMenu()` at `src/hooks/stores/use-menu-store.ts:79-97` always hits `/api/menu` even when offline. The page component (`src/pages/menu.tsx:63-77`) hydrates from IndexedDB, but this is page-scoped, not store-scoped. Any component reading `useMenuStore` during offline will see empty state.

4. **No order queue UI indicator** — `queuedOffline: true` is internal-only. No visible UI tells the user their order is queued for sync.

5. **Incomplete i18n keys** — `pwa.offlineBanner` and `pwa.offlineBannerSub` exist (`src/locales/vi.json:1773-1774`, `src/locales/en.json:1782-1783`), but no keys for sync status or queue count.

---

## Phase 1: Extend IndexedDB Schema (30 min)

### Files

| Action | File |
|--------|------|
| MODIFY | `src/lib/offline-db.ts` |

### IndexedDB Schema Design

**Database:** `auradb`, version 1, store: `offlineOrders`, keyPath: `localId`.

Current objects stored under key `'menu'` for items. Add new fixed key `'_meta_categories'` for categories. Each record schema:

```
Record (keyPath: 'localId'):

Order record:
  localId: string          // e.g. "local_M0abc1234"
  orderData: object        // serialized CreateOrderPayload
  createdAt: number        // Date.now() — added NEW
  synced: boolean          // added NEW (supercedes getPendingOrders getAll scan)

Menu items record (existing, key='menu'):
  localId: "menu"
  orderData: MenuItem[]    // serialized items array

Menu categories record (NEW, key='_meta_categories'):
  localId: "_meta_categories"
  orderData: {             // plain JSON object, NOT array
    items: MenuCategory[]  // extracted categories with labels
    cachedAt: number       // Date.now() when saved
  }
```

**Why separate record for categories:** Storing categories separately avoids a full array rescan to derive them. Store size is negligible (10-20 category objects vs potentially 100+ menu items).

**Why add `createdAt` + `synced` to orders:** Current `getPendingOrders()` returns all records and the caller filters. Adding `synced` makes partial sync possible (remove only synced orders by localId). `createdAt` enables age-based TTL cleanup.

### Implementation Steps

1. Add `createdAt` field to `saveOrder()` — timestamp on write:

`src/lib/offline-db.ts:35-44` → Insert `createdAt: Date.now()` into the record object:

```typescript
await tx.objectStore(STORE_NAME).add({
  localId,
  orderData,
  createdAt: Date.now(),
  synced: false,
});
```

2. Add `synced` field to the upgrade schema. Currently version 1 has no `synced` index. Bump to version 2 in `openDB()`:

`src/lib/offline-db.ts:12` → Change `indexedDB.open(DB_NAME, 1)` to `indexedDB.open(DB_NAME, 2)`.

In `request.onupgradeneeded`, add:
```typescript
if (!db.objectStoreNames.contains(STORE_NAME)) {
  db.createObjectStore(STORE_NAME, { keyPath: 'localId' });
}
if (!db.objectStoreNames.contains('syncIndex')) {
  const idx = db.createObjectStore('syncIndex', { keyPath: 'localId' });
  idx.createIndex('synced', 'synced', { unique: false });
}
```

3. Add `saveMenuCategories(categories)` method:

```typescript
async saveMenuCategories(categories: object): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({
      localId: '_meta_categories',
      orderData: { items: categories, cachedAt: Date.now() },
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

4. Add `getMenuCategories()` method mirroring `getMenuItems()`:

```typescript
async getMenuCategories(): Promise<{ items: unknown[]; cachedAt: number } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get('_meta_categories');
    req.onsuccess = () => resolve(req.result?.orderData ?? null);
    req.onerror = () => reject(req.error);
  });
}
```

5. Add `markSynced(localId)` method for partial sync removal:

```typescript
async markSynced(localId: string): Promise<void> {
  const db = await openDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(localId);
    req.onsuccess = () => {
      const record = req.result;
      if (record) {
        record.synced = true;
        store.put(record);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

6. Update `getPendingOrders()` to still return all orders (caller checks `synced` field). No filter change needed yet — the `syncIndex` store is prepped for future optimization.

### Verification

- Run `npx vitest run src/lib/__tests__/` — if an offline-db test exists, update it; if none, add one covering save/retrieve order with `createdAt` + `synced`.
- Manually verify: open DevTools > Application > IndexedDB > auradb > offlineOrders, confirm version is 2 after reload.

---

## Phase 2: Wire Menu Store to Offline Cache (45 min)

### Files

| Action | File |
|--------|------|
| MODIFY | `src/hooks/stores/use-menu-store.ts` |
| MODIFY | `src/pages/menu.tsx` |
| MODIFY | `src/locales/vi.json` |
| MODIFY | `src/locales/en.json` |

### Data Flow

```
navigator.onLine = false
  → menu.tsx useEffect[fetchMenu] (src/pages/menu.tsx:63)
    → offlineDb.getMenuItems() → getMenuCategories()
      → useMenuStore.setState({ items, categories })  ← store hydration
        → StitchMenuNew renders cached data
  
navigator.onLine = true
  → fetchMenu() → API
    → useMenuStore.setState({ items, categories })
    → menu.tsx:83-88 → offlineDb.saveMenuItems() + saveMenuCategories()
```

### Step 2-a: Add offline hydration to useMenuStore

`src/hooks/stores/use-menu-store.ts:79-97` — modify `fetchMenu`:

```typescript
fetchMenu: async () => {
  set({ loading: true, error: null });

  // Offline path: hydrate from IndexedDB before attempting network
  if (!navigator.onLine) {
    try {
      const [cachedItems, cachedCats] = await Promise.all([
        offlineDb.getMenuItems(),
        offlineDb.getMenuCategories(),
      ]);
      if (cachedItems.length > 0) {
        const items = cachedItems as MenuItem[];
        const cats = cachedCats?.items
          ? (cachedCats.items as { id: string; name: string }[])
          : extractCategories(items);
        set({
          items,
          categories: cats,
          loading: false,
          error: null,
          searchResults: null,
        });
        return; // do not attempt network
      }
    } catch {
      // cache miss — fall through to API attempt (will fail, show error)
    }
  }

  // Online: normal fetch
  try {
    const res = await fetch(`${API_BASE}/api/menu?available=true`);
    const body = await res.json();
    if (!res.ok) {
      set({ loading: false, error: body.message || `Error loading menu (${res.status})` });
      return;
    }
    const items: MenuItem[] = body.items ?? [];
    const categories = extractCategories(items);
    set({ items, categories, loading: false, error: null, searchResults: null });

    // Persist to IndexedDB for next offline visit
    try {
      await offlineDb.saveMenuItems(items as unknown[]);
      await offlineDb.saveMenuCategories(categories);
    } catch {
      // non-fatal
    }
  } catch {
    set({ loading: false, error: 'Connection error' });
  }
},
```

Import `offlineDb` at top of file:
```typescript
import { offlineDb } from '@/lib/offline-db';
```

### Step 2-b: Deduplicate — remove redundant cache write in menu.tsx

`src/pages/menu.tsx:82-88` — remove the try/catch `saveMenuItems` block (store already persists). The `extractCategories` helper at line 170-179 is also no longer needed in the page; keep it for safety since `StitchMenuNew` receives pre-computed `stitchItems`.

### Step 2-c: Add i18n keys

`src/locales/vi.json` — add under `"pwa"` object (currently ends at line 1775):

```json
"syncRetrying": "Đang thử đồng bộ lại...",
"syncFailed": "Không thể đồng bộ đơn hàng",
"syncComplete": "Đồng bộ thành công",
"orderQueueCount": "{{count}} đơn đang chờ đồng bộ",
"swUpdateAvailable": "Có bản cập nhật mới",
"swUpdateReload": "Tải lại ngay",
"swUpdateLater": "Để sau",
"categoriesCachedAt": "Đã cache menu lúc {{time}}"
```

`src/locales/en.json` — add:

```json
"syncRetrying": "Retrying sync...",
"syncFailed": "Could not sync order",
"syncComplete": "Sync complete",
"orderQueueCount": "{{count}} order(s) pending sync",
"swUpdateAvailable": "Update available",
"swUpdateReload": "Reload now",
"swUpdateLater": "Later",
"categoriesCachedAt": "Menu cached at {{time}}"
```

### Verification

- Online: visit `/menu`, verify menu renders. Check IndexedDB has `menu` + `_meta_categories` records.
- Offline: DevTools > Network tab > set throttling to "Offline", navigate to `/menu`. Menu should render from cache within 1s, no network errors.
- Store: `useMenuStore.getState().items` should have 10+ items after online visit.

---

## Phase 3: Build Order Queue UI Component (1h)

### Files

| Action | File |
|--------|------|
| CREATE | `src/components/pwa/OrderQueueIndicator.tsx` |
| MODIFY | `src/App.tsx` |

### Component Specification

`OrderQueueIndicator` — sticky bottom bar visible when `queuedOffline = true`, dismissable per session.

Props: none (reads from `useOrderStore` directly).

State:
- `dismissed: boolean` — local to session, prevents re-show after manual dismiss
- `syncing: boolean` — true while `flushQueuedOrders()` is running

Behavior:
1. Reads `useOrderStore` for `queuedOffline` and `error`.
2. If `queuedOffline && !dismissed`: render sticky bottom bar.
3. On mount, auto-trigger `flushQueuedOrders()` after 2s delay (debounce to avoid flash).
4. Show "Đang đồng bộ..." (translating) while syncing, then auto-dismiss on success.
5. On failure: show error + "Thử lại" retry button + dismiss.
6. On manual dismiss: set `dismissed = true`, do NOT cancel in-flight sync.

### Visual Design

Matches offline-banner brand tokens (`offline-banner.tsx:24-27`). Same gradient background, left-aligned icon + text, right-aligned dismiss.

```tsx
<div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t px-4 py-3"
     style={{ background: 'linear-gradient(to top, #1A2D1F, #0A1A2E)',
              borderColor: 'rgba(201,214,223,0.18)' }}>
  <div className="flex items-center gap-2">
    {syncing
      ? <Spinner className="h-4 w-4 animate-spin text-[#6B9FB8]" />
      : <AlertTriangle className="h-4 w-4 text-[#D4A76A]" />
    }
    <span className="text-sm text-[#C9D6DF]">
      {syncing ? t('pwa.syncRetrying')
        : error ? t('pwa.syncFailed')
        : t('pwa.orderQueueCount', { count: pendingCount })}
    </span>
  </div>
  {!syncing && (
    <div className="flex gap-2">
      <button onClick={retry} className="text-xs text-[#CD7F32] hover:underline">
        {t('pwa.syncComplete', 'Retry')}
      </button>
      <button onClick={dismiss} className="text-[#5A6270] hover:text-[#C9D6DF]">
        <X className="h-4 w-4" />
      </button>
    </div>
  )}
</div>
```

### Integration into App.tsx

`src/App.tsx` — add import and render OrderQueueIndicator inside `AppContent` alongside `AppBanner`:

```typescript
import OrderQueueIndicator from '@/components/pwa/OrderQueueIndicator';
```

Inside `AppContent` return (line 75-76):

```tsx
<AuthProvider>
  <AppBanner />
  <OrderQueueIndicator />
  <StitchAppLayout>
```

Placement before `StitchAppLayout` ensures it sits above the footer and below the banner.

### i18n Translations Required (from Phase 2 keys)

The component uses these keys from `pwa.*` namespace. No extra namespace needed.

### Verification

1. Go offline, place order on `/checkout` → `queuedOffline` becomes true → indicator appears at bottom with "1 đơn đang chờ đồng bộ".
2. Go online → after 2s delay, indicator shows spinner → "Đồng bộ thành công" → auto-dismiss within 5s.
3. Dismiss manually → indicator hides immediately, does not re-appear on next render.
4. Simulate sync failure (block `/api/orders` in DevTools) → indicator shows "Không thể đồng bộ đơn hàng" + Retry button.
5. Both states coexist: top `OfflineBanner` + bottom `OrderQueueIndicator` should not overlap (banner dismissed separately).

---

## Phase 4: Global SW Registration + Update Prompt (1.5h)

### Files

| Action | File |
|--------|------|
| MODIFY | `src/main.tsx` |
| CREATE | `src/hooks/use-sw-registration.ts` |
| MODIFY | `src/hooks/use-push-notifications.ts` |

### Step 4-a: Create `use-sw-registration.ts`

`src/hooks/use-sw-registration.ts` — single responsibility hook:

- Registers SW at `/sw.js` on mount (idempotent — browser dedupes same URL).
- Listens for `controllerchange` on `navigator.serviceWorker`.
- Renders portal toast "Có bản cập nhật mới" with Reload / Later buttons.
- Exposes `isUpdateAvailable`, `skipWaiting()` (sends `SKIP_WAITING` message to SW).

```typescript
import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

export function useSWRegistration() {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const { t } = useTranslation('pwa');

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then((reg) => {
      setRegistration(reg);
    }).catch(() => {}); // non-fatal

    const handler = () => setIsUpdateAvailable(true);
    navigator.serviceWorker.addEventListener('controllerchange', handler);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', handler);
  }, []);

  const skipWaiting = useCallback(() => {
    if (registration?.active) {
      registration.active.postMessage({ type: 'SKIP_WAITING' });
    }
  }, [registration]);

  return { isUpdateAvailable, skipWaiting, registration };
}
```

### Step 4-b: SW Update Prompt Component

`src/components/pwa/SWUpdatePrompt.tsx` — renders when `isUpdateAvailable`:

- Fixed banner at top (below offline banner if both visible).
- Text: "Có bản cập nhật mới" / "Update available"
- Buttons: "Tải lại ngay" (calls `skipWaiting()`) + "Để sau" (dismisses).
- After `skipWaiting()`, new SW takes control → `controllerchange` fires → reload on new controller.

### Step 4-c: Wire into main.tsx

`src/main.tsx` — add registration:

```typescript
import { useSWRegistration } from './hooks/use-sw-registration';
import SWUpdatePrompt from './components/pwa/SWUpdatePrompt';

// Inside createRoot().render() or as a mount-side effect:
function SWInit() {
  useSWRegistration();
  return <SWUpdatePrompt />;
}
```

Since `main.tsx` renders `<App />` outside of Router, wrap SW init in a `<div>`:

```tsx
createRoot(root).render(
  <StrictMode>
    <HelmetProvider>
      <SWInit />
      <App />
    </HelmetProvider>
  </StrictMode>,
);
```

### Step 4-d: Deduplicate push SW registration

`src/hooks/use-push-notifications.ts:68` — registration inside `subscribe()` is fine, but add a check to avoid double register (harmless but noisy in console):

```typescript
if (!navigator.serviceWorker.controller) {
  await navigator.serviceWorker.register('/sw.js');
}
await navigator.serviceWorker.ready;
```

---

## Phase 5: Tests + Verification (45 min)

### Unit Tests to Write/Update

| Test File | What |
|-----------|------|
| `src/hooks/__tests__/use-online-status.test.ts` (new) | Verify `isOnline` mirrors `navigator.onLine`, `wasOffline` flips on reconnect event. Mock `window.addEventListener`. |
| `src/lib/__tests__/offline-db.test.ts` (new) | Verify `saveOrder` stores record with `createdAt` and `synced: false`. Verify `markSynced` sets `synced: true`. Verify `saveMenuCategories` / `getMenuCategories` round-trip. |
| `src/hooks/stores/__tests__/use-menu-store.test.ts` (new) | Verify `fetchMenu` stores `items` + `categories` after fetch; verify offline path hydrates from IndexedDB. Mock `navigator.onLine = false`. |

### Integration Tests

Run existing test suite:

```bash
cd /Users/macbook/FnB-Container-Caffe/apps/sophia-ai-factory && npm test
```

All 844+ tests must pass. If any fail due to IndexedDB changes, fix the test or the code — never weaken the test.

### End-to-End Verification Script

```bash
# 1. Build
npm run build   # 0 TypeScript errors

# 2. Dev server, then manually:
# - Open /menu online → verify menu loads
# - DevTools > Application > IndexedDB > auradb > offlineOrders
#   → should have 'menu' record + '_meta_categories' record
# - DevTools > Network > Offline → reload /menu → menu still renders
# - Navigate to /checkout, place order while offline → 
#   OfflineBanner at top, OrderQueueIndicator at bottom
# - Go back online → queue auto-flushes after 2s → indicator dismisses
# - SW → check "Service Worker" tab → registration active
# - Trigger SW update: modify sw.js, increment CACHE_VERSION → 
#   SWUpdatePrompt appears
```

### Pass Criteria

- [ ] `npm run build` exit 0
- [ ] `npm test` exit 0 (844+ tests green)
- [ ] `tsc --noEmit` exit 0
- [ ] `npm run lint` exit 0
- [ ] Online: menu loads, categories stored in IndexedDB
- [ ] Offline: menu renders from cache within 1s, no uncaught errors
- [ ] Offline: order placed → `queuedOffline = true` → indicator visible
- [ ] Reconnect: `flushQueuedOrders` runs → indicator auto-dismisses
- [ ] SW registered on page load (not only on push subscribe)
- [ ] SW update prompt renders on `controllerchange`
- [ ] Zero `:any` types in modified files
- [ ] Zero `console.log` in production code
- [ ] All i18n keys in both `vi.json` and `en.json`

---

## Rollback Plan

| Risk | Mitigation |
|------|-----------|
| IndexedDB schema change breaks existing orders | Version bump from 1→2 handles `onupgradeneeded` gracefully. Old records preserved, SW clears stale caches in `activate` event. |
| Global SW registration conflicts with push hook | Both call `register('/sw.js')` — browser deduplicates. The guard in `use-push-notifications.ts` prevents double-call noise. |
| Offline hydration causes stale menu display | `cachedAt` timestamp enables future staleness TTL. For now, user can pull-to-refresh (navigator.onLine becomes true → fetchMenu re-runs). |
| Order queue indicator overlapping with offline banner | Both are `sticky/fixed` — offline banner at `top-0`, queue indicator at `bottom-0`. Test both active simultaneously. |
| `flushQueuedOrders` double-submit | Existing double-submit guard in `checkout.tsx:71` is on the submit action, not the flush. Protect flush with a `flushing` flag in store if needed. |

## File Ownership (No Conflicts with G4/Analytics)

| Phase | Owner Files | No touch |
|-------|------------|----------|
| Phase 1 | `src/lib/offline-db.ts` | — |
| Phase 2 | `src/hooks/stores/use-menu-store.ts`, `src/pages/menu.tsx`, `src/locales/*.json` | — |
| Phase 3 | `src/components/pwa/OrderQueueIndicator.tsx`, `src/App.tsx` | G4 touches `src/pages/` admin only |
| Phase 4 | `src/main.tsx`, `src/hooks/use-sw-registration.ts`, `src/components/pwa/SWUpdatePrompt.tsx` | — |
| Phase 5 | New test files only | — |

G4 touches admin pages and worker; Analytics touches new page routes. No overlap.

## Out of Scope

- Background sync for admin mutations (only customer orders queue — YAGNI)
- IndexedDB for cart state (Zustand sufficient for session)
- SwRefreshWorker / Workbox migration (manual SW is simpler, already works)
- Admin-side offline mode (staff workstations are always online per No-Tech doctrine)
