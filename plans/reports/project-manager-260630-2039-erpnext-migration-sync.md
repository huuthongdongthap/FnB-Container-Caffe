# Project Management Sync — ERPNext Migration

**Date:** 2026-06-30T20:39+07:00
**Plan:** plans/260630-1948-erpnext-migration/plan.md
**Source:** User status summary + codebase verification

---

## 1. Progress Against Plan

| # | Phase | Planned | Actual | Delta |
|---|---|---|---|---|
| 01 | ERPNext client TDD | 8h | done | OK |
| 02 | Refactor routes (odoo*.js -> erpnext*.js) | 8h | done | OK |
| 03 | Refactor lib mappers + cron | 6h | done | OK |
| 04 | Refactor frontend + admin UI | 4h | done | OK |
| 05 | Database migrations + env config | 3h | done | OK |
| 06 | Docs + ADR rewrite | 3h | done | OK |
| 07 | Integration test + cleanup | 5h | skipped | Deferred to E2E |
| 08 | E2E with real ERPNext | 8h | blocked | Needs credentials |

**Total effort absorbed:** ~32h of 45h planned (70%)
**Tests:** 904 pass, 0 fail, 18 skipped
**Code review:** 4 CRITICAL + 5 HIGH/MEDIUM issues — ALL FIXED

## 2. Phase Details

### Phase 01 — ERPNext Client (done)
- Files: worker/src/clients/erpnext-client.js, tests/erpnext-client.test.js
- 45 tests covering CRUD, auth, retry, error classes, specific doctypes
- Factory: createErpnextClient(env) returns null on missing env vars

### Phase 02 — Routes (done)
- Files: worker/src/routes/erpnext.js, erpnext-pos.js, erpnext-invoices.js
- Modified: index.js (route registration), cron.js (rename functions), customers.js (field renames), loyalty.js (imports), orders.js (imports)
- 3 client wrappers created: erpnext-product-client.js, erpnext-accounting-client.js, erpnext-crm-client.js

### Phase 03 — Mappers (done)
- Files: worker/src/lib/erpnext-mapper.js, erpnext-sales-mapper.js, erpnext-crm-mapper.js
- Field mappings switched from Odoo (partner_id, invoice_line_ids) to ERPNext (customer, items[])
- Cron function renames: processOdooRetryQueue -> processErpnextRetryQueue, etc.

### Phase 04 — Admin UI (done)
- Files: admin/erpnext-sync.html, admin/erpnext-sync.css (new)
- Modified: admin/customers.html (ERPNext CRM), admin/orders.html (ERPNext sync link)

### Phase 05 — DB Migration (done)
- File: scripts/migrations/004-rename-odoo-to-erpnext.sql
- Renames tables: odoo_mappings -> erpnext_mappings, odoo_invoices -> erpnext_invoices, etc.
- Renames columns: odoo_id -> erpnext_id, etc.

### Phase 06 — Docs + ADR (done)
- Files: docs/06_ADR/0016-erpnext-accounting-integration.md, 0017-erpnext-pos-sync-pattern.md, 0018-erpnext-crm-sync-pattern.md
- Updated: docs/03_ARCHITECTURE.md
- Updated: docs/12_CHANGELOG.md

### Phase 07 — Cleanup (skipped)
- Odoo files still exist (all 10 test files + 4 client files + 3 route files + 2 lib mappers + 3 client wrappers + admin HTML/CSS)
- Deletion deferred until Phase 08 E2E verification passes
- Rationale: keep rollback path until real ERPNext instance confirmed working

### Phase 08 — E2E (blocked)
- Requires: ERPNext instance URL + API key + API secret
- Options: self-hosted (Raspberry Pi/VPS) or Frappe Cloud free trial
- Fallback: routes return 503 until configured, plan marked "Code Complete"

## 3. Blockers

| Blocker | Phase | Owner | Unblock Path |
|---|---|---|---|
| No ERPNext instance credentials | 08 | unassigned | Provision ERPNext (Docker/RPi/Frappe Cloud). Setup API key. Configure env vars. |

## 4. Scope Changes

| Change | Reason | Impact |
|---|---|---|
| Phase 07 skipped | Odoo deletion needs E2E verification first | Odoo files retained; no production impact since routes point to erpnext-* |
| Phase 01-05 -> 01-06 | Phase 06 completed as part of same workstream | Docs and ADRs are now current |
| Test count 859 -> 904 | 45 new ERPNext client tests added | Higher coverage, no regression |

## 5. Risks

| Risk | Status | Mitigation |
|---|---|---|
| ERPNext API breaking changes (v14 vs v15) | low | Client uses standard /api/resource/{doctype} — stable across versions |
| Odoo files deleted before E2E verification | deferred | Skipped Phase 07; files kept until live E2E passes |
| Fresh DB lacks ERPNext tables | low | Migration SQL exists; apply before first deploy |

## 6. Next Steps

1. **Phase 07 decision** — Capture user decision: delete Odoo files now or wait for Phase 08 E2E. Implementation plan exists in phase-07-integration-test-cleanup.md (22 file deletions + import cleanup).
2. **Phase 08 unblock** — Provision ERPNext instance:
   - Option A: Docker `docker run -d --name erpnext -p 8080:80 frappe/erpnext:v14`
   - Option B: Frappe Cloud 14-day free trial
   - Generate API key + secret in ERPNext
   - Set ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET in .env / wrangler.toml
3. **Run E2E tests** — Product sync, invoice creation, CRM lead creation, product availability, webhook
4. **Cleanup** — After E2E pass, execute Phase 07: delete Odoo files, update imports, run full test suite
5. **Deploy** — Apply migration SQL, deploy with `npm run deploy:full`, verify SHA match
6. **Mark plan complete** — Update plan status to "done" after successful deploy + E2E verification

## 7. Unresolved Questions

- Should Odoo files be deleted now (clean) or kept until E2E verification (safe rollback)?
- Who will provision the ERPNext instance and provide credentials?
- Preferred hosting method: Docker on existing infra, or Frappe Cloud?
