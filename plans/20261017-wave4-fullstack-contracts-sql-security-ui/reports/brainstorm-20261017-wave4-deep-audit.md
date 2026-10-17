# Brainstorm Report: Wave 4 Deep Full-Stack Audit (`/brainstorm --deep`)

**Date**: 2026-10-17
**Work Context**: `/Users/mac/mekong-cli/FnB-Container-Caffe`
**Pipeline**: `/bootstrap-auto-parallel` → `/brainstorm --deep` → `/plan`

---

## 1. Executive Summary

Following Wave 3 completion (`441/441` test files, `4033/4033` tests passing), 4 parallel `Explore` scouts audited the entire frontend (`src/**`, `public/**`), domain (`packages/domain/**`), and backend Worker (`worker/src/**`, `worker/schema.sql`, `worker/db/migrations/*.sql`).

We identified **5 strategic tracks** of runtime defects, schema drift, security exposures, and UI/i18n leaks:

1. **Track 1 — UI/UX M3 Contrast, i18n Key Leaks, Route Guards & Asset Integrity**
2. **Track 2 — Customer Flows (Reviews, Contact, Reservation, Tracking, Checkout) & Mobile Staff App**
3. **Track 3 — Admin Modules (Inventory, Staff/Recruitment, TableManagement, GenerateQR, Reservations, Customers, Subscriptions)**
4. **Track 4 — Worker D1 SQL & OpenAPI Router Schema Alignment**
5. **Track 5 — Webhook Fail-Closed Verification, Cron SQL Resilience, CORS & Auth Role Matrix**

---

## 2. Track-by-Track Root Cause Analysis & Decisions

### Track 1: UI/UX M3 Contrast, i18n Key Leaks, Route Guards & Assets
- **Raw i18n keys rendered in UI**:
  - `src/pages/admin/ChatInbox.tsx:39,151` & `ChatInbox-detail-view.tsx:62,81,155`: `useTranslation('chat')` calls `t('loadError')`, `t('messageCount')`, `t('sendError')`, `t('back')`, `t('replyPlaceholder')` without fallbacks; keys missing in `src/locales/{vi,en}.json`.
  - `src/pages/TVMenu.tsx:40`: `t('errorLoading')` in namespace `'tvMenu'` has no fallback or locale entry.
  - `src/pages/BrandGuideline.tsx`, `src/pages/brand-voice-section.tsx`, `src/pages/materials-section.tsx`: 30 `brand.*` keys lack fallbacks and locale entries.
  - Stitch `aria-label` raw keys: `loyalty-referral-block.tsx:24`, `loyalty-tier-benefits.tsx:10`, `loyalty-tier-card.tsx:16,133`, `loyalty-weekly-streak.tsx:19,94`, `StitchOrderSuccessNew-footer.tsx:17`, `StitchMenuNew-header.tsx:15`.
  - `public/locales/{vi,en}/translation.json` out of sync with `src/locales/{vi,en}.json`.
- **Missing Route Guards & Unauthenticated Mounts**:
  - `src/App.tsx:49,52`: `/kds` and `/stitch/order-management` lack `ProtectedRoute`.
  - `src/routes/public-routes.tsx:87-89`: `/saas/dashboard`, `/saas/onboard/tenant`, `/saas/onboard` lack `ProtectedRoute`.
  - `src/pages/SystemHub.tsx:68-75,426`: Calls admin stores/KDS unauthenticated on public `/portal` and hardcodes `"Localhost:5173"`.
- **Broken Links & Missing Assets**:
  - `src/components/seo/HelmetHead.tsx:12` & `config/brand.json:17`: Point to `/photos/IMG_6558.webp` which does not exist in `public/photos/` (actual file: `/photos/IMG_6564.webp`).
  - `src/pages/BrandGuideline.tsx:19` links to `/brand-guideline` instead of `/brand`.
  - `src/components/stitch/StitchContactNew-constants.ts:9-11`, `loyalty-footer.tsx:21,24`, `StitchNotFoundNew-Footer.tsx:6-7` link to non-existent `/support`, `/privacy`, `/terms`.
  - `src/pages/stitch-screen-gallery/screen-data.ts:56` & `screen-card.tsx:13` navigate to literal `'*'`.
- **M3 Contrast & Shell Config**:
  - `-600` dark-on-dark badges/text in `AuditLogViewer-table.tsx`, `Reservations.tsx`, `CampaignsManager-table-row.tsx`, `invoice-history-table.tsx`, `staff-list-tab.tsx`, `subscription-table.tsx`, `StatsCard.tsx`, `SyncStatus.tsx`, `performance-section-shared.tsx`, `brand-voice-section.tsx`, `BaziExplanation.tsx`, `LogoUsage.tsx`, `order-summary.tsx`, `EstimatedTime.tsx`.
  - `text-black` in `Inventory.tsx:120` & `Inventory-movement-modal.tsx:147`.
  - `src/components/stitch/shell-config.ts:10-42`: `/order-failure` prefix-matches `/order`.

