# Code Review: Phase 07 Odoo Cleanup

## Scope
- **Files deleted**: 22 (odoo routes, clients, mappers, admin UI, tests)
- **Files modified**: 6 (index.js, cron.js, loyalty.js, orders.js, integration.test.js, erpnext-invoices.js)
- **Type**: Cleanup / migration phase
- **Reviewed files**: All 6 modified files

## Overall Assessment

The core 5 modified files are clean — no Odoo imports remain in index.js, cron.js, loyalty.js, or orders.js. The erpnext-invoices.js scope fix is correct. However, the cleanup is **incomplete**. A pre-existing file (`customers.js`) was missed and still queries Odoo tables. The integration test is stale. The schema is out of sync with production code.

**Verdict**: Mergeable with caveats, but 2 blocking issues require follow-up.

---

## Critical Issues

### C1. `customers.js` still queries `odoo_mappings` table (pre-existing, not cleaned up)

**File**: `worker/src/routes/customers.js`, line 51
**Status**: NOT in the 5 modified files, but represents incomplete cleanup

The `getAdminCustomers` function performs:
```sql
LEFT JOIN odoo_mappings m ON m.local_id = c.id AND m.local_type = 'customer'
```
and returns `odoo_synced`, `odoo_id`, `odoo_sync_status`, `odoo_last_synced` fields.

The code has a TODO comment on line 69 acknowledging the issue:
```js
// TODO Phase 05: Populate from erpnext_mappings join when table is renamed
```

**Impact**: After migration 004 (`scripts/migrations/004-rename-odoo-to-erpnext.sql`) is applied, `odoo_mappings` will be renamed to `erpnext_mappings`, making this query fail at runtime. The `/api/admin/customers` endpoint will throw a SQL error.

Additionally, line 48 references `c.consent_odoo_sync` which may not match the `consent_erpnext_sync` column used by the ERPNext CRM code (`erpnext.js` line 55).

**Fix**: Update the query to `LEFT JOIN erpnext_mappings` and use `consent_erpnext_sync`. This is a Phase 05 deferred item that should be completed before or alongside migration 004.

### C2. Integration test tests deleted Odoo code paths

**File**: `tests/integration.test.js`

The test suite still describes itself as "Order -> Payment -> **Odoo** -> Loyalty" (line 158). It still:
- Mocks `odoo_mappings` and `odoo_sync_logs` tables (lines 23, 73-74)
- Sets Odoo env vars (lines 146-149: `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`)
- Runs "Step 3: Odoo Invoice Sync" tests (lines 232-251)
- Runs "Step 6: Odoo Retry Queue" tests (lines 310-339)
- Asserts schema contains `odoo_mappings` and `odoo_sync_logs` (lines 378-393)

**Impact**: These tests pass trivially because the mock D1 handles any SQL against any table name — they test nothing real. If migration 004 is applied and `odoo_mappings` is renamed, schema assertions on lines 382 and 391 will fail.

**Fix**: Rename test suite to reference ERPNext. Replace `odoo_mappings` / `odoo_sync_logs` table references with `erpnext_mappings` / `erpnext_sync_logs`. Update Odoo env vars to ERPNext equivalents. Update schema assertions (lines 378-393) to verify `erpnext_mappings` / `erpnext_sync_logs` instead.

---

## High Priority

### H1. Schema is out of sync with code

**File**: `worker/schema.sql`, lines 580-640

The schema still defines `odoo_mappings`, `odoo_invoices`, `odoo_sync_logs`, and `odoo_product_sync` tables with Odoo-named columns. The production code (erpnext-invoices.js, erpnext.js, erpnext-pos.js, erpnext-accounting-client.js, loyalty.js) all reference `erpnext_mappings` and `erpnext_invoices`.

If D1 was initialized from `schema.sql` and migration 004 has NOT been applied, all ERPNext routes would fail because `erpnext_mappings` doesn't exist. Conversely, if migration 004 WAS applied, `customers.js` breaks (see C1).

**Recommendation**: Update `schema.sql` to define `erpnext_mappings`, `erpnext_invoices`, `erpnext_sync_logs` directly (or apply migration 004 consistently and delete the old migration scripts 001-003).

---

## Medium Priority

