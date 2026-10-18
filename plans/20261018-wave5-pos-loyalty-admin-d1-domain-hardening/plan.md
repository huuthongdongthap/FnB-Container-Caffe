# Plan: Wave 5 POS, DinDin, Loyalty, Admin Ops, Worker OpenAPI & Domain Policy Hardening

**Date**: 2026-10-18
**Work Context**: `/Users/mac/mekong-cli/FnB-Container-Caffe`
**Mode**: `/bootstrap-auto-parallel` → `/brainstorm --deep` → `/plan` → `/cook --auto --parallel`
**Brainstorm Report**: [reports/brainstorm-20261018-wave5-deep-audit.md](reports/brainstorm-20261018-wave5-deep-audit.md)
**Status**: Completed (All 5 Parallel Tracks Executed & Verified)

---

## 1. Strategic Overview

| Track | Focus Area | Key Outcome |
| :--- | :--- | :--- |
| **Track 1** | POS, DinDin, Loyalty, Referral, Account, Events, Pricing & PWA | VND-native POS & Referral formatting, working DinDin config/cart/checkout UI, authenticated `LoyaltyPage` with `total_points`/`next_tier` mapping, working Account Reorder (`menuItemId` preserved), `/pricing` without `:locale` param, accurate offline sync & SW prompts. |
| **Track 2** | Admin Dashboards, Reports, Campaigns, Broadcast, Audit, Menu & ERPNext | Deduped Dashboard polling + dynamic `period`, working SalesReports CSV export (`type=revenue`), `MetricCards` single `%`, interactive Campaign `is_active` switch, `{{var}}` i18n interpolation, string `category_id` in `ManageMenu`, `BirthdayConfig` AA contrast + clamping, authenticated Invoice PDF download. |
| **Track 3** | Worker OpenAPI Schemas & Route Handlers | Prefixed ID & SQLite timestamp support across `worker/src/schemas/**`, canonical D1 table/column queries & `'admin'` RBAC across `worker/src/routes/openapi-*.ts`, `menuItemId` in customer order items. |
| **Track 4** | Worker Feature Routes, Tree Handlers & D1 SQL | Safe D1 queries & fallbacks across `promotions-handlers`, `reports-handlers`, `reminders/shifts`, `table-sessions-handlers`, `floor-plan`, `referrals`, `tree/loyalty/*`, `admin-handlers`, `admin-loyalty`, `dindin-handlers`, `pretix-handlers`, `inventory-forecasting`, `qr/generator`, `sub-handlers`. |
| **Track 5** | Domain Packages (`@aura/domain-*`) SQL, Pricing, Loyalty & RBAC | Canonical D1 columns in `order`, `crm`, `customer`, `table`; `happyHourDiscountFor` target/time fix; single-counted cashback `total_earned`; accurate `segments` frequency band; negative `'reserve'` stock delta; working table QR slug lookup; `'admin'`/`'barista'`/`'kitchen'`/`'chef'` in `authorization-policy.ts`; staff-only COD paid in `payos-create-link.ts`. |

---

## 2. Parallel Execution Phases & Strict File Ownership

