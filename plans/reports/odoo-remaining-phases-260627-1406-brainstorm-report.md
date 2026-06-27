# Brainstorm Report: Odoo Full Suite Integration — Remaining Phases

**Date:** 2026-06-27 14:06 ICT
**Project:** FnB-Container-Caffe (AURA Space Sa Dec)
**Status:** Approved — ready for planning

---

## Problem Statement

Odoo 16 integration has 3 remaining phases (80h total) after Phase 1 scaffolding completed. Need efficient parallel execution strategy to minimize wall-clock time while respecting dependencies.

## Completed Work

- ✅ Realtime Order Tracking (`260626-1412`) — all 6 tasks done
- ✅ Odoo Phase 1 scaffolding — client code, D1 schema, unit tests (114 tests passing)

## Remaining Phases

| Phase | Module | Effort | Dependencies |
|-------|--------|--------|--------------|
| 1 | Odoo Accounting (E-invoicing) | 24h | None — start immediately |
| 2 | Odoo POS Integration | 40h | Phase 1 complete |
| 3 | Odoo CRM Sync | 16h | Phase 1 complete |

## Execution Strategy

### Phase 1: Sequential (Foundation)
- Odoo client + D1 schema already scaffolded
- Complete: invoice generation, VAT submission, email delivery
- Must finish before Phase 2/3 can start

### Phase 2 + 3: Parallel
- POS (inventory sync) and CRM (customer leads) are independent
- Both only need Odoo client (built in Phase 1)
- Run 2 agents concurrently after Phase 1 completes

### Max Parallel: 2 agents (Phase 2 + Phase 3)

## Approach

**Recommended:** `/ck:plan` (default mode)
- Phase 1 gets its own plan file with TDD steps
- Phase 2 and 3 get separate plan files for parallel execution
- Each phase plan references the Odoo client as shared dependency

## Risks

- Odoo instance must be provisioned before Phase 1
- VAT API credentials needed for e-invoicing
- Phase 1 completion gate must be verified before spawning Phase 2+3

## Next Steps

1. Create Phase 1 plan (Accounting/E-invoicing)
2. Execute Phase 1 with TDD
3. On Phase 1 complete, create Phase 2 + Phase 3 plans in parallel
4. Execute Phase 2 + Phase 3 concurrently
