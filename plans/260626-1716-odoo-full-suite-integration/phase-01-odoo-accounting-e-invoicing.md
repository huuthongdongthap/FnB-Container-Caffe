# PHASE 01: ODOO ACCOUNTING (E-INVOICING)

**Effort:** 24 hours
**Priority:** P0 (Compliance Mandatory)
**Status:** Not Started
**Dependencies:** None (can start immediately)

---

## Context

This phase establishes the Odoo integration foundation:
- Odoo JSON-RPC client with authentication
- Database schema (`odoo_mappings`, `odoo_invoices`)
- Basic sync patterns (create → map → retry)
- Accounting module configuration

**Critical:** E-invoicing compliance for Vietnam is overdue (mandatory since June 2025). This must ship ASAP.

---

## Requirements

### Functional
- [ ] `worker/src/clients/odoo-client.js` — JSON-RPC wrapper with auth
- [ ] `worker/src/routes/odoo.js` — API endpoints: sales-orders, invoices, leads
- [ ] Database tables: `odoo_mappings`, `odoo_invoices`, `odoo_sync_logs`
- [ ] `POST /api/odoo/invoices` — Generate e-invoice on order completion
- [ ] VAT submission to VNPT/VNInvoice API
- [ ] Email invoice PDF to customer (SMTP already working)
- [ ] Retry queue with exponential backoff (3 attempts)
- [ ] Admin page: `/admin/odoo-sync-failures` to view/replay failures

### Non-Functional
- Idempotent: duplicate order completion → no double invoice
- Audit log: all Odoo API calls logged with request/response
- Performance: < 2s invoice generation time
- Error isolation: Odoo down → order flow still works (async queue)

---

## Files to Create

| File | Purpose |
|------|---------|
| `worker/src/clients/odoo-client.js` | Odoo JSON-RPC client (common) |
| `worker/src/routes/odoo.js` | Odoo API endpoints |
| `worker/src/lib/odoo-mapper.js` | Transform our data → Odoo format |
| `worker/wrangler.toml` (update) | Add Odoo secrets |
| `tests/odoo-client.test.js` | Unit tests (mocked Odoo) |
| `tests/odoo-integration.test.js` | Integration tests |
| `docs/06_ADR/0013-odoo-integration-approach.md` | ADR for this phase |

---

## Files to Modify

| File | Changes |
|------|---------|
| `worker/src/routes/orders.js` | On `status = 'completed'`, trigger `POST /api/odoo/invoices` |
| `worker/src/routes/cron.js` | Add retry queue processing every 5 minutes |
| `docs/12_CHANGELOG.md` | Add e-invoicing entry when done |
| `docs/05_TASKS/integration.md` | Update Odoo Accounting task status → ✅ |

---

## Implementation Steps

### Step 1: Odoo Client Foundation (4h)

1. Read Odoo 16 JSON-RPC docs: https://www.odoo.com/documentation/16.0/developer/api.html
2. Implement `odoo-client.js`:
   ```javascript
   export class OdooClient {
     constructor(url, db, username, apiKey) { ... }
     async call(model, method, args) { ... }  // JSON-RPC
     async create(model, values) { ... }
     async update(model, id, values) { ... }
     async searchRead(model, domain, fields) { ... }
   }
   ```
3. Write unit tests with mocked Odoo responses
4. Verify: `npm test odoo-client.test.js` passes

### Step 2: Database Schema (2h)

1. Create migration: `scripts/migrations/001-odoo-tables.sql`:
   ```sql
   CREATE TABLE odoo_mappings (...);
   CREATE TABLE odoo_invoices (...);
   CREATE TABLE odoo_sync_logs (...);
   ```
2. Apply to D1: `npx wrangler d1 execute fnb-caffe-db --file scripts/migrations/001-odoo-tables.sql`
3. Verify: `SELECT * FROM odoo_mappings` returns empty

### Step 3: Invoice Generation Endpoint (6h)

1. `POST /api/odoo/invoices`:
   - Input: `{ orderId: string }`
   - Fetch order from D1 (include items, customer, payment)
   - Transform → Odoo `account.move` (invoice) values
   - Call `odoo-client.create('account.move', values)`
   - Save mapping: `local_id=order.id → odoo_id=invoice.id`
   - Generate PDF (Odoo built-in or wkhtmltopdf)
   - Email PDF to customer via existing SMTP
   - Return: `{ success: true, invoiceId, pdfUrl }`
2. Wire into `orders.js` → `updateOrderStatusAPI()` when status = 'completed'
3. Test: mock Odoo, verify invoice created on order complete

