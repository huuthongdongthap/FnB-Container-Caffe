# Odoo Full Suite Integration — Execution Plan

**Created:** 2026-06-27 14:13 ICT | **Updated:** 2026-06-30 19:19 ICT
**Branch:** main
**Status:** ✅ Phase 1-3 Complete

---

## Overview

Odoo 16 integration delivered across all 3 phases. Code ready for production — needs real Odoo credentials and VAT provider for E2E verification.

**Total effort:** ~35h | **Outcome:** 14 source files, 10 test suites, 859 tests pass, 0 lint errors

---

## Phase Status

| # | Phase | Effort | Status | Key Deliverables |
|---|-------|--------|--------|------------------|
| 1 | Accounting/E-invoicing | 8h | ✅ Complete | OdooClient, invoice routes, cron retry, admin sync failures, D1 tables |
| 2 | POS Integration | 7h | ✅ Complete | ProductClient, KV cache, sales mapper, availability API, migrations |
| 3 | CRM Sync | 5h | ✅ Complete | CrmClient, loyalty tags, leads API, consent gate, migrations |

---

## Phase 1: Accounting/E-invoicing — ✅ Delivered

### Completed
1. `worker/src/clients/odoo-client.js` — OdooClient base class: JSON-RPC 2.0, auth caching, retry with exponential backoff (max 3)
2. `worker/src/clients/odoo-accounting-client.js` — order → invoice processing, PDF generation placeholder
3. `worker/src/routes/odoo-invoices.js` — `POST/GET /api/odoo/invoices`, `POST /api/odoo/invoices/:orderId/retry`
4. `worker/src/routes/odoo.js` — fire-and-forget Odoo trigger on order completion
5. `worker/src/routes/cron.js` — enhanced retry queue with Odoo sync logging
6. Admin routes — Odoo sync failure management, view/replay UI
7. D1 migrations — `odoo_mappings`, `odoo_invoices`, `odoo_sync_logs` tables
8. ADR 0013 — Odoo accounting integration pattern documented

### Pending (needs external credentials)
- VAT submission via VNPT/VNInvoice API — stub exists, needs real provider credentials
- PDF invoice generation — placeholder implemented, needs template finalization

---

## Phase 2: POS Integration — ✅ Delivered

### Completed
1. `worker/src/clients/odoo-product-client.js` — availability lookup with KV caching (30s TTL), `searchChangedProducts()` delta sync, `syncProductsToLocal()` batch upsert, `updateOdooProduct()` with field whitelist + cache invalidation
2. `worker/src/lib/odoo-sales-mapper.js` — `mapOrderToSaleOrder()`, `mapOrderItemToSaleOrderLine()`, `mapCustomerToOdooPartner()`
3. `worker/src/routes/odoo-pos.js` — `POST /api/odoo/sales-orders` (idempotent), `GET /api/odoo/products/:productId/availability` (KV-cached), `POST /api/odoo/products/sync` (delta sync)
4. Migration 002 — `odoo_product_sync` + `odoo_sync_failures` tables
5. ADR 0014 — Odoo POS/Product sync pattern documented
6. All tests pass (real implementations, no `xdescribe` stubs)

---

## Phase 3: CRM Sync — ✅ Delivered

### Completed
1. `worker/src/clients/odoo-crm-client.js` — `createLead()`, `updatePartner()`, `addTag()`, `removeTag()`, `getPartnerInfo()`
2. `worker/src/lib/odoo-mapper.js` — `mapLoyaltyTier()`: bronze→Bronze Member, silver→Silver, gold→Gold, platinum→VIP
3. `worker/src/routes/odoo.js` — `POST /api/odoo/leads` (consent-aware), `GET /api/odoo/customers/:customerId/notes`, `POST /api/odoo/customers/:customerId/tags`
4. Migration 003 — `odoo_customer_consent` table for GDPR/tuân thủ
5. ADR 0015 — Odoo CRM sync pattern documented
6. All tests pass (real implementations, no `xdescribe` stubs)

---

## Architecture Decisions (3 ADRs)

| ADR | Title | Key Decision |
|-----|-------|-------------|
| 0013 | Odoo Accounting Integration | Fire-and-forget with retry queue, JSON-RPC, non-blocking |
| 0014 | Odoo POS/Product Sync | Delta polling (15min) + webhook hybrid, KV cache for hot products |
| 0015 | Odoo CRM Customer Sync | Event-driven with consent gate, one-way D1→Odoo, tag-based tiers |

---

## Remaining Work (Requires External Credentials)

| Item | Dependency | Effort | Priority |
|------|-----------|--------|----------|
| VAT API integration (VNPT/VNInvoice) | Provider credentials + API docs | 4h | High |
| Real Odoo credential testing | Odoo 16 instance URL, API key | 3h | High |
| E2E verification with live Odoo | Real Odoo + VAT credentials | 4h | High |
| PDF invoice template finalization | Design sign-off | 2h | Medium |

---

## Test Coverage

| Test Suite | Files | Status |
|-----------|-------|--------|
| Odoo client base | `tests/odoo-client.test.js` | ✅ Pass |
| Odoo mapper | `tests/odoo-mapper.test.js` | ✅ Pass |
| Odoo sales mapper | `tests/odoo-sales-mapper.test.js` | ✅ Pass |
| Odoo product client | `tests/odoo-product-client.test.js` | ✅ Pass |
| Odoo CRM client | `tests/odoo-crm-client.test.js` | ✅ Pass |
| Odoo CRM mapper | `tests/odoo-crm-mapper.test.js` | ✅ Pass |
| Odoo integration | `tests/odoo-integration.test.js` | ✅ Pass |
| Odoo POS integration | `tests/odoo-pos-integration.test.js` | ✅ Pass |
| Odoo CRM sync | `tests/odoo-crm-sync.test.js` | ✅ Pass |
| Odoo order-cron integration | `tests/odoo-order-cron-integration.test.js` | ✅ Pass |

**Total:** 859 tests pass across project, 0 lint errors

---

## Success Criteria — ✅ Met

- [x] All `odoo-*.test.js` tests pass (no `xdescribe` stubs)
- [x] `npm run lint` clean on modified files
- [x] `npm run build` passes
- [x] 3 ADRs written documenting architecture decisions
- [x] No console errors in integration flow
