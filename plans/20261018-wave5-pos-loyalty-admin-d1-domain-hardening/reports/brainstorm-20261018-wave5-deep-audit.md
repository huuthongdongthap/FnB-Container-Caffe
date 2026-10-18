# Deep Brainstorm Audit Report — Wave 5: POS, DinDin, Loyalty, Admin Ops, Worker OpenAPI & Domain Policies

**Date**: 2026-10-18
**Work Context**: `/Users/mac/mekong-cli/FnB-Container-Caffe`
**Method**: 4-Track Parallel Deep Codebase Exploration (`Explore` Subagents)

---

## 1. Executive Summary

Following Wave 4's completion (441/441 test files green), a 4-track deep code audit across Frontend Customer/POS/DinDin/Loyalty/PWA flows, Admin Dashboards/Reports/Ops, Worker OpenAPI/Feature routes, and `@aura/domain-*` packages uncovered **55 high-impact runtime and contract issues**:

1. **POS, DinDin, Loyalty, Referral, Account, Events, Pricing & PWA (Track 1)**:
   - `StitchPOSNew` mixes USD add-ons (`+$1.00`) into VND subtotals (`45000 + 1`), multiplies unit price by quantity twice in `CartSidebar`, and slices the first digit off VND strings assuming a leading `$`.
   - `DinDinMenu-hooks.ts` sends `{ sections }` instead of `{ menu: { sections } }` to `PUT /api/admin/dindin/config` (failing with HTTP 400 `D07`), and `DinDinCheckout.tsx` calls 3 unmounted endpoints (`/checkouts`, `/print`, `/qc`).
   - `LoyaltyPage` (`src/pages/loyalty.tsx`) omits the Bearer token (failing with 401), reads `summary.points` instead of `summary.total_points`, and renders `[object Object]` for `summary.next_tier`.
   - `StitchReferralNew1` formats VND cashback (`10000`) as USD (`+$10000.00`).
   - `useReorder` on `/account` generates random UUIDs truncated at `-` by `sanitizeCartItem` (`use-cart-store.ts:52`) because `formatCustomerOrderItem` strips `product_id`.
   - `/pricing` renders `null` when accessed at `/pricing` without a `:locale` route param, `formatCurrency` formats VND numbers as USD in English locale (`$45,000.00`), and `useOfflineSync` has a stale `state.isOnline` closure on reconnect.

2. **Admin Dashboards, Reports, Campaigns, Broadcast, Audit, Menu & ERPNext (Track 2)**:
   - `SalesReports` CSV export sends `type=sales` which `export-handlers.ts` rejects with HTTP 400.
   - `MetricCards` renders double percent signs (`100.0%%` / `N/A%`).
   - `CampaignEditModal` renders a non-interactive `<span>` for `is_active`, and `broadcast`/`campaigns`/`erpnextSync` locales use single-brace `{var}` instead of `{{var}}`.
   - `useProductManager` converts `category_id` via `Number(formData.category_id)` (`NaN -> null` for `'cat_...'`), failing Zod string validation on product create/update.
   - `ChatInbox-detail-view.tsx` inverts customer vs staff message bubble alignment.
   - `BirthdayConfig.tsx` uses low-contrast `--aura-chrome-dark` (`#4A6B85` on `#0E1322`, 3.1:1) and lacks input clamping.
   - `invoice-history-table.tsx` uses an unauthenticated `<a href="/api/erpnext-invoices/${id}/pdf">` for an endpoint that requires Bearer auth and returns JSON `{ data: { pdf_url } }`.

3. **Worker OpenAPI Schemas & Route Handlers (Track 3)**:
   - `worker/src/schemas/{common,orders,payments,staff,tables,promotions/PromoSchema,loyalty/*}.ts` enforce `.uuid()` and `.datetime()`, rejecting prefixed D1 IDs (`ORD_...`, `CUST_...`, `PAY_...`, `tier_...`, integer IDs) and SQLite `YYYY-MM-DD HH:MM:SS` timestamps.
   - `worker/src/routes/openapi-{products,orders,payments,customers,loyalty,promotions,reservations,shifts,staff,tables,analytics}.ts` reference non-existent columns/tables (`payments` vs `payment_transactions`, `min_spend` vs `min_points`, `loyalty_transactions` vs `loyalty_point_logs`, `valid_until` vs `expires_at`, `reservation_date`/`guest_count` vs `date`/`time`/`party_size`, `shifts` vs `staff_shifts`, `staff` vs `users`) and omit `'admin'` from `requireAuth`.

4. **Worker Feature Routes & Tree Handlers (Track 4)**:
   - `promotions-handlers/validation-handlers.ts` updates `WHERE id = ?` on `promotions` (`code` PK) and inserts into non-existent `promotion_redemptions` without try/catch.
   - `reports-handlers/reconciliation-handlers.ts` queries non-existent `shifts` and `denominations` (canonical: `staff_shifts` and `denominations_json`).
   - `reminders/shifts/route.ts` updates non-existent `staff_shifts.updated_at`, failing after push send and causing duplicate shift reminders.
   - `tree/loyalty/phone-auth-handler.ts` inserts non-existent `date_of_birth, zalo, source` into `customers` without try/catch, breaking customer phone signup.
   - `tree/loyalty/spend-cashback-handler.ts` omits `wallet_id` on `cashback_transactions` and inserts into `loyalty_audit_log` without try/catch.
   - `tree/referrals/apply-referral.ts:22` has an inverted `if (!pending)` guard.
   - `inventory-forecasting.ts` selects non-existent `max_stock` across all 3 fallback queries.
   - `dindin-handlers` and `pretix-handlers/event-handlers.ts` have missing endpoints / unwrapped Pretix `.results`.

5. **Domain Packages `@aura/domain-*` (Track 5)**:
   - `order-snapshot.ts` selects `category_id` instead of `category` from `menu_items`, `get-order.ts` omits `shipping_fee, discount`, `update-order.ts` queries `referrals.first_order_id` without try/catch and `orders.subtotal, tax`, and `create-order.ts` only matches `cafe_tables.table_number`.
   - `pricing.ts` (`happyHourDiscountFor`) ignores `apply_to`/`apply_ids` and fails unpadded `9:00` time comparisons.
   - `accrual.ts` double-counts `total_earned` when initializing a new `cashback_wallets` row (`total_earned = cashback` followed by `total_earned = total_earned + cashback`).
   - `segments.ts` passes `firstOrderAt: row.last_order_at` and `orderCount: 0`, misclassifying all active customers as `'new'`.
   - `inventory-transactions.ts` treats `'reserve'` as a positive stock addition (`+quantity`), and `order-deduction.ts` matches `LIKE '%%'` when `item.name` is empty.
   - `table/commands/tables.ts` calls `parseInt('t01', 10)` (`NaN`), so `qr_code_url` is always `null`.
   - `staff/src/policies/authorization-policy.ts` rejects `'admin'`, `'barista'`, `'kitchen'`, and `'chef'` roles with 403.
   - `payment/commands/payos-create-link.ts` allows unauthenticated callers passing `payment_method: 'cod'` to mark orders as `'paid'` and `'completed'`.

---

## 2. Unresolved Questions

- None. All 55 findings have been verified directly against live source files, `worker/schema.sql`, `worker/db/migrations/*.sql`, and existing test suites.
