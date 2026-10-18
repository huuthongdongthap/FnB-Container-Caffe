# Brainstorm Deep Audit Report: Wave 8 Fullstack Hardening

**Date**: 2026-10-18
**Context**: Post-Wave 7 (KDS, Loyalty, D1 Fallbacks, RBAC Hardening). 441/441 test suites passing (4,047 tests), production Vite build green.
**Objective**: Complete exhaustive audit across Domain Packages, Worker Backend (OpenAPI, DOs, Webhooks), and Frontend (UI Components, Pages, Stores, Hooks) to eliminate all remaining D1 schema crashes, calculation bugs, RBAC gaps, state machine inconsistencies, and weak tests.

---

## Executive Summary of Findings

| Stream | Area | Verified Findings | Critical / High Impact |
|---|---|---|---|
| Stream 1 | Domain Packages, Analytics & Tests | 26 | D1 FK crash on guest events, split-bill price tampering, non-awaited worker promises, repeat customer aggregation bug |
| Stream 2 | Worker Backend (Routes, DOs, Clients) | 15 | Uncaught queries to non-existent `cron_jobs`/`cron_runs`, `trusted_devices`, `dindin_config`, missing token revocation checks |
| Stream 3 | Frontend Components, Pages, Stores, Hooks | 15 | 401 on guest Apple/Google Pay and order tracking, NaN in CustomerMetrics, split-bill item dropping, non-reactive store access |
| **Total** | **Fullstack Codebase** | **56** | **24 High / 32 Medium** |

---

## 1. Domain Packages & Analytics Findings

### 1.1 Canonical D1 Schema Fallbacks & Missing Columns
1. **`packages/domain/catalog/commands/categories.ts:45-59, 84-89`**:
   - `categories.slug` lacks fallback auto-slug generation on insert, causing SQLite UNIQUE constraint crashes when slug is empty.
   - `image_url` on categories is missing on legacy schemas; mutations throw uncaught `no such column: image_url`.
2. **`packages/domain/catalog/commands/products.ts:97-99, 115-134, 148`**:
   - `INSERT` and `UPDATE` omit `tags` and `badge` despite filters querying them; legacy schemas lack `slug`, `compare_at_price`, `sort_order`, `updated_at`.
   - Lacks constraint error catch on slug updates (needs 409 Conflict).
3. **`packages/domain/catalog/commands/menu-modifiers.ts:42-46, 80-91`**:
   - `modifier_groups.is_active` and `modifier_choices.is_available` absent in older schemas; choices insert omits `syncModifierChoiceToMenuProjection`.
4. **`packages/domain/catalog/policies/menu-projection.ts:59-174`**:
   - Projection writes to `menu_items` throw unhandled errors when table/columns are unmigrated, crashing primary product/category mutations.
5. **`packages/domain/crm/commands/campaign/detect.ts:115-125, 141-153`**:
   - `cashback_transactions` queries `customer_id` and `expires_at` directly instead of joining `cashback_wallets` on `wallet_id`.
   - `markExpiryNotified` updates `last_expiry_warning_at` which does not exist on canonical `customers`.
6. **`packages/domain/crm/commands/get-customer-account.ts:74-80`**:
   - Fallback catch queries non-existent column `total_cents` instead of `COALESCE(total, total_amount, 0)`.
7. **`packages/domain/crm/commands/customer-360.ts:86-121`**:
   - Fails when orders only have `total_amount` and lack both `order_type` and `channel`.
8. **`packages/domain/inventory/src/policies/bom-policy.ts:99-119` & `routes/inventory-crud.ts`**:
   - BOM deduction logs to `inventory_transactions` with `ingredients` table without foreign key resolution; lacks fallback to `stock_movements`.
9. **`packages/domain/order/queries/get-order.ts:43` & `stats.ts:18` & `telegram.ts:34`**:
   - `parseInt(results[0].total)` evaluates to `NaN` when `total` is null and `total_amount` is used; stats fails without fallback to `total_amount`; Telegram alert renders `NaN₫`.
10. **`worker/src/tree/analytics/{zone-analytics.ts,summary.ts,top-products.ts}`**:
    - Queries `cafe_tables` and `order_items` without fallback to `tables` or parsing cart items stored in `orders.items` JSON.

