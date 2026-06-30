# Phase 04 — Refactor Frontend + Admin UI

**Priority:** P1 | **Status:** done | **Effort:** 4h | **Depends:** Phase 02

## Files to MODIFY

### `js/checkout/cart-summary.js` (235 lines)
- URL unchanged (`/api/public/products/:id/availability`) — only backend changes, frontend transparent
- Verify `checkAvailability()` works with renamed backend

### `admin/odoo-sync.html` → RENAME to `admin/erpnext-sync.html`
- Title: "Odoo Sync Failures" → "ERPNext Sync Failures"
- API calls: `/api/odoo/sync-failures` → `/api/erpnext/sync-failures`
- API calls: `/api/odoo/invoices/:id/retry` → `/api/erpnext/invoices/:id/retry`
- CSS: `../css/odoo-sync.css` → `../css/erpnext-sync.css`

### `admin/customers.html` (259 lines)
- Title: "Khách hàng — Odoo CRM" → "Khách hàng — ERPNext CRM"
- API: `/api/odoo/customers/:id/notes` → `/api/erpnext/customers/:id/notes`
- Detail panel: "Partner ID" → "ERPNext Customer ID"

### `admin/odoo-sync.css` → RENAME to `admin/erpnext-sync.css`
- No CSS changes needed — just rename file

### `admin/orders.html` — minor
- Check for Odoo references, update if found

## TDD Tests

- Update `tests/checkout.test.js` — verify availability check still works (no URL change needed)
- Update any admin page tests

## Verification

- [ ] Frontend checkout stock badges still work
- [ ] Admin ERPNext sync page loads with new URL
- [ ] Admin customers page shows ERPNext CRM data
- [ ] No broken links/images
