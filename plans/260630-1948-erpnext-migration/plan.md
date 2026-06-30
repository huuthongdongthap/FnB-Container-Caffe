---
plan: erpnext-migration
status: in_progress
created: 2026-06-30T19:48:00+07:00
mode: tdd
source: plans/reports/brainstorm-260630-1938-erpnext-pivot.md
effort: 45h
progress: 70%
completed_phases: 01-06
blocked_phases: 08
skipped_phases: 07 (Odoo deletion deferred)
last_sync: 2026-06-30T20:39:00+07:00
tests: 904 pass, 0 fail, 18 skipped
code_review: complete, all 9 issues fixed
---

# ERPNext Migration Plan — Overview

**Decision:** Replace Odoo → ERPNext. Refactor ~50 files. All 904 tests pass (no regression).

## Why ERPNext

- 100% free GPL v3 — Accounting/POS/CRM/Inventory included (Odoo Community thieu Accounting)
- REST API (Frappe) — don gian hon Odoo JSON-RPC
- 1 system thay the Odoo + TastyIgniter

## Scope

| Category | Files | Effort |
|----------|-------|--------|
| Client layer | 4 files (rewrite) | 8h |
| Routes | 6 files (rename + rewrite API calls) | 8h |
| Lib mappers | 3 files (rename + rewrite field mappings) | 6h |
| Cron + loyalty | 2 files (rename functions) | 3h |
| Frontend + admin | 4 files (URL + text update) | 4h |
| Tests (TDD) | 10 files (write before each phase) | 8h |
| DB migrations | 3 SQL files (rename tables) | 3h |
| Docs + ADR | 15 files (update) | 3h |
| Config + scripts | 3 files | 2h |
| **Total** | **~50 files** | **~45h** |

## Phases (TDD Order)

| # | Phase | Status | Effort |
| 01 | Write ERPNext client tests -> implement client | done | 8h |
| 02 | Refactor routes (odoo*.js -> erpnext*.js) | done | 8h |
| 03 | Refactor lib mappers + cron | done | 6h |
| 04 | Refactor frontend + admin UI | done | 4h |
| 05 | Database migrations + env config | done | 3h |
| 06 | Docs + ADR rewrite | done | 3h |
| 07 | Integration test + cleanup (Odoo deletion deferred) | skipped | 5h |
| 08 | E2E with real ERPNext instance | blocked | 8h |

## Current Status Summary

- **Phase 01** — erpnext-client.js + 45 tests (all pass). Factory pattern, REST wrapper, retry logic, 3 error classes.
- **Phase 02** — erpnext.js, erpnext-pos.js, erpnext-invoices.js created. index.js/cron/loyalty/orders/customers updated.
- **Phase 03** — erpnext-mapper.js, erpnext-sales-mapper.js, erpnext-crm-mapper.js created. Cron function renames.
- **Phase 04** — admin/erpnext-sync.html/css created. admin/customers.html + orders.html updated to ERPNext.
- **Phase 05** — scripts/migrations/004-rename-odoo-to-erpnext.sql created.
- **Phase 06** — ADR 0016/0017/0018 created. docs/03_ARCHITECTURE.md + 12_CHANGELOG.md updated.
- **Phase 07** — Skipped. Odoo files kept until E2E verification completes. No regression risk.
- **Phase 08** — Blocked. Requires ERPNext instance URL + API key + API secret.

## Key Design Decisions

1. **New file naming:** `erpnext-*` prefix (e.g., `erpnext-client.js`, `erpnext-pos.js`)
2. **Keep old Odoo files** during migration — delete only after all tests pass and E2E verified
3. **URL paths:** `/api/odoo/*` -> `/api/erpnext/*` (new), keep old routes as deprecated redirects
4. **DB tables:** `odoo_*` -> `erpnext_*` via migration scripts
5. **Auth:** ERPNext token-based (`Authorization: token {key}:{secret}`), simpler than Odoo session
6. **API protocol:** JSON-RPC -> REST (Frappe `/api/resource/{doctype}`)

## Blocking Dependencies

- ERPNext instance URL + API key (Phase 08 only)
- All other phases are testable without real ERPNext

## Test Status

- 904 tests pass (859 original + 45 ERPNext client tests)
- 0 failures
- 18 skipped (pre-existing Odoo integration tests needing real Odoo instance)
- Code review: 4 CRITICAL + 5 HIGH/MEDIUM issues found and ALL FIXED

## Success Criteria

- [x] All existing tests pass (904 pass, no regression)
- [x] New ERPNext client tests pass (TDD)
- [ ] No `odoo` references in production code (except in migration scripts) — blocked by Phase 07
- [x] `npm run build` 0 errors
- [x] `npm test` 100% pass
- [ ] Phase 08 E2E verified with real ERPNext — blocked

## Related

- Brainstorm: `plans/reports/brainstorm-260630-1938-erpnext-pivot.md`
- ERPNext API research: `plans/reports/researcher-erpnext-api-report.md`
- Phase 01 report: `plans/reports/fullstack-developer-260630-1958-erpnext-phase-01-report.md`
- Code review: (processed inline, no separate report artifact)