### 1.2 Domain Logic, State Invariants & Security
11. **`packages/domain/catalog/policies/availability.ts:7-10`**:
    - `parseAvailabilityFilter` returns `0` (unavailable only) for unrecognized/empty strings instead of `null` (no filter).
12. **`packages/domain/customer/events/customer-event-dispatcher.ts:78-87`**:
    - Inserts `customer_id = 'guest'`, triggering D1 FK constraint failure against `customers(id)` and blocking post-order CRM event consumption.
13. **`packages/domain/crm/commands/consume-crm-event.ts:73-103`**:
    - Ignores return values of accrual reversal and visit capture, silently swallowing loyalty failures.
14. **`packages/domain/crm/commands/get-fulfillment.ts:65`**:
    - `TERMINAL_STATUSES` excludes `'delivered'` and `'completed'`, causing delivered orders to show active in-flight ETA.
15. **`packages/domain/kitchen/commands/kds-status-transition.ts:43-122`**:
    - Bypasses order broadcaster DO, inventory reversal on cancellation, and loyalty accrual on completion.
16. **`packages/domain/order/commands/split-orders.ts:56-65, 114-135`**:
    - Trusts client-provided `item.price` during split calculations without validating against the parent order's catalog snapshot.
17. **`packages/domain/order/notifications/notify-order-status.ts:61-89`**:
    - `sendZNS` and `sendSMS` invoked without `await` and without `c.executionCtx.waitUntil`, causing worker runtime truncation.
18. **`packages/domain/order/queries/stats.ts:30-37`**:
    - `GROUP BY items` groups by full JSON string instead of aggregating line item products across orders.
19. **`worker/src/routes/reports-handlers/analytics-handlers.ts:255`**:
    - `GROUP BY customer_id HAVING COUNT(*) > 1` lumps all guest orders (`customer_id IS NULL`) into one group, inflating repeat customer counts.
20. **`worker/src/tree/analytics/csv-export.ts:42-95`**:
    - Missing UTF-8 BOM (`﻿`) and missing formula injection sanitization (`=`, `+`, `-`, `@`).

### 1.3 Test Suite Hardening (Weak / Tautological Mocks)
21. **`worker/src/__tests__/routes/debug-patch.test.ts:1-10`**: Only checks `tablesRouter.routes.length > 0`; no request executed.
22. **`worker/src/__tests__/routes/debug-refund.test.ts:41-43`**: Accepts status `[200, 400, 404, 500, 502]`, passing on 500 crashes.
23. **`worker/src/__tests__/routes/debug-wrong-sig.test.ts:52-60`**: Accepts `[400, 401, 403, 404]`.
24. **`worker/src/__tests__/middleware/audit-log.test.ts:55-170`**: Simulates SQL strings manually; never invokes actual `audit` middleware export; includes `expect(true).toBe(true)`.
25. **`worker/src/__tests__/routes/{reviews-dispatcher.test.ts,contact-dispatcher.test.ts,admin-metrics.test.ts}`**: Pure synthetic mocks without importing production router handlers.
26. **`worker/src/__tests__/orders/loyalty-dual-trigger.test.ts:21-33`**: Mocks `creditLoyaltyIfEligible` as `vi.fn()` and calls spy directly.

---

## 2. Worker Backend & Durable Objects Findings

### 2.1 Unhandled Missing Tables & Schema Crashes
27. **`worker/src/routes/dindin-handlers/checkout-handlers.ts:140` & `types.ts:64,84,94`**:
    - Queries non-existent `dindin_config` and `dindin_cart` without catch fallback to KV (`AUTH_KV.get('dindin:config')`).
28. **`worker/src/routes/openapi-cron-handlers/{job-crud-handlers.ts,run-handlers.ts}`**:
    - Queries non-existent `cron_jobs` and `cron_runs` without fallback; uses `c.env.AURA_DB` instead of `getDatabase(c)`.
29. **`worker/src/routes/openapi-auth-handlers/device-handlers.ts:86-89, 112, 117-118, 131-132`**:
    - Direct queries on non-existent `trusted_devices` and `sessions`; revoking device crashes with D1 table error.
