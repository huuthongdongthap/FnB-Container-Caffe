# Phase 07 — Integration Test + Cleanup + Verify

**Priority:** P0 | **Status:** skipped | **Effort:** 5h | **Depends:** Phase 01-06

## Overview

Delete old Odoo files, run full test suite, verify 0 regressions, cleanup.

## Cleanup: Delete Old Odoo Files

| Action | File |
|--------|------|
| DELETE | `worker/src/clients/odoo-client.js` |
| DELETE | `worker/src/clients/odoo-crm-client.js` |
| DELETE | `worker/src/clients/odoo-product-client.js` |
| DELETE | `worker/src/clients/odoo-accounting-client.js` |
| DELETE | `worker/src/routes/odoo.js` |
| DELETE | `worker/src/routes/odoo-pos.js` |
| DELETE | `worker/src/routes/odoo-invoices.js` |
| DELETE | `worker/src/lib/odoo-mapper.js` |
| DELETE | `worker/src/lib/odoo-sales-mapper.js` |
| DELETE | `worker/src/lib/odoo-crm-mapper.js` |
| DELETE | `tests/odoo-client.test.js` |
| DELETE | `tests/odoo-crm-client.test.js` |
| DELETE | `tests/odoo-product-client.test.js` |
| DELETE | `tests/odoo-mapper.test.js` |
| DELETE | `tests/odoo-sales-mapper.test.js` |
| DELETE | `tests/odoo-crm-mapper.test.js` |
| DELETE | `tests/odoo-integration.test.js` |
| DELETE | `tests/odoo-pos-integration.test.js` |
| DELETE | `tests/odoo-order-cron-integration.test.js` |
| DELETE | `tests/odoo-crm-sync.test.js` |
| DELETE | `admin/odoo-sync.html` (replaced by erpnext-sync.html) |
| DELETE | `admin/odoo-sync.css` (replaced by erpnext-sync.css) |

## Update Import References

In `worker/src/index.js`:
- Remove ALL old Odoo imports
- Confirm only ERPNext imports remain
- Remove deprecated `/api/odoo/*` redirects if added

In `worker/src/routes/orders.js`:
- Confirm `createErpnextInvoice` import (not old `createOdooInvoice`)

In `worker/src/routes/loyalty.js`:
- Confirm `createErpnextCrmClient` import (not old `createOdooCrmClient`)

## Full Test Suite

```bash
npm test              # MUST pass 100%
npm run lint          # MUST 0 errors
npm run build         # MUST 0 errors (if build step exists)
```

## Final Verification Checklist

- [ ] Zero `import.*odoo` in any source file (grep -rn "odoo" worker/src/)
- [ ] Zero `require.*odoo` in any test file (grep -rn "odoo" tests/)
- [ ] All `/api/erpnext/*` routes registered in index.js
- [ ] All ERPNext env vars in wrangler.toml
- [ ] All `odoo_*` D1 tables renamed to `erpnext_*`
- [ ] 859+ tests pass (new ERPNext tests add to count)
- [ ] 0 lint errors
- [ ] 0 TypeScript/type errors
