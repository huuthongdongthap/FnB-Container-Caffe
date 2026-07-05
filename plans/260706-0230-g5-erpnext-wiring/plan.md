# G5: ERPNext Sync Wiring
**Status:** pending
**Created:** 2026-07-06 02:30
**Estimate:** 5h tuần tự A→B→C

## Problem
ERPNext integration đã có ~80% code nhưng có 3 vấn đề thực tế:
- **A:** `orders-hono.ts` có sync code inline duplicate (không dùng `syncOrderToERPNext` import) + bug syntax trong `sync.js`
- **B:** Cron stubs (`processErpnextRetryQueue`, `processErpnextProductSync`) chỉ log rồi skip — chưa retry failed syncs hay product delta sync
- **C:** `tree/orders/create-order.ts` (customer checkout) thiếu ERPNext hook — chỉ KDS/POS checkout có

## Phases
| # | Phase | Estimate | Deps |
|---|-------|----------|------|
| 1 | Dedup sync + fix bug | 1h | none |
| 2 | Implement cron stubs | 2h | 1 |
| 3 | ERPNext hook in checkout | 2h | none (independent) |

## Acceptance Criteria
- [ ] `npm run build` 0 errors trong worker/src
- [ ] Xóa inline ERPNext code trong `orders-hono.ts`, dùng `syncOrderToERPNext()` import
- [ ] Fix syntax bug trong `tree/erpnext/sync.js`
- [ ] Cron retry queue đọc `erpnext_sync_log` từ D1, retry failed entries
- [ ] Cron product sync gọi `erpnext-product-client.ts` delta sync
- [ ] `tree/orders/create-order.ts` gọi ERPNext sync background khi `ERPNEXT_SYNC_ENABLED=true`
- [ ] Tests pass (--tdd: tests written before each phase)
- [ ] Không break order creation flow NỮA khi ERPNext fail (fire-and-forget pattern preserved)

## Files to Modify
| Phase | File | Action |
|-------|------|--------|
| 1 | `worker/src/routes/orders-hono.ts` | Replace inline fetch (l.164-199) with `syncOrderToERPNext()` call |
| 1 | `worker/src/tree/erpnext/sync.js` | Remove extra `)` after fetch options (l.59) |
| 2 | `worker/src/routes/cron.ts` | Wire real implementations for `processErpnextRetryQueue` + `processErpnextProductSync` |
| 2 | `worker/src/index.ts` | Register cron routes in ScheduledController if not already |
| 3 | `worker/src/tree/orders/create-order.ts` | Add `ctx?.waitUntil(syncOrderToERPNext(...))` after D1 insert |

## Phase Details
- [Phase 1: Dedup Sync Fix](phase-01-dedup-sync.md)
- [Phase 2: Cron Stubs → Real](phase-02-cron-stubs.md)
- [Phase 3: Checkout Hook](phase-03-checkout-hook.md)
