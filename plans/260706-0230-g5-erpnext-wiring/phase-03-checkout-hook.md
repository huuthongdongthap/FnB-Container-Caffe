# Phase 3: ERPNext Hook in Customer Checkout
**Estimate:** 2h
**Deps:** none (independent of Phase 1-2, can run in parallel after approve)

## Context
`worker/src/tree/orders/create-order.ts` xử lý customer-facing checkout (`POST /api/orders`) nhưng **không gọi ERPNext sync**. Chỉ `routes/orders-hono.ts` (KDS/POS checkout) có.

Cần thêm fire-and-forget ERPNext sync vào checkout path, tương tự pattern đang dùng ở KDS.

## Requirements
1. Sau khi order + payment + customer đã insert xong, gọi `syncOrderToERPNext()` qua `ctx.waitUntil`
2. Guard: chỉ sync khi `ERPNEXT_SYNC_ENABLED === 'true'`
3. Guard: `ctx` là optional — dùng `ctx?.waitUntil(...)` hoặc skip nếu undefined
4. Tạo entry trong `erpnext_sync_log` (D1) để track sync status cho cron retry
5. Không block order creation response — fire-and-forget
6. Giữ nguyên tất cả business logic hiện tại (QR table resolve, payment, notifications)

## Files to Modify
- `worker/src/tree/orders/create-order.ts` — add ERPNext sync + D1 log entry after inserts

## Tests (TDD)
- Test checkout creates `erpnext_sync_log` entry with 'pending' status
- Test checkout calls `syncOrderToERPNext` when enabled
- Test checkout skips sync when `ERPNEXT_SYNC_ENABLED !== 'true'`
- Test checkout still succeeds when ERPNext sync throws (fire-and-forget)
- Test existing order creation behavior unchanged (order + payment + customer inserts)

## Validation
- `npm run build` 0 errors
- All order creation tests pass
- Manually verify: POST /api/orders with ERPNEXT_SYNC_ENABLED=true → sync fires + log entry created
