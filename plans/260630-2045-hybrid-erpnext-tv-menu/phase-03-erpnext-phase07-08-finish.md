# Phase 03 — ERPNext Phase 07-08 Finish (10h)

**Status:** partial — Phase 07 complete, Phase 08 blocked (needs ERPNext credentials)
**Priority:** Critical
**TDD:** N/A — covered by existing 904 tests + Phase 08 E2E

## Overview

Complete remaining ERPNext migration phases when instance is provisioned.

## Prerequisites

- ERPNext instance running (from Phase 01 research output)
- ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET set in CF Worker env

## Sub-Phases

### 03a — Phase 07: Odoo Cleanup (2h)

Delete old Odoo files. Safe to do after ERPNext E2E verification.

**Files to delete (~22):**
- worker/src/routes/odoo.js
- worker/src/routes/odoo-pos.js
- worker/src/routes/odoo-invoices.js
- worker/src/clients/odoo-client.js
- worker/src/clients/odoo-crm-client.js
- worker/src/clients/odoo-product-client.js
- worker/src/clients/odoo-accounting-client.js
- worker/src/lib/odoo-mapper.js
- worker/src/lib/odoo-sales-mapper.js
- worker/src/lib/odoo-crm-mapper.js
- admin/odoo-sync.html
- admin/odoo-sync.css
- tests/odoo-*.test.js (if any)
- index.js: remove Odoo imports + routes
- cron.js: remove Odoo wrapper re-exports
- loyalty.js: remove parallel Odoo block
- orders.js: remove parallel Odoo block

**Validation after cleanup:**
- Build passes
- Tests pass (Odoo-skipped tests will become dead code — remove or repurpose)
- No references to "odoo" remain in production code (grep -i odoo worker/src/)

### 03b — Phase 08: E2E Test with Real ERPNext (8h)

**Test cases:**
1. Product sync: create item in ERPNext → sync → verify in local DB
2. Invoice creation: complete order → verify Sales Invoice in ERPNext
3. CRM lead: customer signup → verify Lead in ERPNext
4. Product availability: check stock → verify response
5. Webhook: update item in ERPNext → verify sync trigger
6. Error handling: invalid API key → verify 503 response
7. Retry: simulate failed sync → manual retry → verify recovery
8. Idempotency: call createInvoice twice → verify no duplicate

**After E2E passes:**
- Run full test suite
- Deploy production
- Verify SHA match

## Success Criteria

- [x] Phase 07: 22 Odoo files deleted, 0 "odoo" references remain
- [ ] Phase 08: All 8 E2E test cases pass
- [ ] Tests: 910+ pass, 0 fail
- [ ] Deploy to production, SHA verified
- [x] CHANGELOG + ROADMAP updated

## Touchpoints

- Delete: ~22 Odoo files
- Modify: index.js, cron.js, loyalty.js, orders.js (remove Odoo references)
- Docs: CHANGELOG, ROADMAP

## Risk

- Odoo deletion irreversible — ensure git backup before
- If ERPNext instance unstable, defer Phase 07
- Database migration (004-rename-odoo-to-erpnext.sql) must run after E2E pass
