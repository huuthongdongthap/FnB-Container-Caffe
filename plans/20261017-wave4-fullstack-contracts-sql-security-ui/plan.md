# Plan: Wave 4 Full-Stack Contracts, D1 SQL Alignment, Webhooks/Cron & UI/i18n Hardening

**Date**: 2026-10-17
**Work Context**: `/Users/mac/mekong-cli/FnB-Container-Caffe`
**Mode**: `/bootstrap-auto-parallel` → `/brainstorm --deep` → `/plan`
**Brainstorm Report**: [reports/brainstorm-20261017-wave4-deep-audit.md](reports/brainstorm-20261017-wave4-deep-audit.md)
**Status**: Completed (All 5 Parallel Tracks Executed & Verified)

---

## 1. Strategic Overview

| Track | Focus Area | Key Outcome |
| :--- | :--- | :--- |
| **Track 1** | UI/UX Contrast, i18n, Route Guards & Assets | Zero raw i18n keys (`chat`, `tvMenu`, `brand`, Stitch `aria-label`), synced `public/locales`, M3 `-300`/`-400` dark contrast, protected `/kds` & `/saas/*`, valid `/photos/IMG_6564.webp` OG image. |
| **Track 2** | Customer Flows & Mobile Staff App | Shift cash reconciliation `method IN ('cash','cod')`, Mobile KDS `'confirmed'` + `'ready'->'served'`, `useMobileAuth().login()` state sync, working Reviews/Contact/Reservation/Guest Tracking & VND mappers. |
| **Track 3** | Admin Inventory, Staff, Tables, CRM & SaaS | Inventory `'adjustment'` enum & forecast mapping, Recruitment `'all'` filter & server ID preservation, `TableManagement` orders unwrap, SVG QR preview, Customer store error propagation, Subscription plan delete modal. |
| **Track 4** | Worker D1 SQL & OpenAPI Schema Alignment | Non-UUID prefixed ID support (`ing_`, `sup_`, `USR_`), canonical D1 columns in Inventory/PO/Movements/Forecasting/ERPNext/Menu Projection, `openapi.ts` router registration before 501 stubs, KV-driven `birthday.ts`. |
| **Track 5** | Webhooks, Cron SQL, CORS & Auth Matrix | Fail-closed PayOS & NowPayments webhooks, MoMo retry/amount/DLQ fixes, Zalo OA HMAC check, Cron SQL joins (`cashback_wallets`, canonical order statuses), unified CORS headers & `'admin'` role matrix. |

---

## 2. Parallel Execution Phases & Strict File Ownership

