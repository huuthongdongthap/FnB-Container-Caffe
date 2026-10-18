# Deep Audit & Brainstorm Report — Wave 7: KDS, Loyalty, D1 Fallbacks, OpenAPI RBAC & Domain Invariants

**Date**: 2026-10-18
**Work Context**: `/Users/mac/mekong-cli/FnB-Container-Caffe`
**Workflow**: `/bootstrap-auto-parallel` → `/brainstorm --deep` → `/plan` → `/cook --auto --parallel`

---

## 1. Executive Summary

Three parallel deep-audit tracks inspected `src/**`, `worker/src/**`, `packages/domain/**`, and `worker/src/__tests__/**` for remaining runtime defects, D1 schema mismatches, RBAC gaps, and state/financial invariants:

1. **Track 1 — Frontend KDS, Loyalty, Mobile & Admin Flows (`src/**`)**:
   - `src/pages/loyalty.tsx` reads non-existent `useAuthStore.token`, calls relative `/api/checkin` without `customer_id` body, and hardcodes referral/streak values.
   - `src/hooks/stores/use-checkin-store.ts` sends `{ phone }` to `/api/loyalty/checkin` while backend `checkinRouter` requires `customer_id` unless resolved by phone, and reads `data.points`/`data.reward` instead of `reward_amount`.
   - `src/pages/TableOrder-hooks.ts`, `src/hooks/use-mobile-auth.tsx`, and `src/pages/mobile/mobile-login.tsx` omit `credentials: 'include'`.
   - `src/pages/admin/DinDinCheckout.tsx` checks `Array.isArray(data)` on `{ success, data, checkouts }`, reads `qcOk` instead of `qcPassed`, and marks failed approvals as `'completed'`.
   - `src/pages/admin/invoice-history-table.tsx` reads `pdf_url` instead of `pdfUrl`.
   - `src/hooks/use-kds.ts` & `src/pages/KDS.tsx` & `src/components/stitch/stitch-kds-order-card.tsx` & `StitchKDSNew.tsx`: SSE snapshot overwrites `'ready'` orders, overdue `'preparing'` tickets call `onStart` instead of `onComplete`, `'confirmed'` tickets have no action button, and `#${o.id.slice(-4)}` collides.
   - `src/pages/mobile/waiter-orders.tsx` renders `[object Object]` for object modifiers and parses `table_id` with `parseInt`.
   - `src/components/admin/{range-selector.tsx,performance-section*.tsx}` desyncs range state and passes `MouseEvent` as `range` on retry.
   - `src/pages/admin/{Inventory-movements-tab.tsx,Inventory-movement-modal.tsx}` uses `'adjust'` vs `'adjustment'` and blocks negative adjustments.
   - `src/pages/admin/POS.tsx` navigates to non-existent `/admin/shifts` and hides PayOS payment link after 5s.
   - `src/pages/admin/{TableManagement.tsx,TableManagement-card.tsx}` toggles only between 2 statuses and passes `{ fallback }` instead of `{ defaultValue }` to `t()`.
   - `src/pages/admin/{SubscriptionsManager.tsx,use-subscriptions.ts,use-notification-subscriptions.ts,subscription-table.tsx}` passes plan errors to cancel modal, leaves invoices tab unwired, and creates duplicate keys on notification subscriptions.
   - `src/hooks/stores/admin/{use-admin-customers-store.ts,use-admin-staff-store.ts,use-admin-recruitment-store.ts}`, `src/pages/admin/{Customers.tsx,staff-list-tab.tsx,CampaignsManager.tsx,SalesReports.tsx,Dashboard-sections.tsx,GenerateQR-qr-card.tsx}` mutate state as successful on API errors, render `"Invalid Date"`, or leak blob URLs.
   - `src/pages/TableReservation.tsx` opens confirmation modal without awaiting `createReservation`, and `src/pages/TrackOrder.tsx` ignores `?id=` query parameter from `order-success.tsx`.