30. **`worker/src/routes/openapi-promotions-handlers/crud-handlers.ts:163-182`**:
    - Both primary and fallback INSERT reference non-existent columns (`id`, `discount_type`, `discount_value`) instead of canonical `promotions (code, percent, max_discount, min_order, usage_limit, usage_count, expires_at, is_active, created_at)`.
31. **`worker/src/routes/reminders/shifts/route.ts:31-40`**:
    - Queries `staff_shifts` without fallback to canonical `shifts (user_id, shift_date, start_time, end_time)`.

### 2.2 Calculation Bugs & Logic Errors
32. **`worker/src/routes/openapi-promotions-handlers/validation-handlers.ts:77-80`**:
    - Calculates discount with `promotion.discount_value`, which is `undefined` on canonical schema (`percent`), resulting in `NaN` discount and `NaN` order total.
33. **`worker/src/routes/mixpost-handlers/generate-handler.ts:42`**:
    - Uses `promo.percent` without fallback to `promo.discount_value`, rendering `"Giảm undefined%"` in social posts.
34. **`worker/src/tree/referrals/apply-referral.ts:24-31`**:
    - Fallback fabricates dummy object `{ id: 'pending_d1', bonus_type: 'cashback' }` when no referral exists, bypassing validation guards.

### 2.3 Auth Revocation & Integration Edge Cases
35. **`worker/src/tree/subscriptions/middleware.ts:8-22`**:
    - `requireAdmin` checks JWT signature but fails to check `AUTH_KV.get('revoked:' + token)`.
36. **`worker/src/routes/erpnext.ts:58-63, 106-111`**:
    - `POST /configure` and `DELETE /configure` verify JWT without token revocation check.
37. **`worker/src/tree/subscriptions/sub-handlers.ts:20, 330`**:
    - `listSubscriptions` and `cancelSubscription` lack token revocation check.
38. **`worker/src/routes/webhooks-handlers/payos.ts:62`**:
    - Looks up payment strictly by `transaction_id = ?`; misses orders where `orderCode` was stored in `id` or `order_id`.
39. **`worker/src/routes/cal-booking-webhook-handlers/bookings-handler.ts:32`**:
    - Fallback query `COALESCE(reservation_time, date || 'T' || time)` crashes when `date` or `time` columns do not exist.
40. **`worker/src/routes/openapi-payments-handlers/read-handlers.ts`**:
    - Fails to sanitize customer scope when `user.role === 'customer'`.
41. **`worker/src/routes/openapi-loyalty-handlers/{reward-handlers.ts:244,admin-handlers.ts:21}`**:
    - Passes `undefined` to D1 `.bind(...)` for optional idempotency key.

---

## 3. Frontend Components, Pages, Stores & Hooks Findings

### 3.1 UI & Component Rendering Defects
42. **`src/components/home/testimonial-carousel.tsx:5-7, 95-96`**:
    - Renders `{testimonial.avatar}` directly, printing the literal text `"star"` in 36px font instead of rendering `REVIEW_AVATARS[testimonial.avatar]`.
43. **`src/components/events/event-card.tsx:19-23, 41-43`**:
    - `EVENT_ICONS` maps `'Tasting'` to string `'coffee'`, rendering literal word `"coffee"` in 48px font instead of `\u{2615}`.
44. **`src/components/admin/CustomerMetrics.tsx:126, 150`**:
    - Calls `data.new_30d.toLocaleString('vi-VN')` and `formatVnd(data.avg_order_value)`. Backend returns `new_customers_30d` and `avg_spend_per_customer`, crashing with TypeError or rendering `NaN₫`.
45. **`src/components/admin/StuckPaymentsCard.tsx:68-71`**:
    - Renders `${s.dbAmount?.toLocaleString('vi-VN')}₫` on masked strings (`'***'`), producing `'***₫ ≠ Hook: ***₫'`.
46. **`src/components/stitch/StitchOrderMgmtNew-order-card.tsx:127-130`**:
    - Fallback `onClick={onViewDetails ?? (isServed ? undefined : onAction)}` causes clicking "Details" to unexpectedly advance order status.
47. **`src/components/admin/OrderTable.tsx:138`**:
    - Directly calls `useAuthStore.getState().user?.role` inside table JSX, bypassing React reactivity when role changes.