| Phase | File | Scope | File Ownership (Strict Non-Overlapping) | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Phase 01** | [phase-01-ui-ux-i18n-contrast-route-guards.md](phase-01-ui-ux-i18n-contrast-route-guards.md) | i18n Key Leaks, Locale Sync, Route Guards, OG Asset & M3 Dark Contrast | `src/locales/**`, `public/locales/**`, `src/App.tsx`, `src/routes/public-routes.tsx`, `src/pages/{TVMenu.tsx,BrandGuideline.tsx,brand-voice-section.tsx,materials-section.tsx,SystemHub.tsx,KDS.tsx}`, `src/pages/stitch-screen-gallery/**`, `src/components/seo/HelmetHead.tsx`, `config/brand.json`, `src/components/stitch/{shell-config.ts,loyalty-referral-block.tsx,loyalty-tier-benefits.tsx,loyalty-tier-card.tsx,loyalty-weekly-streak.tsx,loyalty-footer.tsx,StitchOrderSuccessNew-footer.tsx,StitchMenuNew-header.tsx,StitchContactNew-constants.ts,StitchNotFoundNew-Footer.tsx}`, `src/components/admin/{StatsCard.tsx,SyncStatus.tsx,performance-section-shared.tsx}`, `src/components/brand/**`, `src/components/tracking/EstimatedTime.tsx`, `src/pages/admin/{AuditLogViewer-table.tsx,CampaignsManager-table-row.tsx}` | Completed |
| **Phase 02** | [phase-02-customer-mobile-staff-checkout-flows.md](phase-02-customer-mobile-staff-checkout-flows.md) | Mobile Staff App, Shift Cash Policy, Reviews, Contact, Reservation & Order Tracking | `src/pages/mobile/**`, `src/hooks/{use-reviews.ts,use-reservations.ts,use-checkout.ts}`, `src/hooks/stores/{use-reservation-store.ts,order-store-mappers.ts}`, `src/pages/stitch/{contact-new/index.tsx,reservation-new/index.tsx}`, `src/components/contact/ContactForm.tsx`, `src/components/stitch/StitchTrackOrderNew-order-timeline.tsx`, `src/pages/{TableOrder.tsx,TableOrder-hooks.ts,checkout.tsx}`, `packages/domain/shift/src/policies/cash-reconciliation-policy.ts`, `packages/domain/kitchen/commands/kds-mobile.ts`, `packages/domain/customer/policies/order-ownership-policy.ts` | Completed |
| **Phase 03** | [phase-03-admin-inventory-staff-tables-crm-contracts.md](phase-03-admin-inventory-staff-tables-crm-contracts.md) | Admin Inventory, Staff/Recruitment, TableManagement, QR, Reservations, Customers & Subscriptions | `src/pages/admin/{Inventory.tsx,Inventory-movement-modal.tsx,Inventory-forecast-tab.tsx,staff-recruitment-tab.tsx,staff-list-tab.tsx,TableManagement.tsx,GenerateQR-hooks.ts,GenerateQR-qr-card.tsx,Reservations.tsx,Customers.tsx,CheckinApprove-hooks.ts,SubscriptionsManager.tsx,use-subscription-plans.ts,invoice-history-table.tsx,subscription-table.tsx,Orders.tsx}`, `src/hooks/stores/admin/{use-admin-recruitment-store.ts,use-admin-staff-store.ts,use-admin-customers-store.ts}`, `src/components/stitch/{StitchOrderMgmtNew-order-card.tsx,stitch-order-mgmt-default.tsx}` | Completed |
| **Phase 04** | [phase-04-worker-d1-sql-openapi-schema-alignment.md](phase-04-worker-d1-sql-openapi-schema-alignment.md) | Worker D1 SQL Schema Fixes, OpenAPI Router Binding, Inventory/Orders/Birthday/Chat/ERPNext Handlers | `worker/src/lib/openapi.ts`, `worker/src/schemas/inventory/**`, `worker/src/routes/openapi-inventory-handlers/**`, `worker/src/routes/openapi-orders-handlers/**`, `worker/src/routes/openapi-staff-handlers/**`, `worker/src/routes/{inventory-forecasting.ts,recruitment.ts,birthday.ts,chat.ts,erpnext-invoices.ts,erpnext-sync.ts,orders-unified.ts,customer-menu.ts,customer-assistant.ts}`, `worker/src/routes/erpnext/**`, `worker/src/clients/erpnext-accounting-client.ts`, `worker/src/tree/auth/list-staff.ts`, `packages/domain/catalog/policies/menu-projection.ts`, `packages/domain/reservation/src/routes/reservations.ts` | Completed |
| **Phase 05** | [phase-05-webhooks-cron-cors-auth-hardening.md](phase-05-webhooks-cron-cors-auth-hardening.md) | Webhook Signature Hardening, Cron/Scheduled SQL Fixes, CORS Headers & Auth Role Matrix | `worker/src/{index.ts,scheduled.ts}`, `worker/src/middleware/cors.ts`, `worker/src/lib/rate-limiter.ts`, `worker/src/routes/{features-router.ts,auth-endpoints.ts,staff-mobile.ts,tables-mobile.ts,orders-mobile.ts,zalo-webhook.ts,container-telemetry.ts}`, `worker/src/routes/openapi-payments-handlers/webhook-handlers.ts`, `worker/src/routes/openapi-promotions-handlers/routes.ts`, `worker/src/routes/openapi-auth-handlers/auth-handlers.ts`, `worker/src/routes/customers-handlers/admin-handlers.ts`, `worker/src/routes/webhooks/momo.ts`, `worker/src/routes/cron-handlers/**`, `worker/src/tree/loyalty/{auth-middleware.ts,lookup-handler.ts}`, `worker/src/tree/campaigns/triggers/cashback-expiry.ts`, `worker/src/tree/mautic/**`, `worker/src/routes/reminders/shifts/route.ts`, `packages/domain/payment/commands/{momo-create.ts,nowpayments-ipn.ts}` | Completed |

---

## 3. Verification & Quality Gates

1. `npm run check:contrast` → 11/11 WCAG 2.1 AA pairs PASS
2. `npx tsc --noEmit && npx tsc -p worker/tsconfig.json --noEmit` → 0 errors
3. `npm run lint --silent` → 0 errors
4. `npx vitest run --silent=true` → 100% test suites passing
5. `npm run build --silent` → clean production bundle
