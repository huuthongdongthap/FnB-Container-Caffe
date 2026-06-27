# ODOO FULL SUITE INTEGRATION — IMPLEMENTATION PLAN

**Project:** FnB-Container-Caffe (AURA Space Sa Dec)
**Plan Created:** 2026-06-26 17:16 ICT
**Effort:** 80 hours total
**Status:** Pending
**Mode:** TDD (tests-first per phase)

---

## Overview

Integrate Odoo 16 (POS + Accounting + CRM) with Cloudflare Workers backend to achieve:
1. **Compliance:** Automatic e-invoicing for Vietnam (mandatory)
2. **Inventory sync:** Orders deducted from Odoo POS stock
3. **Customer sync:** New customers → Odoo CRM leads
4. **Financial integrity:** Orders → Accounting journal entries

**Priority:** P0 (Accounting) → P1 (POS) → P2 (CRM)

---

## Phases

| Phase | Module | Effort | Status | Dependencies |
|-------|--------|--------|--------|--------------|
| 1 | Odoo Accounting (E-invoicing) | 24h | ⏳ Pending | None |
| 2 | Odoo POS Integration | 40h | ⏳ Pending | Phase 1 complete |
| 3 | Odoo CRM Sync | 16h | ⏳ Pending | Phase 1 complete |

---

## Success Criteria

### Minimum Viable
- ✅ E-invoices generated on order completion (PDF + VAT submission)
- ✅ Orders create sales orders in Odoo POS (inventory deduction)
- ✅ New customers appear in Odoo CRM leads
- ✅ All Odoo API calls logged with audit trail
- ✅ Retry queue for failed API calls (max 3 attempts)

### Full Success
- Two-way sync: Odoo → Cloudflare product availability
- Customer loyalty tiers synced to Odoo contact tags
- Webhook-based real-time sync (no polling)
- Comprehensive integration tests (mocked Odoo API)
- Documentation: deployment guide, troubleshooting, ADR

---

## Dependencies

### External (must provide)
| Dependency | Purpose | Owner |
|------------|---------|-------|
| Odoo 16 instance | POS/Accounting/CRM backend | Infra |
| Odoo API credentials | JSON-RPC authentication | DevOps |
| VNPT/VNInvoice API | VAT e-invoice submission | Accounting |
| SMTP working | Invoice email delivery | Already done ✅ |

### Internal (project)
- `worker/src/routes/orders.js` — order completion webhook
- `worker/src/routes/auth.js` — customer registration
- D1 database: add `odoo_mappings` table
- Secrets: `ODOO_URL`, `ODOO_DB`, `ODOO_USERNAME`, `ODOO_API_KEY`

---

## Architecture

```
┌─────────────────┐     POST /api/orders/:id/complete     ┌──────────────────┐
│   Customer      │─────────────────────────────────────▶│  Cloudflare     │
│   (checkout)    │                                       │   Worker         │
└─────────────────┘                                       └────────┬─────────┘
                                                                  │
                                                                  │ on order.completed
                                                                  ▼
                                                         ┌─────────────────────┐
                                                         │  worker/src/        │
                                                         │  routes/odoo.js     │
                                                         │  + odoo-client.js   │
                                                         └─────────┬───────────┘
                                                                   │
                                                                   │ JSON-RPC
                                                                   ▼
┌─────────────────┐     POST /api/odoo/sales-orders     ┌──────────────────┐
│   Odoo POS      │◀─────────────────────────────────────│    Odoo 16       │
│   (inventory)   │                                       │   (Docker)       │
└─────────────────┘                                       └────────┬─────────┘
                                                                  │
                                                                  │ create invoice
                                                                  ▼
                                                         ┌─────────────────────┐
                                                         │  Odoo Accounting    │
                                                         │  (e-invoice gen)    │
                                                         └─────────┬───────────┘
                                                                   │
                                                                   │ POST to VAT API
                                                                   ▼
┌─────────────────┐     Email receipt                    ┌──────────────────┐
│   Customer      │◀─────────────────────────────────────│  SMTP Server     │
│   (invoices)    │                                       │  (already setup) │
└─────────────────┘                                       └──────────────────┘
```

---

## Database Schema Changes

### New Table: odoo_mappings
```sql
CREATE TABLE odoo_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_type TEXT NOT NULL,  -- 'order' | 'customer' | 'product'
  local_id TEXT NOT NULL,    -- our system ID
  odoo_id INTEGER NOT NULL,  -- Odoo database ID
  odoo_model TEXT NOT NULL,  -- 'sale.order' | 'res.partner' | 'product.product'
  sync_status TEXT DEFAULT 'synced',  -- 'synced' | 'pending' | 'failed'
  error_message TEXT,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(local_type, local_id)
);
```

