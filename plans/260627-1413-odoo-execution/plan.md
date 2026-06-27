# Odoo Full Suite Integration — Execution Plan

**Created:** 2026-06-27 14:13 ICT
**Branch:** main
**Mode:** ultracode parallel

---

## Overview

Complete Odoo 16 integration across 3 phases. Phase 1 sequential (foundation), Phase 2+3 parallel (independent).

**Total remaining effort:** ~20-25h (core already scaffolded)

---

## Phases

| # | Phase | Effort | Mode | Dependencies |
|---|-------|--------|------|--------------|
| 1 | Accounting/E-invoicing completion | 8h | Sequential | None |
| 2 | POS Integration completion | 7h | Parallel with #3 | Phase 1 |
| 3 | CRM Sync completion | 5h | Parallel with #2 | Phase 1 |

---

## Phase 1: Accounting/E-invoicing (8h)

### Tasks
1. Wire cron retry queue → `worker/src/routes/cron.js` (2h)
2. VAT submission → VNPT/VNInvoice API stub (2h)
3. Admin page `/admin/odoo-sync-failures` UI (2h)
4. Integration test: order → invoice → email flow (2h)

### Files to modify
- `worker/src/routes/cron.js` — add Odoo retry processing
- `worker/src/routes/odoo-invoices.js` — VAT submission
- `worker/src/routes/odoo.js` — wire cron triggers
- `admin/` — add sync-failures page
- `tests/odoo-integration.test.js` — expand integration tests

### Acceptance
- [ ] Order completion → invoice in Odoo (mocked)
- [ ] Failed syncs retry via cron (3 attempts, exponential backoff)
- [ ] Admin can view/replay failed mappings
- [ ] `npm test` passes (odoo-* tests)

---

## Phase 2: POS Integration (7h)

### Tasks
1. Replace `xdescribe` → real tests for POS routes (3h)
2. Product availability sync Odoo → Cloudflare KV (2h)
3. Sales order creation on order completion (2h)

### Files to modify
- `tests/odoo-pos-integration.test.js` — enable + expand tests
- `worker/src/routes/odoo-pos.js` — product sync logic
- `worker/src/clients/odoo-product-client.js` — already exists, verify

### Acceptance
- [ ] POS tests pass (not stub)
- [ ] Product stock syncs from Odoo → KV cache
- [ ] Sales order created in Odoo on order complete

---

## Phase 3: CRM Sync (5h)

### Tasks
1. Replace `xdescribe` → real tests for CRM (2h)
2. Wire customer signup → CRM lead creation (2h)
3. Loyalty tier → Odoo tag sync verification (1h)

### Files to modify
- `tests/odoo-crm-sync.test.js` — enable + expand tests
- `worker/src/routes/auth.js` — trigger CRM on signup
- `worker/src/clients/odoo-crm-client.js` — already exists, verify

### Acceptance
- [ ] CRM tests pass (not stub)
- [ ] New customer → Odoo lead (with consent)
- [ ] Loyalty tier maps to correct Odoo tags

---

## Execution Order

```
Phase 1 (sequential)
  └─► Phase 2 + Phase 3 (parallel, 2 agents)
        └─► Final verification + commit
```

---

## Success Criteria

- [ ] All `odoo-*.test.js` tests pass (no `xdescribe` stubs)
- [ ] `npm run lint` clean on modified files
- [ ] `npm run build` passes
- [ ] No console errors in integration flow
