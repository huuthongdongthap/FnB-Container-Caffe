# Phase 01: Canonical D1 Table Query Priority in Worker Handlers

## Context Links
- Brainstorm Report: `plans/reports/brainstorm-261030-zero-error-d1-query-priority-and-menu-table-ux-parity.md`
- Table CRUD Handlers: `worker/src/routes/openapi-tables-handlers/table-crud-handlers.ts`
- Zone CRUD Handlers: `worker/src/routes/openapi-tables-handlers/zone-crud-handlers.ts`
- ERPNext Vendors: `worker/src/routes/erpnext/vendors.ts`
- DinDin Cart Handlers: `worker/src/routes/dindin-handlers/cart-handlers.ts`
- Cal.com Booking Webhook: `worker/src/routes/cal-booking-webhook-handlers/webhook-handler.ts`

## Overview
- **Priority**: P1 (Eliminate 20 wasted D1 `no such table` RPC round-trips on production D1)
- **Current Status**: Complete

## Todo List
- [x] Promote `cafe_tables` to primary query in `table-crud-handlers.ts` and `zone-crud-handlers.ts`
- [x] Promote `suppliers` in `erpnext/vendors.ts` and `dindin_cart` in `dindin-handlers/cart-handlers.ts`
- [x] Verify all existing unit and integration tests for tables, vendors, dindin, and cal-booking-webhook pass

## Success Criteria
- Zero `no such table` errors thrown on the first query when invoking `/api/tables`, `/api/table-zones/:id`, `/api/erpnext/vendors`, and `/api/dindin/carts` against the 126-table production replica.
