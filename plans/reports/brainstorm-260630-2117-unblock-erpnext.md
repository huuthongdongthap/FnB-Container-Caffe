# Brainstorm Report — Unblock ERPNext, Finish Migration

**Date:** 2026-06-30 21:17
**Topic:** tiếp theo làm gì?
**Decision:** Option A — Provision ERPNext instance, complete Phase 07-08

## Codebase Context

- 914 tests pass, production v2.1.0 stable
- ERPNext migration Phase 01-06 done, committed (`c3c7337`)
- Phase 07 (Odoo cleanup) + Phase 08 (E2E) = 10h remaining
- TV Menu (Phase 02) live at `tv-menu.html`
- Deployment guide ready: `docs/deployment/erpnext-setup-guide.md` (940 lines, bilingual)

## The Block

ERPNext Phases 07-08 are blocked waiting for:
- ERPNext v15 instance running (Docker on 4GB VPS, ~300K VND/mo)
- ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET in CF Worker env vars

## Evaluated Options

| Option | Verdict | Why |
|--------|---------|-----|
| **A: Provision ERPNext → finish Phase 07-08** | ✅ Chosen | Unblocks accounting, e-invoicing. Guide exists. 10h to done. |
| B: Odoo cleanup now (skip E2E) | ⚠️ Risky | Deletes 22 files without live ERPNext verification |
| C: Skip ERPNext, do Cal.com next | ❌ Deferred | ERPNext is critical path — e-invoicing compliance |

## Approach

### Step 1: Provision ERPNext Instance
Follow `docs/deployment/erpnext-setup-guide.md`:
- Rent 4GB VPS (Vietnix, VNG Cloud, or DigitalOcean)
- Deploy via frappe_docker (8-container stack)
- Configure SSL via Let's Encrypt + Nginx reverse proxy
- Generate API key + secret
- Set env vars in CF Worker: `ERPNEXT_URL`, `ERPNEXT_API_KEY`, `ERPNEXT_API_SECRET`

### Step 2: Phase 07 — Odoo Cleanup (2h)
Delete ~22 Odoo files, remove imports from index.js/cron.js/loyalty.js/orders.js, verify build + tests.

### Step 3: Phase 08 — E2E Tests (8h)
8 test cases against real ERPNext: product sync, invoice creation, CRM lead, stock check, webhook, error handling, retry, idempotency.

### Step 4: Deploy
Run full test suite, deploy production, verify SHA match.

## Acceptance Criteria

- [ ] ERPNext instance running, API reachable from CF Worker
- [ ] ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET set in CF Worker env
- [ ] Phase 07: 22 Odoo files deleted, 0 "odoo" references in production code
- [ ] Phase 08: All 8 E2E test cases pass
- [ ] Full test suite: 920+ pass, 0 fail
- [ ] Production deploy with SHA verification

## Scope Boundary

**Out of scope:** New features beyond ERPNext migration, other pillars, mobile app, multi-tenant.

## Touchpoints

- Delete: ~22 Odoo files (routes, clients, lib, admin, tests)
- Modify: `worker/src/index.js`, `cron.js`, `loyalty.js`, `orders.js` (remove Odoo refs)
- Env: CF Worker secrets (ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET)
- Docs: CHANGELOG, ROADMAP update after completion

## Risks

- VPS cost (~300K VND/mo) — acceptable, cheaper than SaaS alternatives
- ERPNext v15 may have API quirks — E2E tests will surface these
- Odoo file deletion irreversible — git history preserves them

## Existing Plan Reference

Phase 03 already fully planned at:
`plans/260630-2045-hybrid-erpnext-tv-menu/phase-03-erpnext-phase07-08-finish.md`
