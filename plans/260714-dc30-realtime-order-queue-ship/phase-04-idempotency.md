--- phase: 4
title: "Idempotency — Duplicate POST Prevention"
status: completed
priority: P1
effort: "0.25d"
dependencies: [0, 1, 2, 3]
---

# Phase 4: Idempotency — Duplicate POST Prevention

## Overview
Bonus phase (beyond original 4-phase plan). Prevents duplicate order creation via `Idempotency-Key` header + KV caching with 24h TTL.

## Files
- **Modified:** `src/tree/orders/create-order.ts`
- **Modified:** `src/__tests__/test-utils.ts`
- **Created:** `src/__tests__/tree/orders/create-order.test.ts` (5 new idempotency tests)

## Implementation
1. Check `Idempotency-Key` header on `POST /api/orders` → KV lookup
2. Cache hit → return 200 with cached body (no DB write)
3. Cache miss → create order, cache response body with `expirationTtl: 86400`
4. Missing `AUTH_KV` binding → bypass idempotency (graceful degradation)

## Test Results
- 18/18 tests pass (13 existing + 5 new)
- Regression gate: 0 new failures introduced
- Pre-existing 1 failure in `orders.test.ts` confirmed via `git stash`

## Errors Fixed During Implementation
- fake-indexeddb `TransactionInactiveError`: replaced `getPendingCountSync()` with `getPendingCount()` (fresh tx per call)
- `_resetForTests()` not clearing data: dynamically import fake-indexeddb, replace IDBFactory
- `createMockKV.get()` missing `'json'` type support: added type parameter
- `createOrder` response body duplication: extracted to `idemBody` constant
- Node.js `Response()` rejects status 101: use 200 in test mocks