48. **`src/pages/admin/SubscriptionsManager.tsx:137-140`**:
    - "Invoices" tab renders an empty static placeholder instead of mounting the existing `InvoiceTable` / `InvoiceHistory` components.

### 3.2 Cashier POS & Checkout Failures
49. **`src/pages/admin/POS.tsx:131-143`**:
    - When `paymentMethod === 'payos'` checkout succeeds, `paymentUrl` is set in state, but no modal or QR popup is rendered, leaving cashier unable to view or present the PayOS QR code.
50. **`src/pages/checkout.tsx:168-185`**:
    - Guest Apple Pay / Google Pay checkout sends `POST /api/payments/payment-request`. The backend strictly requires authenticated roles, returning 401 Unauthorized for guests.
51. **`src/pages/TrackOrder.tsx:32-35` & `src/pages/order-success.tsx:92`**:
    - Unauthenticated guest order tracking calls `useOrderStore.fetchOrder(id)` hitting `GET /api/orders/:id`, which enforces `requireAuth`, displaying error card to guests.
52. **`src/pages/loyalty.tsx:154-162`**:
    - `handleCheckIn` uses relative `fetch('/api/checkin')` without `apiFetch` (missing `API_BASE`) and passes `customer_id: 'guest'`, causing a shared 409 conflict for all guests that day.

### 3.3 State Management & Split-Bill Logic Bugs
53. **`src/hooks/split-bill-helpers.ts:18-24` & `src/hooks/use-split-bill.ts:80-95`**:
    - Reducing `splitCount` leaves item assignments pointing to orphaned indices `>= splitCount`. `computeUnassignedItems` ignores out-of-bounds indices, causing items to silently vanish from the split while `allAssigned` evaluates to `true`.
54. **`src/hooks/use-checkin.ts:63-67, 102, 137, 172`**:
    - Checks `if (!lookupRes.success || !lookupRes.member)`, but backend returns `{ ok: true, member }`. Valid members are rejected. Calls non-existent checkin endpoints and leaks timers in `markPosted`.
55. **`src/hooks/stores/admin/use-admin-customers-store.ts:98-135`**:
    - `addCustomer`, `updateCustomer`, `deleteCustomer` return `true` on network/API failure and retain optimistic state, masking real errors.
56. **`src/hooks/stores/admin/use-admin-staff-store.ts:65`**:
    - `fetchStaff` calls `GET /api/auth/staff`, which rejects `manager` role with 403 Forbidden even though navigation allows managers.

---

## 4. Phase Decomposition for Wave 8

To execute the remediation with zero file conflicts and full test isolation, Wave 8 is structured into 5 parallel execution tracks:

1. **Track 1: Frontend UI Components, Pages & Visual Integrity**:
   - `src/components/{home/**,events/**,admin/**,stitch/**}`
   - `src/pages/{checkout.tsx,TrackOrder.tsx,loyalty.tsx,admin/{POS.tsx,SubscriptionsManager.tsx}}`
2. **Track 2: Frontend Stores, Hooks & State Machines**:
   - `src/hooks/{split-bill-helpers.ts,use-split-bill.ts,use-checkin.ts,stores/**}`
3. **Track 3: Worker OpenAPI Handlers, Cron & Device Resilience**:
   - `worker/src/routes/openapi-{cron,auth,promotions,payments,loyalty}-handlers/**`
   - `worker/src/routes/{dindin-handlers/**,reminders/**,mixpost-handlers/**}`
4. **Track 4: Domain Packages (Catalog, CRM, Inventory, Order, Customer, Kitchen)**:
   - `packages/domain/{catalog,crm,inventory,order,customer,kitchen}/**`
   - `worker/src/tree/{analytics,referrals,subscriptions}/**`
5. **Track 5: Worker Auth Revocation, Webhooks, Public Tracking Route & Test Hardening**:
   - `worker/src/routes/{orders-unified.ts,webhooks-handlers/**,erpnext.ts,cal-booking-webhook-handlers/**}`
   - `worker/src/__tests__/**`

---

## 5. Unresolved Questions

None. All 56 findings have been traced directly to source code and verified against database schemas and route definitions.
