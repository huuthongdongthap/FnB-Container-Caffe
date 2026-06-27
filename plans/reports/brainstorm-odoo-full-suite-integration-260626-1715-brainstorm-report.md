# Brainstorm Report: Odoo Full Suite Integration — Next Plan

**Date:** 2026-06-26 17:15 ICT
**Project:** FnB-Container-Caffe
**Attendees:** User + Claude Code Brainstorm
**Decision:** Proceed with Odoo Full Suite Integration (80h)

---

## Problem Statement

The project needs **Phase 1 integration** from the 12 Pillars roadmap (260h, Q3-Q4 2026). Among 12 pillars, which should be next and why?

**Business drivers:**
- E-invoicing compliance is mandatory (overdue since June 2025)
- Need inventory sync to prevent overselling
- Want unified customer data across systems

---

## Options Considered

### 1. Odoo Full Suite (POS/Accounting/CRM) — 80h
**Pros:**
- Solves compliance (Accounting P0)
- High business impact (inventory, finance)
- Modules integrate naturally (single Odoo instance)
- User confirmed Odoo Accounting is P0

**Cons:**
- Large effort (80h)
- Requires Odoo expertise
- Complex deployment (Docker)

### 2. TastyIgniter Migration — 35h
**Pros:**
- Shorter timeline (35h)
- Improves ordering UX
- Self-contained

**Cons:**
- Doesn't address compliance
- Data migration complexity
- Separate from existing Odoo roadmap

### 3. SMTP Enhancement — 10h
**Pros:**
- Quick win
- Critical for invoice emails

**Cons:**
- Too small for a full plan
- Already partially done

---

## Decision Rationale

User chose **Odoo Full Suite Integration** because:

1. **Compliance first:** E-invoicing is mandatory, overdue 1 year → legal risk
2. **Architecture coherence:** Odoo's 3 modules (POS/Accounting/CRM) are designed to work together
3. **Foundation:** Accounting is prerequisite for POS/CRM sync anyway
4. **Roadmap alignment:** Odoo is Pillar 1 (highest priority in 12 pillars)

User also specified **"Full suite plan"** approach — single comprehensive plan covering all 3 modules with phased implementation, not separate mini-plans.

---

## Agreed Solution

### Plan: Odoo Full Suite Integration (80h)

**Structure:** 3 phases (sequential)

| Phase | Module | Effort | Priority |
|-------|--------|--------|----------|
| 1 | Odoo Accounting (E-invoicing) | 24h | P0 |
| 2 | Odoo POS Integration | 40h | P1 |
| 3 | Odoo CRM Sync | 16h | P2 |

**Total:** 80 hours (~2 months at 40h/week)

### Architecture

```
Cloudflare Worker (backend)
  ├── orders.js → order.completed → POST /api/odoo/invoices
  ├── auth.js → signup → POST /api/odoo/leads
  └── odoo.js (new) → Odoo JSON-RPC client

D1 Database (extensions)
  ├── odoo_mappings (local ↔ Odoo ID mapping)
  ├── odoo_invoices (e-invoice tracking)
  └── odoo_sync_logs (audit)

Odoo 16 (Docker)
  ├── Accounting → e-invoices → VAT API
  ├── POS → inventory deduction
  └── CRM → leads, customer tags
```

### Key Decisions

1. **TDD approach:** Write tests first per phase (mocked Odoo)
2. **Retry queue:** Failed syncs retried 3x with exponential backoff
3. **Dead letter admin UI:** `/admin/odoo-sync-failures` for manual replay
4. **Idempotency:** All endpoints safe to retry (use mappings)
5. **Async processing:** Order flow not blocked by Odoo downtime

### Dependencies (must provision before start)

| Item | Owner | Timeline |
|------|-------|----------|
| Odoo 16 instance (Docker) | Infra | Week 0 |
| Odoo API credentials (key) | DevOps | Week 0 |
| VNPT/VNInvoice API access | Accounting | Week 1 |
| Vietnamese chart of accounts | Accounting | Week 0 |
| SMTP working (already) | — | ✅ Done |

