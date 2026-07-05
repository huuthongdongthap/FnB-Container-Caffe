# Phase 1: Dedup Sync + Fix Bug
**Estimate:** 1h
**Deps:** none

## Context
`worker/src/routes/orders-hono.ts` l.13 import `syncOrderToERPNext` từ `tree/erpnext/sync.js` nhưng code ở l.164-199 viết fetch inline riêng — duplicate, dễ drift. Cần thay bằng gọi hàm import.

`worker/src/tree/erpnext/sync.js` l.59 có `)` thừa sau fetch options — syntax error lúc runtime.

## Requirements
1. Xóa hoàn toàn inline ERPNext code (l.164-199) trong `orders-hono.ts`
2. Thay bằng gọi `syncOrderToERPNext()` với env + orderId + orderData đúng signature
3. Fix `)` thừa trong `sync.js` l.59
4. Giữ nguyên fire-and-forget pattern (`ctx.waitUntil`)
5. Giữ nguyên `ERPNEXT_SYNC_ENABLED` gate

## Files to Modify
- `worker/src/routes/orders-hono.ts` — replace l.164-199
- `worker/src/tree/erpnext/sync.js` — remove extra `)` on l.59

## Tests (TDD)
- Test that `orders-hono.ts` checkout calls `syncOrderToERPNext` (mock fetch)
- Test that inline fetch code is removed (grep assertion)
- Test `sync.js` has no syntax errors (parse + call mock)

## Validation
- `npm run build` 0 errors
- Existing order creation tests still pass
- Manual: checkout triggers ERPNext call when enabled, skips when disabled