### Modify: customers (add odoo_partner_id)
```sql
ALTER TABLE customers ADD COLUMN odoo_partner_id INTEGER;
```

### Modify: orders (add odoo_order_id)
```sql
ALTER TABLE orders ADD COLUMN odoo_order_id INTEGER;
```

---

## API Contracts

### New Endpoints (Cloudflare Worker)

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `POST /api/odoo/sales-orders` | Create SO from order | Owner JWT |
| `POST /api/odoo/invoices` | Generate invoice from SO | Owner JWT |
| `POST /api/odoo/leads` | Create CRM lead from customer | Owner JWT |
| `GET /api/odoo/products/:id` | Fetch product availability | Owner JWT |
| `GET /api/odoo/sync/status` | Check sync queue health | Owner JWT |

### Webhook Triggers
- `orders.js`: on `status = 'completed'` → push to Odoo
- `auth.js`: on customer signup → push to CRM
- `cron.js`: retry failed mappings every 5 minutes

---

## Error Handling Strategy

### Retry Logic (3 attempts, exponential backoff)
```javascript
const MAX_RETRIES = 3;
async function syncWithRetry(odooCall, mappingId) {
  for (attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const odooId = await odooCall();
      await updateMapping(mappingId, { sync_status: 'synced', odoo_id: odooId });
      return odooId;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        await updateMapping(mappingId, { sync_status: 'failed', error_message: error.message });
        throw error;
      }
      await sleep(Math.min(1000 * 2 ** attempt, 30000)); // cap at 30s
    }
  }
}
```

### Dead Letter Queue
- Failed mappings: `sync_status = 'failed'`
- Manual review via `/admin/odoo-sync-failures` page
- Retry button per mapping (admin only)

---

## Testing Strategy

### Unit Tests (TDD per phase)
- Mock Odoo JSON-RPC responses
- Test retry logic, error handling
- Test database operations (D1 queries)

### Integration Tests
- Test against Odoo test instance (staging)
- Verify: order → SO → invoice → email flow
- End-to-end: checkout complete → D1 → Odoo → email

### Contract Tests
- Validate Odoo API schema expectations
- Ensure backwards compatibility if Odoo upgrades

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Odoo API downtime | Medium | High | Retry queue + dead letter, admin alert |
| Invoice format rejection (VAT) | Low | Critical | Pre-submit validation, staging test |
| Inventory race condition | Medium | Medium | Optimistic locking, reconcile daily |
| Odoo 16 upgrade breaks API | Medium | Medium | Pin Odoo version, integration tests |
| Rate limiting (too many orders) | Low | Medium | Batch sync, queue processing |

---

## Rollback Plan

### Immediate rollback (code revert)
```bash
git revert <phase-commit>
git push origin main
# GitHub Actions auto-deploy → previous version
```

### Data reconciliation
- Odoo mappings can be safely deleted (will re-sync on next order)
- No data loss: orders/customers remain in D1
- Disable sync by removing webhook triggers

---

## Timeline (tentative)

| Week | Phase | Milestone |
|------|-------|-----------|
| 1 | Phase 1 (Accounting) | Odoo client working, invoice generation |
| 2-3 | Phase 1 continued | VAT integration, email templates |
| 4 | Phase 2 (POS) | Sales order sync, inventory deduction |
| 5-6 | Phase 2 continued | Product sync, error handling |
| 7 | Phase 3 (CRM) | Customer lead sync, tags |
| 8 | Testing & polish | Integration tests, staging validation |

**Total:** 8 weeks (2 months)

---

## Next Steps

1. **Provision Odoo instance** (Docker, accessible API)
2. **Configure Odoo modules:** POS, Accounting (Vietnamese CoA), CRM
3. **Generate Odoo API key** for integration user
4. **Set up VNPT/VNInvoice** API credentials (for VAT)
5. **Create secrets** in Cloudflare:
   ```bash
   cd worker && npx wrangler secret put ODOO_URL
   npx wrangler secret put ODOO_DB
   npx wrangler secret put ODOO_USERNAME
   npx wrangler secret put ODOO_API_KEY
   npx wrangler secret put VNINVOICE_API_KEY
   ```
6. **Start Phase 1** with TDD: write tests first

---

## Unresolved Questions

None at plan creation — will surface during implementation.

---

## References

- `docs/05_TASKS/integration.md` — Odoo task definitions
- `docs/08_BUSINESS_MODEL.md` — Business context
- `docs/06_ADR/` — Architecture decision records
- Odoo 16 Documentation: https://www.odoo.com/documentation/16.0/
- Odoo JSON-RPC API: https://www.odoo.com/documentation/16.0/developer/api.html

---

**Plan Path:** `plans/260626-1716-odoo-full-suite-integration/plan.md`
