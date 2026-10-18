# Plan: Fullstack Contracts, Webhooks, OpenAPI Routes & Domain Hardening

**Date**: 2026-10-18
**Work Context**: `/Users/mac/mekong-cli/FnB-Container-Caffe`
**Mode**: `/bootstrap-auto-parallel` → `/brainstorm --deep` → `/plan` → `/cook --auto --parallel`
**Brainstorm Report**: [reports/brainstorm-20261018-wave6-deep-audit.md](reports/brainstorm-20261018-wave6-deep-audit.md)
**Status**: Completed (All 5 Parallel Tracks Executed & Verified)

---

## 1. Strategic Overview

| Track | Focus Area | Key Outcome |
| :--- | :--- | :--- |
| **Track 1** | Frontend Stitch UI, Hooks, Admin Ops & SaaS | Unique calendar keys & working form submit in `StitchReservationNew`, guarded `<img src>` across Stitch cards/sidebars/profiles, authenticated `useOfflineSync`/`useSplitBill`/`usePushNotifications`/`StaffNotificationSettings`, unwrapped `useReports` & `src/pages/order/index.tsx`, `PATCH` in `CheckinApprove`, deduplicated `GenerateQR`, working Admin/SaaS Subscriptions & Orders actions. |
| **Track 2** | Worker Metrics, Middleware, Webhooks & Order Hono Handlers | Safe `stmt?.run` & `_alerts` fallback in `metrics-collector.ts`, `'admin'` & `AUTH_KV` guards in `staff-auth.ts` & `audit-log.ts`, null-safe PayOS `verifySignature`, PayOS/MoMo webhook `AUTH_KV` & `publishOrderEvent` sync, authoritative product pricing & `publishOrderEvent` in `orders-hono-handlers`. |
| **Track 3** | Worker OpenAPI Handlers, Signage, Cal.com, Loyalty & Subscriptions | Bound `.bind(...)` in `reorder-handler.ts`, full staff RBAC in `openapi-orders/payments/promotions/auth-handlers`, canonical D1 fallbacks in `signage.ts`, `cal-booking-webhook-handlers`, `loyalty.ts`, `spend-cashback-handler.ts`, `subscriptions.ts`, `erpnext-sync.ts`, and `admin-handlers.ts`. |
| **Track 4** | Domain Payment, Order, Catalog, CRM & Customer + Payment Tests | Non-corrupting retry `orderCode` in `payos-helpers.ts`, non-empty `payment_url` idempotency in `payos-create-link.ts`, full staff roles in `order-ownership-policy.ts`, SQLi-safe `safeSortColumn` & aligned params in `admin-orders.ts`, category-scoped happy hour fix, CRM consent revocation & accrual fixes, and completed `payments.test.ts` assertions. |
| **Track 5** | Domain Staff, Shift, Table, Reservation, Kitchen, Inventory, Audit & Notification | Full staff roles (`admin`, `barista`, `chef`, `kitchen`, `cashier`, `waiter`) across `staff`, `shift`, `table`, `reservation`, `kitchen`; D1 schema fallbacks in `shifts.ts`, `cash-reconciliation-policy.ts`, `reservations.ts`, `order-deduction.ts`, `audit-writer-policy.ts`, `notification-orchestration-policy.ts`; Date-safe `redactSensitiveFields`. |

---

## 2. Parallel Execution Phases & Strict File Ownership

| Phase | File | Scope | File Ownership (Strict Non-Overlapping) | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Phase 01** | [phase-01-frontend-stitch-hooks-admin-saas-contracts.md](phase-01-frontend-stitch-hooks-admin-saas-contracts.md) | Frontend Stitch UI, Hooks, Admin & SaaS | `src/components/stitch/**`, `src/components/pwa/push-notification-toggle.tsx`, `src/components/staff/notification-settings.tsx`, `src/hooks/{use-offline-sync.ts,use-split-bill.ts,use-push-notifications.ts,use-reports.ts}`, `src/hooks/stores/admin/use-admin-orders-store.ts`, `src/pages/{order/index.tsx,stitch/customer-reviews/index.tsx}`, `src/pages/admin/{Orders.tsx,CheckinApprove-hooks.ts,use-subscription-plans.ts,GenerateQR.tsx,ERPNExtSync.tsx}`, `src/pages/saas/**` | Completed |
| **Phase 02** | [phase-02-worker-metrics-middleware-webhooks-payment-sync.md](phase-02-worker-metrics-middleware-webhooks-payment-sync.md) | Worker Metrics, Middleware, Webhooks & Order Hono Handlers | `worker/src/lib/metrics-collector.ts`, `worker/src/middleware/{staff-auth.ts,audit-log.ts,auth.ts}`, `worker/src/routes/webhooks-handlers/**`, `worker/src/routes/webhooks/momo.ts`, `worker/src/routes/orders-hono-handlers/**`, `worker/src/routes/customers-handlers/**` | Completed |
| **Phase 03** | [phase-03-worker-openapi-routes-signage-loyalty-subs.md](phase-03-worker-openapi-routes-signage-loyalty-subs.md) | Worker OpenAPI Handlers & Feature Routes | `worker/src/routes/openapi-*-handlers/**`, `worker/src/routes/{signage.ts,zalo.ts,cal-booking-webhook-handlers/**,push.ts,reviews.ts,loyalty.ts,subscriptions.ts,saas-tenants.ts,erpnext-sync.ts,admin-handlers.ts}`, `worker/src/tree/{loyalty/spend-cashback-handler.ts,subscriptions/**}`, `worker/src/lib/validators/subscription.ts` | Completed |
| **Phase 04** | [phase-04-domain-payment-order-catalog-crm-customer.md](phase-04-domain-payment-order-catalog-crm-customer.md) | Domain Payment, Order, Catalog, CRM, Customer & Payment Tests | `packages/domain/{payment,order,catalog,crm,customer}/**`, `worker/src/__tests__/routes/{payments.test.ts,admin-payments-stuck.test.ts}` | Completed |
| **Phase 05** | [phase-05-domain-staff-shift-table-reservation-kitchen-audit.md](phase-05-domain-staff-shift-table-reservation-kitchen-audit.md) | Domain Staff, Shift, Table, Reservation, Kitchen, Inventory, Audit & Notification | `packages/domain/{staff,shift,table,reservation,kitchen,inventory,audit,notification,integration}/**` | Completed |

---

## 3. Verification & Quality Gates

1. `npm run check:contrast --silent` → 11/11 WCAG 2.1 AA pairs PASS
2. `npm run typecheck:all` → 0 TypeScript errors across root and worker
3. `npm run lint --silent` → 0 ESLint errors
4. `npx vitest run --reporter=dot` → 100% test suites passing
5. `npm run build --silent` → clean production bundle