### Step 4: VAT E-invoice Submission (6h)

1. Research VNPT/VNInvoice API (current provider?)
2. Implement `odoo-mapper.js` → add VAT fields (tax codes, buyer info)
3. After Odoo invoice created → POST to VAT API
4. Store VAT response (invoice number, signing authority)
5. Update invoice with e-invoice metadata
6. Test: mock VAT API, verify submission

### Step 5: Retry Queue & Admin UI (4h)

1. Add `sync_status` column to `odoo_mappings`
2. On failure → set `sync_status = 'failed'`, log error
3. Cron job (`cron.js` every 5 min): fetch failed mappings, retry
4. Admin page `/admin/odoo-sync-failures`:
   - Table: order ID, error, last attempt, retry button
   - Requires owner JWT
5. Test: simulate Odoo down, verify retry works

### Step 6: Testing & Validation (2h)

1. Unit tests: 100% coverage of `odoo-client.js`, `odoo-mapper.js`
2. Integration test: order complete → invoice created (mocked Odoo)
3. Run `npm run lint` — clean
4. Manual staging test (if Odoo test instance available)

---

## API Reference

### POST /api/odoo/invoices

**Auth:** Owner JWT required

**Body:**
```json
{
  "orderId": "ord_123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "invoiceId": "INV/2026/06/001",
  "odooId": 12345,
  "pdfUrl": "/invoices/ord_123456.pdf",
  "submittedToVAT": true,
  "vatInvoiceNumber": "1234567890"
}
```

**Response (400):**
```json
{
  "success": false,
  "error": "Order already invoiced"
}
```

**Response (500):**
```json
{
  "success": false,
  "error": "Odoo API error: Connection timeout",
  "syncId": "mapping_123"  // for retry tracking
}
```

---

## Database Schema Detail

```sql
-- Map local entities to Odoo IDs (idempotent)
CREATE TABLE odoo_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  local_type TEXT NOT NULL CHECK (local_type IN ('order', 'customer', 'product')),
  local_id TEXT NOT NULL,
  odoo_id INTEGER NOT NULL,
  odoo_model TEXT NOT NULL,
  sync_status TEXT DEFAULT 'synced',
  error_message TEXT,
  attempts INTEGER DEFAULT 0,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(local_type, local_id)
);

-- Invoice tracking for e-invoicing
CREATE TABLE odoo_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE NOT NULL,
  odoo_invoice_id INTEGER NOT NULL,
  invoice_number TEXT,
  pdf_path TEXT,
  vat_submission_status TEXT DEFAULT 'pending', -- pending, submitted, rejected
  vat_invoice_number TEXT,
  vat_signed_xml TEXT,
  submitted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

-- Sync audit log
CREATE TABLE odoo_sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mapping_id INTEGER,
  attempt INTEGER,
  status TEXT NOT NULL, -- success, failed, retrying
  error_message TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mapping_id) REFERENCES odoo_mappings(id)
);
```

---

## Testing Checklist

- [ ] `odoo-client.test.js`: test all methods (call, create, searchRead)
- [ ] Mock Odoo JSON-RPC responses (success, error, auth fail)
- [ ] Test retry logic: simulate failure → retry → success
- [ ] Integration test: order completed → invoice created
- [ ] Idempotency test: call `/api/odoo/invoices` twice → returns existing
- [ ] Admin UI: failed syncs displayed, retry button works
- [ ] Lint: `npm run lint` passes on new/modified files

---

## Acceptance Criteria

### Must Have (P0)
- ✅ Order completion triggers invoice generation
- ✅ Invoice PDF emailed to customer
- ✅ E-invoice submitted to VAT API (with VAT number)
- ✅ Failed syncs retried automatically
- ✅ Admin can view/replay failures
- ✅ All Odoo calls logged for audit

### Nice to Have (P1)
- Invoice webhook to customer portal
- Batch sync for historical orders
- Odoo product availability pull

---

## Rollback

If Odoo integration breaks order flow:
1. Disable webhook trigger in `orders.js` (comment out)
2. Revert D1 schema changes (drop new tables)
3. Deploy → existing orders unaffected

---

## Unresolved Questions

1. **VNInvoice provider:** Which VAT API currently in use (VNPT, VNInvoice, other)? Research needed.
2. **Odoo instance:** Self-hosted or Odoo.sh? Need credentials.
3. **Invoice template:** Use Odoo default or custom PDF layout?
4. **VAT signer certificate:** Who manages the signing key?

---

**Next:** After Phase 1 complete, proceed to Phase 2 (Odoo POS Integration).
