# Dev Audit — Main Pages Logic Errors

**Date:** 2026-08-19 | **Scope:** Frontend + Backend logic | **Status:** ✅ 22 findings

---

## Summary

| Source | CRITICAL | HIGH | MEDIUM |
|--------|----------|------|--------|
| Frontend | 2 | 4 | 3 |
| Backend | 2 | 8 | 0 |
| **Total** | **4** | **12** | **3** |

---

## CRITICAL (4)

| ID | File | Issue | Impact |
|----|------|-------|--------|
| L001 | `src/lib/offline-db.ts:141` | `offlineDb.clear()` wipes entire IndexedDB including menu cache | After offline→online sync, menu disappears |
| L002 | `src/pages/menu.tsx:88` | Stale closure: writes pre-fetch menuItems to cache | Offline cache always gets old/empty data |
| B001 | `worker/src/routes/erpnext-pos.ts` | No auth middleware on `/api/erpnext-pos/*` and `/api/erpnext-invoices/*` | Unauthenticated ERPNext access |
| B002 | `worker/src/index.ts:360` | `checkCronSecret` returns `true` when CRON_SECRET missing | Cron endpoints fully public |

---

## HIGH (12)

| ID | File | Issue | Fix |
|----|------|-------|-----|
| L003 | `payment-method-selector.tsx:69` | Icon prop renders raw string instead of PAYMENT_ICONS component | Resolve `PAYMENT_ICONS[option.icon]` |
| L004 | `src/pages/checkout.tsx:178` | PayOS race: order created but payment link fails → phantom order | Navigate to pending-retry state |
| L005 | `ChatWidget-hooks.ts:54` | Unread count double-counts, resets on remount | Track last-seen message id |
| L006 | `use-order-store.ts:66` | SSE handler unconditionally drops server-sent items | Use `incoming.items \|\| current.items` |
| L007 | `src/pages/menu.tsx:83` | Offline + no cache → infinite loading, no error state | Set `initDone(true)` in finally block |
| B003 | `create-order.ts:21` | Idempotency key check-then-act race → duplicate orders | Write sentinel before check |
| B004 | `worker/src/routes/webhooks.ts:28` | HMAC comparison not constant-time (timing attack) | Byte-by-byte comparison |
| B005 | `worker/src/routes/reservations.ts:80` | Double-booking race — no DB uniqueness constraint | UNIQUE partial index |
| B006 | `create-order.ts:101` | Client-supplied total trusted, no server-side calc | Recalculate from items |
| B008 | `worker/src/middleware/tenant.ts:17` | Tenant isolation bypass via X-Tenant-Id header | Verify header matches JWT tenantId |
| B010 | `worker/src/middleware/error-handler.ts:62` | Internal error messages leaked in API responses | Return generic message |
| B011 | `worker/src/tree/orders/helpers.ts:7` | Weak order ID (Math.random, 36^5 keyspace) | Use crypto.getRandomValues |

---

## MEDIUM (3)

| ID | File | Issue |
|----|------|-------|
| L008 | `use-mobile-auth.tsx:73` | Auto-refresh updates token but not user object (stale role) |
| L009 | `src/pages/order-success.tsx:118` | `useCartStore.getState()` at render time, not inside callback |
| L010 | `order-store-utils.ts:11` | `firstOrDefault` converts missing numbers to 0, overwriting current values |

---

## Files Changed

| # | File | Fixes |
|---|------|-------|
| 1 | `src/lib/offline-db.ts` | L001 — add `clearOrders()` method |
| 2 | `src/pages/menu.tsx` | L002, L007 — stale cache + infinite loading |
| 3 | `src/components/order/payment-method-selector.tsx` | L003 — icon rendering |
| 4 | `src/components/chat/ChatWidget-hooks.ts` | L005 — unread dedup |
| 5 | `src/hooks/stores/use-order-store.ts` | L001 (clearOrders), L006 — SSE items merge |
| 6 | `worker/src/routes/webhooks.ts` | B004 — constant-time HMAC |
| 7 | `worker/src/index.ts` | B002 — cron secret fail-closed |
| 8 | `worker/src/middleware/error-handler.ts` | B010 — generic error messages |
| 9 | `worker/src/tree/orders/helpers.ts` | B011 — CSPRNG order IDs |

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx vite build --mode production` | ✅ Built in 3.01s |

---

## Deferred (not fixed this round)

| ID | Reason |
|----|--------|
| L004 | PayOS race → phantom order — requires order lifecycle redesign |
| L008 | Mobile auth stale user — requires backend refresh endpoint change |
| L009 | Store getState at render — low probability, Zustand is sync |
| L010 | SSE firstOrDefault → 0 — needs broader SSE contract review |
| B001 | ERPNext POS auth — need to verify if intentionally public |
| B003 | Idempotency race — needs KV write-then-read or D1 constraint |
| B005 | Reservation double-booking — needs DB migration for UNIQUE index |
| B006 | Client-trusted total — needs server-side recalc + tolerance check |
| B007 | Mobile staff login — needs device token verification audit |
| B008 | Tenant isolation — needs JWT vs header reconciliation |
| B009 | Anonymous reservations — needs rate limit + auth decision |
| B012 | Order creation rate limit — needs global daily cap |

---

## Unresolved Questions

1. Does SSE `update_order` event include items array? If not, L006 merge is intentional but misleading.
2. Is separate offline orders store planned? Current shared IndexedDB mixing orders + menu is fragile.
3. Are ERPNext POS routes intentionally public (external webhook integration)?

---

*Report generated: 2026-08-19 23:55 ICT*
