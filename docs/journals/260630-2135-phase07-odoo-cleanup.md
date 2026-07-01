# Journal — Phase 07 Odoo Cleanup

**Date:** 2026-06-30 21:17–21:35
**Context:** ERPNext migration Phase 07 of 08. User chose to unblock ERPNext by executing Phase 07 (Odoo cleanup) now, deferring Phase 08 (E2E) until ERPNext instance provisioned.

## What happened
- Deleted 22 Odoo files across routes, clients, lib, admin, tests
- Cleaned Odoo imports/routes from index.js (4 import blocks, 9 routes removed)
- Stripped processOdooRetryQueue, processOdooProductSync, logOdooSyncAttempt from cron.js (~170 lines removed). Replaced ERPNext wrappers with no-op stubs (ERPNext not configured yet)
- Removed Odoo fire-and-forget blocks from loyalty.js (tier tag sync) and orders.js (invoice trigger). Both ERPNext paths preserved and working
- Fixed pre-existing orderId scope bug in erpnext-invoices.js (C6 from previous review — `const` in try block not accessible in catch)
- Updated customers.js JOIN from odoo_mappings → erpnext_mappings (CRITICAL: was still querying deleted table)
- Updated integration.test.js to ERPNext naming (tables, env vars, test names, schema checks)
- Added erpnext_mappings + erpnext_sync_logs tables to schema.sql (production code already used them)

## Results
- Build: 0 errors
- Tests: 19 suites, 645 pass, 0 fail
- 0 Odoo references in worker/src/
- Code review: 2 critical issues found (customers.js stale Odoo references, integration test stale) — both fixed before finalize

## Key decisions
- Phase 07 executed without Phase 08 E2E verification. Rationale: ERPNext code (Phases 01-06) already committed, tests pass, Odoo code was dead. Risk accepted as low
- ERPNext cron stubs are no-ops — they log "not configured" and return empty results. Will be replaced when ERPNext credentials provided
- Odoo tables kept in schema.sql alongside new ERPNext tables — migration 004 will clean them up later

## Blockers
- Phase 08 E2E: blocked until ERPNext instance provisioned with ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET
- Commit blocked by CLEO hook requiring task ID — user to commit manually
