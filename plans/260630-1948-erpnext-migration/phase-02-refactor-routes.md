# Phase 02 — Refactor Routes (odoo*.js → erpnext*.js)

**Priority:** P0 | **Status:** done | **Effort:** 8h | **Depends:** Phase 01

## Overview

Refactor all Odoo route files to ERPNext. New file naming: `erpnext*.js`. Keep old files during migration.

## TDD: Write tests first

### New test files
- `tests/erpnext-invoices.test.js` — rewrite of `odoo-integration.test.js` (681 lines)
- `tests/erpnext-pos-integration.test.js` — rewrite of `odoo-pos-integration.test.js` (30 lines)

### Files to CREATE

| New File | Based On | Key Changes |
|----------|----------|-------------|
| `worker/src/routes/erpnext.js` | `odoo.js` (431L) | Rename all exports, `/api/erpnext/*` paths, ERPNext client calls |
| `worker/src/routes/erpnext-pos.js` | `odoo-pos.js` (321L) | Rename exports, `/api/erpnext/products/*`, ERPNext product client |
| `worker/src/routes/erpnext-invoices.js` | `odoo-invoices.js` (377L) | Rename exports, ERPNext Sales Invoice creation |

### Files to MODIFY

| File | Changes |
|------|---------|
| `worker/src/routes/cron.js` | Rename: `processOdooRetryQueue`→`processErpnextRetryQueue`, `processOdooProductSync`→`processErpnextProductSync` |
| `worker/src/routes/customers.js` | Field renames in `getAdminCustomers()`: `odoo_synced`→`erpnext_synced`, etc. SQL: `odoo_mappings`→`erpnext_mappings` |
| `worker/src/routes/loyalty.js` | Fire-and-forget block: import `createErpnextCrmClient`, query `erpnext_mappings` |
| `worker/src/routes/orders.js` | Dynamic import: `createErpnextInvoice` from `./erpnext-invoices.js` |
| `worker/src/index.js` | Import renames, route registrations `/api/erpnext/*`, new `app.use('/api/erpnext/*', requireAuth(['owner']))` |

### API Path Changes

| Old | New |
|-----|-----|
| `/api/odoo/invoices` | `/api/erpnext/invoices` |
| `/api/odoo/invoices/:orderId` | `/api/erpnext/invoices/:orderId` |
| `/api/odoo/invoices/:orderId/retry` | `/api/erpnext/invoices/:orderId/retry` |
| `/api/odoo/sales-orders` | `/api/erpnext/sales-orders` |
| `/api/odoo/products/sync` | `/api/erpnext/products/sync` |
| `/api/odoo/leads` | `/api/erpnext/leads` |
| `/api/odoo/customers/:id/notes` | `/api/erpnext/customers/:id/notes` |
| `/api/odoo/customers/:id/tags` | `/api/erpnext/customers/:id/tags` |
| `/api/odoo/sync-failures` | `/api/erpnext/sync-failures` |
| `/api/odoo/retry/:mappingId` | `/api/erpnext/retry/:mappingId` |
| `/api/webhooks/odoo` | `/api/webhooks/erpnext` |
| `/api/public/products/:id/availability` | unchanged (public) |

## Verification

- [ ] All new ERPNext route tests pass
- [ ] All old Odoo route tests still pass (haven't deleted yet)
- [ ] `npm run build` 0 errors
- [ ] All 859 tests pass
