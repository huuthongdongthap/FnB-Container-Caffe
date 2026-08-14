---
phase: 2
title: "Client Offline Hardening"
status: pending
priority: P1
effort: "0.5d"
dependencies: [1]
---

# Phase 2: Client Offline Hardening

## Overview
Add client-side IndexedDB offline queue with Background Sync API fallback. CORS decision: **no change needed** — the Hono regex gate in `index.ts:110-116` already enforces CORS correctly; `wrangler.toml` `CORS_ORIGIN` is a cosmetic/dead config.

**TDD order:** Write tests with IndexedDB mock → implement offline-queue → verify.

## Requirements
- Functional: Orders submitted offline are queued in IndexedDB, synced on reconnect
- Non-functional: ≤5ms local queue fill, Background Sync fires within 30s of reconnect

## Architecture
```
Client submits order
  ├─ Online → POST /api/orders → DO broadcast → success
  └─ Offline → IndexedDB.put() → Background Sync.register()
                                          ↓ WiFi restored
                                    sync event → POST /api/orders (with idempotency key)
```

## Related Code Files
- Create: `worker/src/lib/offline-queue.ts`
- Create: `worker/src/__tests__/lib/offline-queue.test.ts`
- Modify: `worker/src/routes/cal-booking-webhook.ts` — **MOVED to Phase 3** (crypto.subtle.verify requires careful implementation; bundling it here risks shipping untested HMAC)

**Out of scope for this phase:**
- Cal.com HMAC verification (Phase 2.5 / Phase 3)
- CORS changes (no change needed — see CORS Decision in plan.md §7)

## Implementation Steps (TDD-first)

### Step 1: Write offline-queue tests FIRST
Create `offline-queue.test.ts` covering: 1. **IndexedDB setup** — opens database, creates `pending_orders` object store with `orderId` key
2. **enqueue(order)** — stores order in IndexedDB, returns queue length
3. **dequeue()** — retrieves and removes oldest pending order
4. **getPendingCount()** — returns number of pending orders
5. **clear()** — empties queue after successful sync
6. **Background Sync registration** — registers `sync-orders` tag, verifies `sync` event fires 7. **Double-submit prevention** — test that re-syncing the same orderId doesn't create duplicate (idempotency key check)
8. **Quota exceeded** — test graceful degradation when IndexedDB is full

**Mock strategy:** Use a fake IndexedDB implementation (e.g., `fake-indexeddb` npm package, or hand-rolled Map-based mock). Since this is a Worker-compatible library, the mock must simulate the same API.

### Step 2: Implement offline-queue.ts
```typescript
// worker/src/lib/offline-queue.ts
const DB_NAME = 'aura-offline-queue';
const STORE_NAME = 'pending_orders';

export interface QueuedOrder {
  orderId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  createdAt: number;
}

export async function enqueueOrder(order: QueuedOrder): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.store.put(order);
  await tx.done;
  return getPendingCount();
}

export async function dequeueOrders(): Promise<QueuedOrder[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const all = await tx.store.getAll();
  await tx.store.clear();
  await tx.done;
  return all;
}

export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const count = await tx.store.count();
  await tx.done;
  return count;
}

export function registerBackgroundSync(): void {
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(reg => {
      reg.sync.register('sync-pending-orders');
    }).catch(() => {
      // Background Sync not available — client will retry on next app open
    });
  }
}
```

**Note:** `openDB()` uses `idb-keyval` or raw `indexedDB.open()`. Choose the approach that matches the project's existing dependencies.

### Step 3: Test double-submit on reconnect
Write a test that simulates: 1. enqueue order A with idempotency key `key-1` 2. enqueue order A AGAIN with same idempotency key (retry scenario) 3. dequeue() → assert only ONE entry returned 4. The dedup is by `idempotencyKey`, not `orderId`

### Step 4: Verify Phase 1 tests still pass
After implementing, run: `npx vitest run worker/src/__tests__/do/` → all green

## Success Criteria
- [ ] `offline-queue.test.ts` covers: enqueue, dequeue, count, clear, Background Sync reg, double-submit, quota exceeded — ALL GREEN
- [ ] `offline-queue.ts` implements: enqueue, dequeue, getPendingCount, registerBackgroundSync
- [ ] Double-submit dedup works (by idempotencyKey)
- [ ] Phase 1 tests still pass (DO + create-order regression)
- [ ] Phase 0 snapshot test still passes
- [ ] All 53+ existing tests pass

## Risk Assessment
- **Browser support** — Background Sync only Chromium/Firefox; Safari fallback: retry on app open (tested via feature detect)
- **IndexedDB quota** — typically 50-80% of disk space; tested via quota-exceeded mock
- **Service Worker availability** — PWA shell must register SW; fallback to manual retry
