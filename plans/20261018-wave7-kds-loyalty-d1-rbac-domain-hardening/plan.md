# Plan: Wave 7 — KDS, Loyalty, D1 Fallbacks, OpenAPI RBAC & Domain Invariants

**Date**: 2026-10-18
**Work Context**: `/Users/mac/mekong-cli/FnB-Container-Caffe`
**Mode**: `/bootstrap-auto-parallel` → `/brainstorm --deep` → `/plan` → `/cook --auto --parallel`
**Brainstorm Report**: [reports/brainstorm-20261018-wave7-deep-audit.md](reports/brainstorm-20261018-wave7-deep-audit.md)
**Status**: In Progress

---

## 1. Strategic Overview

| Track | Focus Area | Key Outcome |
| :--- | :--- | :--- |
| **Track 1** | Frontend KDS, Loyalty, Mobile & Admin Flows | Working `/api/checkin` & phone check-in, KDS `'ready'`/`'confirmed'`/`'overdue'` ticket handling, mobile waiter modifier & table selection fixes, unwrapped `DinDinCheckout` & `invoice-history-table`, synced `RangeSelector`/`PerformanceSection`, negative inventory adjustments, awaited `TableReservation`, and query-param `TrackOrder`. |
| **Track 2** | Worker Feature Routes, Auth, QR, Chat & Realtime Sync | Canonical D1 fallbacks across `guest-handlers`, `floor-plan`, `table-sessions`, `notifications-mobile`, `admin-qr`, `dindin`, `chat`, `recruitment`, `loyalty`, `customers`, `reports`, `cron`; auth & revocation guards on `checkin`, `birthday`, `loyalty/lookup`, `push/unsubscribe`, `chat`, `referrals`; full RBAC & `publishOrderEvent` parity. |
| **Track 3** | Worker OpenAPI Handlers D1 & RBAC Hardening | Safe `audit_logs` & canonical D1 table/column fallbacks across `openapi-{products,tables,orders,staff,inventory,loyalty,promotions,payments,auth,cron}-handlers`, null-safe `idempotencyKey` binds, string year bind for birthday bonus, and RBAC guards on promotions & payments. |
| **Track 4** | Domain Catalog, CRM, Order, Payment & Customer | `products` ↔ `menu_items` fallbacks & category-aware Happy Hour in `catalog`, resilient `accrual`/`lookupByPhone`/`referral`/`refund-reversal`/`segments` in `crm`, paid-only `creditLoyaltyIfEligible` & post-insert broadcaster in `order`, idempotent `momo-create` & `nowpayments-ipn` in `payment`, and safe wallet merge & recursive sanitization in `customer`. |
| **Track 5** | Domain Inventory, Kitchen, Table, Shift, Staff, Security & Tests | BOM + SKU inventory deduction/restoration & negative `adjust` schema, `confirmed -> preparing -> ready` & `'ready'` KDS stream with timer cleanup, case-insensitive table transitions, `cash-reconciliation-policy` & `staff-tips` D1 fallbacks, full `StaffRole` in `security-policy` & `staff-auth`, canonical `notification_audit_log`, internal status mapping in `integration-boundary-policy`, and real assertions in `worker/src/__tests__/**`. |

---

## 2. Parallel Execution Phases & Strict File Ownership

| Phase | File | Scope | File Ownership (Strict Non-Overlapping) | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Phase 01** | [phase-01-frontend-kds-loyalty-admin-customer-flows.md](phase-01-frontend-kds-loyalty-admin-customer-flows.md) | Frontend KDS, Loyalty, Mobile & Admin | `src/**` | Pending |
| **Phase 02** | [phase-02-worker-guest-floorplan-qr-chat-loyalty-routes.md](phase-02-worker-guest-floorplan-qr-chat-loyalty-routes.md) | Worker Feature Routes, Tree & Lib | `worker/src/routes/{orders-hono-handlers/**,floor-plan.ts,table-sessions-handlers/**,notifications-mobile.ts,admin-qr.ts,dindin-handlers/**,chat.ts,recruitment.ts,pos-customer.ts,loyalty.ts,checkin.ts,birthday.ts,referrals.ts,push.ts,customers-handlers/**,reports-handlers/**,cron-handlers/**,webhooks-handlers/**,orders-unified.ts,staff-mobile.ts,orders-mobile.ts,tables-mobile.ts,refunds-handlers/**,crm-handlers/**,features-router.ts,analytics-handlers/**}`, `worker/src/tree/{qr/**,loyalty/**}`, `worker/src/lib/{audit-logger.ts,validators/customer.ts}` | Pending |
| **Phase 03** | [phase-03-worker-openapi-handlers-d1-rbac-hardening.md](phase-03-worker-openapi-handlers-d1-rbac-hardening.md) | Worker OpenAPI Handlers | `worker/src/routes/openapi-{products,tables,orders,staff,inventory,loyalty,promotions,payments,auth,cron}-handlers/**` | Pending |
| **Phase 04** | [phase-04-domain-catalog-crm-order-payment-customer.md](phase-04-domain-catalog-crm-order-payment-customer.md) | Domain Catalog, CRM, Order, Payment & Customer | `packages/domain/{catalog,crm,order,payment,customer}/**` | Pending |
| **Phase 05** | [phase-05-domain-inventory-kitchen-table-shift-staff-security-tests.md](phase-05-domain-inventory-kitchen-table-shift-staff-security-tests.md) | Domain Inventory, Kitchen, Table, Shift, Staff, Security, Notification, Integration & Tests | `packages/domain/{inventory,kitchen,table,shift,staff,security,notification,integration}/**`, `worker/src/__tests__/**` | Pending |

---

## 3. Verification & Quality Gates

1. `npm run check:contrast --silent` → 11/11 WCAG 2.1 AA pairs PASS
2. `npm run typecheck:all` → 0 TypeScript errors across root and worker
3. `npm run lint --silent` → 0 ESLint errors
4. `npx vitest run --reporter=dot` → 100% test suites passing
5. `npm run build --silent` → clean production bundle
