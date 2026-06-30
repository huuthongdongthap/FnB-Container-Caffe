# Phase 03 — Refactor Lib Mappers + Cron

**Priority:** P1 | **Status:** done | **Effort:** 6h | **Depends:** Phase 02

## Files to CREATE

| New File | Based On | Lines |
|----------|----------|-------|
| `worker/src/lib/erpnext-mapper.js` | `odoo-mapper.js` | 661 |
| `worker/src/lib/erpnext-sales-mapper.js` | `odoo-sales-mapper.js` | 150 |
| `worker/src/lib/erpnext-crm-mapper.js` | `odoo-crm-mapper.js` | 47 |

## Field Mapping Changes

| Odoo Field | ERPNext Field | Notes |
|-----------|--------------|-------|
| `partner_id` | `customer` | Customer link |
| `invoice_line_ids` | `items[]` | Child table |
| `account.move` | `Sales Invoice` | Doctype name |
| `sale.order` | `Sales Order` | Doctype name |
| `product.product` | `Item` | Doctype name |
| `res.partner` | `Customer` | Doctype name |
| `crm.lead` | `Lead` | Doctype name |
| `tag_ids` (many2many) | `_user_tags` or Tag doctype | Tags different in ERPNext |
| `x_vat_submission_status` | Custom field (same name) | Keep custom field |

## Cron Refactoring

In `worker/src/routes/cron.js`:
- `processOdooRetryQueue` → `processErpnextRetryQueue` (rename + switch to ERPNext client)
- `processOdooProductSync` → `processErpnextProductSync` (rename + ERPNext product client)
- `logOdooSyncAttempt` → `logErpnextSyncAttempt` (rename)
- KV key: `odoo_product_last_sync` → `erpnext_product_last_sync`

## TDD Tests

- Write `tests/erpnext-mapper.test.js` — rewrite of `odoo-mapper.test.js` (909 lines)
- Write `tests/erpnext-sales-mapper.test.js` — rewrite of `odoo-sales-mapper.test.js` (275 lines)
- Write `tests/erpnext-crm-mapper.test.js` — rewrite of `odoo-crm-mapper.test.js` (129 lines)
- Update `tests/erpnext-order-cron-integration.test.js` — rename from odoo version

## Verification

- [ ] All mapper tests pass with ERPNext field mappings
- [ ] Cron tests pass with renamed functions
- [ ] No regression in existing tests