### Track 2: Customer Flows & Mobile Staff App
- **Shift Cash Reconciliation 500 Error**: `packages/domain/shift/src/policies/cash-reconciliation-policy.ts:48-55` queries `WHERE payment_method = 'cash'` instead of `WHERE method IN ('cash', 'cod')`.
- **Mobile KDS Statuses**: `packages/domain/kitchen/commands/kds-mobile.ts:43`, `src/pages/mobile/kitchen-display-types.ts:15`, `kitchen-display-order-card.tsx:15-19,54-82`, `kitchen-display.tsx:94,98-115` omit `'confirmed'` and lack a `'ready' -> 'served'` button.
- **Mobile Login Context & Error Handling**: `src/pages/mobile/mobile-login.tsx:169-206` writes to `localStorage` directly without calling `useMobileAuth().login()`, leaving context `null` after navigation, and masks 429/500 errors as invalid PIN.
- **Waiter Orders & Push Role**: `src/pages/mobile/waiter-orders.tsx:58-63` omits `table_number`; `kitchen-display-order-card.tsx:45` reads `item.note` without `?? item.notes`; `mobile-layout-notifications.tsx:44` registers push notifications as `'customer'` instead of staff role.
- **Customer Review, Contact & Reservation Bugs**:
  - `src/hooks/use-reviews.ts:50-54,80-91` strips `order_id` required by `POST /api/reviews`; `worker/src/routes/features-router.ts:183` only mounts `/api/reviews/*` (missing `/api/reviews`).
  - `src/pages/stitch/contact-new/index.tsx:75-115` never calls `POST /api/contact`; `src/components/contact/ContactForm.tsx:36-45` clears form state when store submit fails.
  - `src/pages/stitch/reservation-new/index.tsx:44,61,79-99,240` & `src/hooks/use-reservations.ts:16-23,78` drop `notes`, parse `'Nhóm 10+'` as `2`, and show success before async completion; `use-reservation-store.ts:58-63` mishandles array availability response.
- **Order Tracking, Happy Hour & Checkout Mappers**:
  - `worker/src/routes/orders-unified.ts:78` uses `requireAuth` instead of `optionalAuth()` on `GET /api/orders/:id`; `order-ownership-policy.ts:68-100` blocks guest orders when phone matches a customer; `openapi-orders-handlers/helpers.ts:56-68,127-145` lacks `order.total` fallback and `menu_items` join.
  - `worker/src/routes/customer-menu.ts:18,48` omits `now: new Date()` for Happy Hour pricing.
  - `src/hooks/stores/order-store-mappers.ts:10-12` divides VND amounts by `100`; `StitchTrackOrderNew-order-timeline.tsx:14` omits `'pending'` and `'completed'`.

### Track 3: Admin Inventory, Staff, Tables, CRM & Subscriptions
- **Admin Inventory**:
  - `Inventory.tsx:81` & `Inventory-movement-modal.tsx:23,62` send `'adjust'` instead of `'adjustment'`.
  - `Inventory-forecast-tab.tsx:65-70,104-106` vs `inventory-forecasting.ts:47-94` (`inventory_item_id` vs `item_id` and field mapping `{ id, sku, name, recommended_reorder_qty }`).
- **Admin Staff & Recruitment**:
  - `staff-recruitment-tab.tsx:42-47` & `use-admin-recruitment-store.ts:65-66,172-201`: sends `status=all&position=all` and overwrites server `id` with `APP_${Date.now()}`.
  - `staff-list-tab.tsx:31-38,158-163` & `use-admin-staff-store.ts:80-117`: role select + password validation, rethrow on failure so modal stays open, and remove non-existent `/api/auth/staff/:id` fallback.
- **Admin Tables, QR, Reservations, Customers & Subscriptions**:
  - `TableManagement.tsx:41-55`: unwrap `res.data?.orders ?? res.data` so `for (const o of rows)` does not throw `TypeError`.
  - `GenerateQR-hooks.ts:16-20` & `GenerateQR-qr-card.tsx:37-43`: render inline SVG/authenticated QR instead of unauthenticated `<img src>`.
  - `packages/domain/reservation/src/routes/reservations.ts:104-107`: default new customer reservations to `'pending'` (or allow Approve/Reject on pending/confirmed).
  - `use-admin-customers-store.ts:47-131`: preserve `res.customer.id`, surface API errors instead of returning `true` on catch, and store `res.pagination`.
  - `SubscriptionsManager.tsx:92,107-131`: wire `deletePlanId` confirmation to `deleteMutation.mutate`.