| Phase | File | Scope | File Ownership (Strict Non-Overlapping) | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Phase 01** | [phase-01-pos-dindin-loyalty-referral-account-pwa.md](phase-01-pos-dindin-loyalty-referral-account-pwa.md) | POS, DinDin, Loyalty, Referral, Account, Events, Pricing, OurStory & Offline/PWA | `src/pages/{loyalty.tsx,referral.tsx,events.tsx}`, `src/pages/admin/{POS.tsx,DinDin*.tsx,use-dindin-cart.ts,cart-active-view.tsx}`, `src/pages/account/**`, `src/pages/[locale]/pricing.tsx`, `src/pages/stitch/loyalty-calc/**`, `src/routes/public-routes.tsx`, `src/components/stitch/{StitchPOSNew*,loyalty-*,StitchLoyaltyCalcNew.tsx,StitchReferralNew1*,StitchAccountDashNew*,StitchEventsNew2*,StitchStoryNew*}`, `src/components/saas/PricingCard.tsx`, `src/components/pwa/**`, `src/hooks/{use-loyalty.ts,use-events.ts,use-offline-sync.ts,use-sw-registration.ts}`, `src/hooks/stores/{use-referral-store.ts,use-cart-store.ts,use-order-store.ts}`, `src/lib/{format.ts,offline-db.ts}` | Completed |
| **Phase 02** | [phase-02-admin-dashboards-reports-ops-contracts.md](phase-02-admin-dashboards-reports-ops-contracts.md) | Admin Dashboards, SalesReports, Metrics, Promotions, Campaigns, Broadcast, AuditLog, Devices, NotificationSettings, ManageMenu, ChatInbox, BirthdayConfig, ERPNExtSync & InvoiceHistory | `src/pages/admin/{Dashboard*.tsx,Dashboard-hooks.ts,Dashboard-sections.tsx,SalesReports.tsx,use-sales-report-data.ts,sales-report-overview.tsx,PromotionsManager.tsx,use-promotions-manager.ts,CampaignsManager.tsx,CampaignsManager-edit-modal.tsx,BroadcastPage.tsx,AuditLogViewer.tsx,AuditLogViewer-filter-panel.tsx,Devices*.tsx,use-notification-settings.ts,use-notification-subscriptions.ts,use-product-manager.ts,use-category-manager.ts,product-list.tsx,product-modal.tsx,ChatInbox*.tsx,BirthdayConfig.tsx,birthday-toggle.tsx,ERPNExtSync.tsx,invoice-history-table.tsx}`, `src/components/admin/{OrderTable-refund-action.tsx,metric-cards.tsx}`, `src/hooks/use-admin.ts`, `src/hooks/stores/admin/{use-admin-dashboard-store.ts,use-performance-store.ts,use-audit-store.ts,use-admin-staff-store.ts}`, `src/locales/**`, `public/locales/**` | Completed |
| **Phase 03** | [phase-03-worker-openapi-schemas-handlers-alignment.md](phase-03-worker-openapi-schemas-handlers-alignment.md) | Worker OpenAPI Zod Schemas & OpenAPI Route Handlers | `worker/src/schemas/**`, `worker/src/routes/openapi-{menu,products,orders,payments,customers,loyalty,promotions,reservations,shifts,staff,tables,analytics}.ts`, `worker/src/routes/openapi-orders-handlers/helpers.ts`, `worker/src/lib/validators/products.ts` | Completed |
| **Phase 04** | [phase-04-worker-routes-d1-sql-rbac-hardening.md](phase-04-worker-routes-d1-sql-rbac-hardening.md) | Worker Feature Routes, Tree Handlers, D1 SQL Fallbacks & RBAC | `worker/src/routes/{promotions-handlers/**,reports-handlers/**,reminders/shifts/route.ts,table-sessions-handlers/**,floor-plan.ts,referrals.ts,admin-handlers.ts,admin-loyalty.ts,dindin-handlers/**,pretix-handlers/event-handlers.ts,broadcast-handlers/**,admin-audit-logs-handlers/**,push.ts,inventory-forecasting.ts,saas-pricing.ts,saas-tenants.ts,features-router.ts,orders-core.ts,orders-mobile.ts,tables-mobile.ts,analytics-handlers/metrics-handlers.ts,webhooks/momo.ts,auth-handlers/staff-handlers.ts}`, `worker/src/tree/{referrals/**,loyalty/**,campaigns/**,mautic/**,auth/**,qr/generator.ts,subscriptions/sub-handlers.ts}` | Completed |
| **Phase 05** | [phase-05-domain-packages-sql-policies-rbac.md](phase-05-domain-packages-sql-policies-rbac.md) | Domain Packages (`@aura/domain-*`) SQL, Pricing/Loyalty/Inventory/Table Policies & RBAC | `packages/domain/{catalog,order,crm,customer,inventory,table,reservation,shift,staff,payment,kitchen}/**` | Completed |

---

## 3. Verification & Quality Gates

1. `npm run check:contrast` → 11/11 WCAG 2.1 AA pairs PASS
2. `npx tsc --noEmit && npx tsc -p worker/tsconfig.json --noEmit` → 0 errors
3. `npm run lint --silent` → 0 errors
4. `npx vitest run --silent=true` → 100% test suites passing
5. `npm run build --silent` → clean production bundle