---

## Implementation Plan

### Phase 1: Odoo Accounting (24h)

**Deliverables:**
- `worker/src/clients/odoo-client.js` — JSON-RPC wrapper
- `worker/src/routes/odoo.js` — invoice endpoint
- D1 tables: `odoo_mappings`, `odoo_invoices`, `odoo_sync_logs`
- `POST /api/odoo/invoices` → generates PDF + emails + VAT submission
- Retry queue + admin failure UI
- Unit tests (100% coverage)

**Success:** E-invoicing compliance achieved, invoices auto-generated.

### Phase 2: Odoo POS Integration (40h)

**Deliverables:**
- `POST /api/odoo/sales-orders` — order → SO sync
- `GET /api/odoo/products/:id/availability` — stock check at checkout
- Two-way product sync (Odoo → us, us → Odoo)
- Odoo webhook receiver (`POST /api/webhooks/odoo`)
- Admin dashboard for POS sync health
- Integration tests

**Success:** Inventory stays in sync, checkout validates stock.

### Phase 3: Odoo CRM Sync (16h)

**Deliverables:**
- `POST /api/odoo/leads` — customer signup → Odoo lead
- Loyalty tier → Odoo tag sync
- Admin panel: Odoo notes display, manual sync button
- Odoo → us webhook (contact updates)
- Backfill script for existing customers
- Tests

**Success:** Customer data unified, sales team has full history.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Odoo API downtime | Retry queue + dead letter, admin alerts |
| VAT invoice rejection | Pre-submit validation, staging test |
| Inventory race condition | Optimistic locking, daily reconcile |
| Odoo version upgrade | Pin version, integration tests |
| Rate limiting | Batch sync, queue processing |

---

## Testing Strategy

**Per phase:**
- Unit tests (mocked Odoo) — 100% coverage target
- Integration tests (staging Odoo instance)
- E2E flow verification

**Overall:**
- `npm test` passes on all new/modified files
- `npm run lint` clean
- Manual smoke test on staging

---

## Timeline

| Week | Phase | Milestone |
|------|-------|-----------|
| 1 | Phase 1 (Accounting) | Odoo client + invoice generation working |
| 2-3 | Phase 1 continued | VAT integration + email templates |
| 4 | Phase 2 (POS) | Sales order sync + inventory deduction |
| 5-6 | Phase 2 continued | Product sync + webhooks |
| 7 | Phase 3 (CRM) | CRM lead sync + tier tagging |
| 8 | Polish | Integration tests, staging validation, docs |

**Total:** 8 weeks (2 months)

---

## Success Metrics

- ✅ E-invoices generated < 2s after order completion
- ✅ 100% order-to-invoice success rate (after retries)
- ✅ Inventory sync lag < 5 minutes
- ✅ Customer sync: < 2s latency
- ✅ Zero sync failures > 24h old

---

## Next Steps

1. **Provision Odoo** (Docker, accessible from Cloudflare)
2. **Configure Odoo modules:** POS, Accounting (Vietnamese CoA), CRM
3. **Create API credentials** for integration user
4. **Set up VNInvoice API** credentials
5. **Add secrets** to Cloudflare Worker
6. **Invoke `/ck:plan --tdd`** to begin Phase 1 implementation

---

## Unresolved Questions

1. **VAT provider:** VNPT or VNInvoice? Need to check current contract
2. **Odoo deployment:** Self-hosted Docker or Odoo.sh?
3. **Invoice template:** Odoo default or custom layout?
4. **Product mapping:** Exact field mapping our `products` → Odoo `product.product`?

These will surface during Phase 1 implementation.

---

**Recommendation:** Start Phase 1 immediately — compliance is overdue.

**Plan location:** `plans/260626-1716-odoo-full-suite-integration/plan.md`