### Track 4: Worker D1 SQL & OpenAPI Schema Alignment
- **OpenAPI Inventory & Validators**:
  - Relax `.uuid()` in `worker/src/schemas/inventory/*.ts` and `IdParamsSchema` to accept prefixed IDs (`ing_...`, `sup_...`, `USR_...`, `po_...`).
  - Fix `purchase-order-handlers.ts` (`po_number`, `expected_delivery_date`, `unit_price`, `total_price` + `LEFT JOIN suppliers`), `ingredient-handlers.ts` (`recipe_items` instead of `recipe_ingredients`), `movement-handlers.ts` (`LEFT JOIN ingredients` + canonical `stock_movements` columns), and `po-waste-handlers.ts` (`unit_cost` instead of `cost_per_unit`).
- **OpenAPI Router & `openapi.ts` Binding Order**:
  - `worker/src/lib/openapi.ts:123-132`: register real sub-routers (`openApiCategoriesRouter`, `openApiProductsRouter`, `openApiOrdersRouter`, `MenuRoutes`) BEFORE registering fallback 501 stubs.
  - Align `recruitment.ts:99-106` (`status !== 'all'`, `position !== 'all'`), `birthday.ts:119-201` (read `config:birthday` from `AUTH_KV`), `chat.ts:141-158` (mark customer messages read when admin fetches conversation), `erpnext-invoices.ts:27-45,118-121` (remove non-existent `m.error_message`, parse `request.json()` outside loop, allow local D1 listing when ERPNext env is unset), `erpnext-sync.ts` (`erpnext_sync_logs`), and `menu-projection.ts:127-180` (match `menu_modifiers` columns `option_name, price_delta, available`).

### Track 5: Webhooks, Cron SQL Resilience, CORS & Auth Role Matrix
- **Webhooks Fail-Closed & Constant-Time HMAC**:
  - `worker/src/routes/openapi-payments-handlers/webhook-handlers.ts:28-33`: fail closed (`500`/`401`) when `PAYOS_CHECKSUM_KEY` or signature is missing.
  - `packages/domain/payment/commands/nowpayments-ipn.ts:33-46`: fail closed when `NOWPAYMENTS_IPN_SECRET` is missing and use constant-time comparison.
  - `packages/domain/payment/commands/momo-create.ts:83-91,204-222` & `worker/src/routes/webhooks/momo.ts:45,85,94-100,188-196`: regenerate `paymentId`/`transId` inside retry loop, store `orderCode` in `transaction_id`, verify `amount`, reuse raw body text in `catch`, and write DLQ to `AUTH_KV`.
  - `worker/src/routes/zalo-webhook.ts:44-103`: verify `X-ZaloOA-Signature` when `ZALO_OA_SECRET` / `ZALO_APP_SECRET` is configured.
- **Cron & Scheduled SQL Alignment**:
  - `worker/src/tree/loyalty/lookup-handler.ts:31,36`, `worker/src/routes/cron-handlers/cashback-warnings.ts:13-22`, `worker/src/tree/campaigns/triggers/cashback-expiry.ts:29-70`: join `cashback_wallets` (`cw.customer_id`) instead of querying non-existent `ct.customer_id`.
  - `worker/src/routes/cron-handlers/order-checks.ts:18-49`: check canonical statuses `('pending', 'confirmed', 'preparing')` and guard `notes NOT LIKE '%[OVERDUE]%'`.
  - `worker/src/scheduled.ts:28-40`, `worker/src/routes/reminders/shifts/route.ts:25-66`, `worker/src/tree/mautic/*.ts`: wrap scheduled jobs in `try/catch` and align `customers` columns (`loyalty_tier`, `loyalty_points`).
- **CORS & Auth Role Matrix**:
  - `worker/src/index.ts:58` & `worker/src/middleware/cors.ts:8-38`: include `Idempotency-Key`, `X-Tenant-ID`, `X-Edge-Telemetry-Secret` in `allowHeaders` and `auraspace.cafe` in `ALLOWED_ORIGINS`.
  - Include `'admin'` in `requireAuth` across `openapi-inventory-handlers`, `inventory-forecasting`, `openapi-promotions-handlers`, `staff-mobile`, `tables-mobile`, `orders-mobile`, and allow `'manager'`/`'admin'` on `GET /api/auth/staff` and `GET /api/admin/payments/stuck`.

---

## 3. Unresolved Questions

- None. All findings are verified with exact `file:line` citations and ready for parallel execution.