2. **Track 2 — Worker Routes, Tree Handlers, Auth & Realtime Sync (`worker/src/**`)**:
   - `guest-handlers.ts` & `checkout-handlers.ts`: `cafe_tables.updated_at`, `orders.customer_address` vs `address`, and unwrapped `order_items` inserts.
   - `floor-plan.ts` & `table-sessions-handlers/*`: unwrapped `cafe_tables.notes` and `table_sessions` queries, and `/:id/no-show` overwriting `'Overdue'` with `'Available'`.
   - `notifications-mobile.ts`: `push_subscriptions.user_id`/`last_used_at` vs canonical `customer_id`, and `notifications` table fallback.
   - `admin-qr.ts` & `tree/qr/generator.ts`: `Number(t.id)`/`parseInt(table.id, 10)` yielding `NaN` for string table IDs, and missing `table_qr_codes` fallback.
   - `dindin-handlers/{cart-handlers.ts,checkout-handlers.ts}`: `dindin_carts` vs `dindin_cart`, cart update total formula bug, premature idempotency KV write, and missing `publishOrderEvent` on QC completion.
   - `chat.ts` & `recruitment.ts`: `contact_messages.content` NOT NULL constraint, `id` integer primary key mismatch, and `JWT_SECRET` missing admin escalation in `chat.ts`.
   - `pos-customer.ts`, `tree/loyalty/*`, `routes/loyalty.ts`, `checkin.ts`, `birthday.ts`, `referrals.ts`, `push.ts`, `customers-handlers/*`, `reports-handlers/*`, `cron-handlers/cashback-warnings.ts`, `webhooks-handlers/notifications.ts`, `lib/audit-logger.ts`: schema fallbacks, auth/revocation guards, CSV RFC 4180 escaping, `c.executionCtx` safety, and RBAC role completeness (`cashier`, `waiter`, `staff`, `admin`) across `orders-unified.ts`, `staff-mobile.ts`, `orders-mobile.ts`, `tables-mobile.ts`, `refunds-handlers/*`, `crm-handlers/*`, `features-router.ts`, `analytics-handlers/*`.

3. **Track 3 — Worker OpenAPI Handlers (`worker/src/routes/openapi-*-handlers/**`)**:
   - Canonical `audit_logs` fallback and D1 table/column fallbacks across `openapi-{products,tables,orders,staff,inventory,loyalty,promotions,payments,auth,cron}-handlers`.
   - Undefined `body.idempotencyKey` D1 bind error and `strftime('%Y', created_at)` string bind in `openapi-loyalty-handlers`.
   - Missing role guards on promotion mutations (`openapi-promotions-handlers/crud-handlers.ts`) and customer payment listing scope (`openapi-payments-handlers/read-handlers.ts`).

4. **Track 4 & 5 — Domain Packages & Worker Tests (`packages/domain/**`, `worker/src/__tests__/**`)**:
   - Catalog (`get-customer-menu.ts`, `happy-hour.ts`, `pricing-resolver.ts`): `products` ↔ `menu_items` fallbacks, passing `productId` and `categoryId` to `resolveItemPrice`, safe `parseTags`.
   - CRM (`accrual.ts`, `lookup-profile.ts`, `place-order.ts`, `referral.ts`, `refund-reversal.ts`, `segments.ts`, `update-consent.ts`): resilient `orders`/`cashback_transactions`/`loyalty_audit_log` writes, `customers.phone` fallback in `lookupByPhone`, referee reward + `total_cashback_earned_vnd` in `rewardReferralOnFirstOrder`, cashback reversal in `reverseAccrual`, `resolveBandPolicy(kv)` and `first_order_at` in `segments.ts`.
   - Order, Payment & Customer (`create-order.ts`, `create-order-side-effects.ts`, `update-order.ts`, `loyalty-trigger.ts`, `split-orders.ts`, `admin-orders.ts`, `get-order.ts`, `stats.ts`, `momo-create.ts`, `nowpayments-ipn.ts`, `customer-lifecycle-policy.ts`, `customer-crm-event-contract.ts`): post-insert `ORDER_BROADCASTER`, linking new guest `customer_id` onto `orders`, paid/completed guard in `creditLoyaltyIfEligible`, `reverseAccrual` on cancel, server-side pricing in `splitOrders`, MoMo retry `orderCode` & cancelled order guard, NowPayments `row.status === 'paid'` idempotency, safe `mergeCustomerProfiles` cashback upsert, and recursive `sanitizeCustomerEventPayload`.
   - Inventory, Kitchen, Table, Shift, Staff, Security, Notification, Integration & Tests: `restoreInventoryForOrder` & `deductInventoryForOrder` BOM + SKU fallback & idempotency, negative `adjust` in `inventoryTransactionSchema`, `is_active = 1` in `getCanonicalRecipe`, `confirmed -> preparing -> ready` in `kitchen-station-tickets.ts`, `'ready'` + timer cleanup in `kds-stream.ts`, case-insensitive table statuses, `cash-reconciliation-policy.ts` & `staff-tips.ts` D1 fallbacks, full `StaffRole` in `staff-auth.ts` & `security-policy.ts`, canonical `notification_audit_log` fallback, internal AURA status normalization in `integration-boundary-policy.ts`, and real assertions in `worker/src/__tests__/**`.

---

## 2. Unresolved Questions

None — all findings are verified against live code and canonical D1 schemas (`worker/schema.sql`, `db/schema.sql`, and `worker/migrations/*.sql`).
