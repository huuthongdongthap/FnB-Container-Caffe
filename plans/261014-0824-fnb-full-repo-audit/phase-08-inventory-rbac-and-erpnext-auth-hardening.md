# Phase 08: Inventory RBAC Privilege Escalation Fix, ERPNext Route Auth & Contact Error Sanitization

## Context Links
- Master Plan: [plan.md](plan.md)
- Feature Routes: [worker/src/routes/features-router.ts](../../worker/src/routes/features-router.ts)
- Integration Routes: [worker/src/routes/integrations-router.ts](../../worker/src/routes/integrations-router.ts)
- Contact Route: [worker/src/routes/contact.ts](../../worker/src/routes/contact.ts)
- Inventory Integration Tests: [worker/src/__tests__/integration/admin-revenue-inventory.test.ts](../../worker/src/__tests__/integration/admin-revenue-inventory.test.ts)

---

## Overview
- **Priority:** P1 High
- **Current Status:** Complete
- **Description:** Close the RBAC privilege escalation vulnerability on `/api/inventory/items` (which permitted `customer` tokens full CRUD/transaction/snapshot access while blocking `manager`), enforce `requireAuth(['owner', 'manager', 'staff'])` on `/api/erpnext-pos/*` and `/api/erpnext-invoices/*`, and sanitize raw D1 error leakage on `POST /api/contact`.

---

## Key Insights
1. **Customer Privilege Escalation on `/api/inventory/items` (P1):**
   - `worker/src/routes/features-router.ts:155` configured `inventoryItemsApp.use('/*', requireAuth(['owner', 'staff', 'customer']))`.
   - Any authenticated `customer` could read supplier/cost data and mutate/delete inventory items, transactions, and snapshots, while `manager` was rejected with HTTP 403.
   - Aligning with `openApiInventoryRouter` (`['owner', 'manager', 'staff']`) closes the privilege escalation and restores `manager` access.
2. **Unauthenticated `/api/erpnext-pos/*` and `/api/erpnext-invoices/*` Mounts (P1):**
   - `worker/src/routes/integrations-router.ts:24-27` only guarded `/api/erpnext/*` with `requireAuth(['owner'])`, leaving `/api/erpnext-pos/*` and `/api/erpnext-invoices/*` unauthenticated on the main Hono router.
   - Adding `requireAuth(['owner', 'manager', 'staff'])` middleware on `/api/erpnext-pos/*` and `/api/erpnext-invoices/*` protects invoice PII (`/list`), invoice creation, VAT updates, and POS sync while keeping `/api/public/products/:productId/availability` public.
3. **Raw SQLite Error Disclosure in `POST /api/contact` (P2):**
   - `worker/src/routes/contact.ts:62` interpolated `(error as Error).message` directly into the HTTP 500 response body.

---

## Implementation Steps
1. In `worker/src/routes/features-router.ts`:
   - Change `inventoryItemsApp.use('/*', requireAuth(['owner', 'staff', 'customer']))` to `inventoryItemsApp.use('/*', requireAuth(['owner', 'manager', 'staff']))`.
2. In `worker/src/routes/integrations-router.ts`:
   - Add `app.use('/api/erpnext-pos/*', requireAuth(['owner', 'manager', 'staff']))` and `app.use('/api/erpnext-invoices/*', requireAuth(['owner', 'manager', 'staff']))`.
3. In `worker/src/routes/contact.ts`:
   - Sanitize the HTTP 500 response message to `'Failed to submit contact message'`.
4. Add regression tests in `worker/src/__tests__/integration/admin-revenue-inventory.test.ts` and `worker/src/__tests__/routes/contact.test.ts`.

---

## Todo List
- [x] Fix `/api/inventory/items` RBAC in `worker/src/routes/features-router.ts` (`['owner', 'manager', 'staff']`)
- [x] Enforce `requireAuth(['owner', 'manager', 'staff'])` on `/api/erpnext-pos/*` and `/api/erpnext-invoices/*` in `worker/src/routes/integrations-router.ts`
- [x] Sanitize HTTP 500 error response in `worker/src/routes/contact.ts`
- [x] Add regression tests for inventory RBAC (`customer` 403, `manager` 200), ERPNext auth guard (401 unauthenticated), and contact 500 sanitization
- [x] Verify with `npm run lint`, `npm run typecheck:all`, `npm run verify:gates`, and `vitest`