### M1. ERPNext stubs in cron.js are safe no-ops

**File**: `worker/src/routes/cron.js`, lines 8-15

The `processErpnextRetryQueue` and `processErpnextProductSync` functions are now stubs that log "not configured" and return zero counts. This is safe — they won't throw errors. However, these stubs are called from the `scheduled` export in `index.js` on every cron tick, generating a log line each time. This may create noise in production logs.

### M2. Loyalty.js ERPNext tier tag sync path is intact

**File**: `worker/src/routes/loyalty.js`, lines 769-795

The ERPNext tier tag sync block (fire-and-forget IIFE) was preserved. It correctly:
- Checks `erpnext_mappings` for customer mapping (not `odoo_mappings`)
- Checks `consent_erpnext_sync` consent (not `consent_odoo_sync`)
- Uses `erpnext-crm-client.js` (not the deleted `odoo-crm-client.js`)

No regression. The Odoo tier tag sync block was properly removed (the deleted lines 769-794 were the Odoo equivalent).

### M3. Orders.js ERPNext invoice trigger path is intact

**File**: `worker/src/routes/orders.js`, lines 399-419

The ERPNext invoice trigger correctly imports `createErpnextInvoice` from `./erpnext-invoices.js`. The Odoo invoice trigger was properly removed. No regression.

---

## Verified Correct

### V1. erpnext-invoices.js scope fix

**File**: `worker/src/routes/erpnext-invoices.js`, line 100

```js
let orderId;  // declared at function scope (was: inside try block)
try {
  const body = await request.json();
  orderId = body.orderId;  // assigned inside try
  // ...
} catch (error) {
  if (orderId) {  // NOW accessible in catch
    await markMappingFailed(env, orderId, error.message);
  }
}
```

The fix is correct. Without it, `orderId` scoped inside `try` would be undefined in `catch`, causing `markMappingFailed` to silently fail. The `let` declaration with assignment inside `try` is the standard pattern for this scenario.

### V2. All 5 claimed modified files are free of Odoo imports

- `worker/src/index.js` — No Odoo imports, routes, or cron references remain.
- `worker/src/routes/cron.js` — No Odoo client imports or Odoo sync functions remain.
- `worker/src/routes/loyalty.js` — Odoo tier tag sync removed; ERPNext path preserved.
- `worker/src/routes/orders.js` — Odoo invoice trigger removed; ERPNext path preserved.
- `worker/src/routes/erpnext-invoices.js` — Scope fix only, no Odoo references were present.

### V3. Build and tests pass

- `npm run build`: 0 errors (confirmed by task description)
- Tests: 19 suites, 645 tests, 0 failures (confirmed by task description)

### V4. No dangling imports to deleted modules

Grepped for Odoo imports in all worker/src/*.js files — no broken imports to the 22 deleted files were found outside of `customers.js` which references a table name, not a deleted module.

---

## Recommended Actions

1. **BLOCKING**: Fix `customers.js` to use `erpnext_mappings` and `consent_erpnext_sync` before or alongside migration 004 application.
2. **BLOCKING**: Update integration test to reference ERPNext instead of Odoo (tables, env vars, test names, schema assertions).
3. **Important**: Update `worker/schema.sql` to define ERPNext-named tables; delete or mark migrations 001-003 as applied.
4. **Optional**: Consider adding ERPNext env var configuration checks to the cron stubs to reduce log noise (currently logs on every cron tick).

---

## Edge Cases Found

| # | Issue | Severity |
|---|-------|----------|
| E1 | What happens if migration 004 is applied before C1/C2 are fixed? `customers.js` query breaks, integration test schema assertions fail. | Critical |
| E2 | What if `consent_odoo_sync` column doesn't exist on the `customers` table? The column is not in `schema.sql` anywhere — must have been added by a migration not found in the repo. | High |
| E3 | What if `DB` is used but not `AURA_DB`? The ERPNext stubs don't access the DB at all (no-ops), so no risk. | None |

---

## Metrics

- Files reviewed: 6 modified + 2 dependency scans (schema.sql, remaining source)
- Critical issues: 2 (customers.js Odoo table refs, integration test staleness)
- High issues: 1 (schema out of sync)
- Medium issues: 3
- Verified correct items: 4
