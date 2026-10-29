# Cook Report: Phase `20261029_08` — Floor Plan, Cal.com Bookings, ERPNext Sync & OpenAPI v1 Schema Cutover

- **Date:** 2026-10-29
- **Migration:** `worker/db/migrations/20261029_08_reservations_erpnext_and_openapi_v1_schema_cutover.sql` + `.down.sql`
- **Status:** COMPLETED & VERIFIED (53/53 test files, 438/438 tests, 0 TypeScript errors)

## 1. Anti-Split-Brain Schema Reconciliations (`20261029_08`)
- **Floor Plan & Tables (`cafe_tables`):** Kept `cafe_tables` as single source of truth; added `name TEXT`, `capacity INTEGER DEFAULT 4`, `qr_code TEXT` and backfilled `capacity = COALESCE(seats, 4)`, `name = COALESCE(name, 'Bàn ' || table_number)`.
- **Cal.com Bookings & Reservations (`reservations`):** Kept `reservations` as single source of truth; added `cal_booking_uid TEXT`, `customer_email TEXT`, `reservation_time TEXT`, `special_requests TEXT` with `idx_reservations_cal_booking_uid` and `idx_reservations_date_status`.
- **ERPNext Customers & Loyalty Accounts (`customers`):** Kept `customers` as single source of truth; added `tax_id TEXT`, `erpnext_id TEXT`, `sync_status TEXT DEFAULT 'pending'`, `erpnext_last_synced TEXT`, `referral_code TEXT` with `idx_customers_erpnext_id` and `idx_customers_sync_status`.
- **ERPNext Vendors (`suppliers`) & Inbound Webhook Audit (`erpnext_webhook_log`):** Seeded 4 canonical Sa Đéc suppliers (`sup_aura_roastery`, `sup_vinamilk_dt`, `sup_tra_loc_phat`, `sup_uji_matcha`) and created `erpnext_webhook_log`.
- **OpenAPI Auth, Inventory, Promotions, Loyalty & Cron (`20261029_08`):**
  - Added auth/staff columns on `users` and `email_verifications`; created `sessions` and `trusted_devices`.
  - Added purchase order and inventory columns on `purchase_orders`, `purchase_order_items`, `inventory_items`, and `inventory_transactions`.
  - Added OpenAPI promotion columns on `promotions` and `promotion_usages` (`idempotency_key`).
  - Created `loyalty_transactions`, `loyalty_rewards`, and `loyalty_tier_configs` (seeded with `bronze`, `silver`, `gold`, `diamond`).
  - Created `cron_jobs` and `cron_runs`.

## 2. Handler & Route Alignment
- `worker/src/routes/floor-plan.ts:89`: Reads `Number(r.capacity ?? r.seats ?? 2)` on `GET /api/floor-plan/tables`.
- `worker/src/tree/cal-booking/process-booking.ts:49`: Queries `COALESCE(capacity, seats, 2) >= ?` on `cafe_tables` and writes `customer_email`, `reservation_time`, `special_requests`, and `cal_booking_uid` into `reservations`.
- `worker/src/routes/openapi-tables-handlers/routes.ts:16`: Registers static `/api/tables/zones` routes before dynamic `/api/tables/:id` routes.
- `worker/src/schemas/cron/models.ts:34` & `worker/src/routes/openapi-cron-handlers/job-crud-handlers.ts:121`: Accepts both flat (`cronExpression`, `handler`) and nested (`schedule.cronExpression`, `payload.taskType`) cron job creation payloads.

## 3. Verification Evidence
- `worker/src/__tests__/integrations/reservations-erpnext-openapi-v1-cutover.test.ts`: 1/1 passed (applies `20261029_03..08`, verifies `.down.sql` rollback + re-apply, and exercises Floor Plan, Cal.com Bookings, ERPNext Customers/Vendors/POS Webhook, and OpenAPI v1 Tables/Loyalty/Inventory/Promotions/Cron).
- `npm --prefix worker test -- --run src/__tests__/integrations/ src/__tests__/routes/web-payment-and-staging-gates.test.ts src/__tests__/routes/openapi-zones-staff-loyalty-hardening.test.ts`: 53 files, 438 tests passed.
- `npm run lint:migrations`: 80 forward, 11 down migrations verified across all 4 directories.
- `npm run typecheck:all`: 0 errors.

## Unresolved Questions
- None. Remote D1 execution of `20261029_03..08` against `fnb-caffe-db` awaits explicit operator confirmation.
