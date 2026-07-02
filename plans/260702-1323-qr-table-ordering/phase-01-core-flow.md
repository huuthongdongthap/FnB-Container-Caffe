---
phase: 1
title: Core Flow — table param, cart passes table_id, auto-occupy, dine-in checkout
status: completed
priority: P1
effort: 1d
---
# Phase 1: Core Flow — Complete

## Changes

### Backend (done via first parallel agent + manual fix)
- `worker/src/routes/tables.ts` — Added PATCH /api/tables/:id/occupy + /release
- `worker/src/tree/orders/create-order.ts` — Store table_id in order, auto-occupy table by table_number
- `worker/src/tree/orders/update-order.ts` — Auto-release table on served status 
- `worker/src/lib/validators.ts` — Added `table_id` to createOrderSchema

### Frontend (done via second parallel agent)
- `src/hooks/use-table-context.tsx` — NEW: React context reading ?table= param
- `src/App.tsx` — TableProvider + /admin/qr-codes route
- `src/hooks/stores/use-cart-store.ts` — tableId state
- `src/pages/menu.tsx` — Table banner for dine-in
- `src/pages/checkout.tsx` — Dine-in mode, pass table_id
- `src/pages/order-success.tsx` — Display table info
- `src/hooks/stores/use-order-store.ts` — table_id types
- `src/components/order/checkout-form.tsx` — Dine-in props
- `src/components/order/delivery-info.tsx` — Hide address for dine-in

### Validation
- All 1,033 tests pass
- Build: 0 TypeScript errors
- No breaking changes to existing routes/contracts
