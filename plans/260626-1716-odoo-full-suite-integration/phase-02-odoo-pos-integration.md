# PHASE 02: ODOO POS INTEGRATION

**Effort:** 40 hours
**Priority:** P1 (Revenue Critical)
**Status:** Not Started
**Dependencies:** Phase 1 complete (Odoo Accounting working)

---

## Context

After establishing Odoo Accounting for e-invoicing compliance, Phase 2 integrates Odoo POS for:
- Real-time inventory deduction when orders placed
- Product availability sync (Odoo → our menu)
- Sales order creation for kitchen fulfillment
- Price/availability validation at checkout

**Business impact:** Accurate inventory prevents overselling, syncs kitchen prep with stock levels.

---

## Requirements

### Functional
- [ ] `POST /api/odoo/sales-orders` — Create Odoo SO from our order
- [ ] Product availability check before checkout (`GET /api/odoo/products/:id/availability`)
- [ ] Real-time stock deduction on order completion
- [ ] Two-way sync: Odoo → our menu (price/stock updates)
- [ ] Webhook: Odoo price changes → update our menu
- [ ] Order mapping: our order.id ↔ Odoo sale.order.id
- [ ] Batch reconciliation: detect stock mismatches

### Non-Functional
- Latency: < 500ms for availability check (cached)
- Consistency: eventual sync (15min max lag)
- Fault tolerance: offline mode if Odoo down → queue sync
- Monitoring: sync health dashboard for admin

---

## Files to Create

| File | Purpose |
|------|---------|
| `worker/src/routes/odoo.js` (extend) | Add sales-orders, products, webhooks |
| `worker/src/clients/odoo-product-client.js` | Product availability cache + sync |
| `worker/src/lib/odoo-sales-mapper.js` | Transform order → Odoo sale.order |
| `tests/odoo-pos-integration.test.js` | E2E: order → SO creation |
| `tests/product-sync.test.js` | Product availability tests |
| `docs/06_ADR/0014-odoo-pos-sync-pattern.md` | ADR for sync strategy |

---

## Files to Modify

| File | Changes |
|------|---------|
| `worker/src/routes/orders.js` | On order created → POST `/api/odoo/sales-orders` |
| `js/checkout/cart-summary.js` | Call `/api/odoo/products/:id/availability` before checkout |
| `worker/wrangler.toml` | Add Odoo secrets (if not in Phase 1) |
| `docs/12_CHANGELOG.md` | Add POS integration entry |

---

## Implementation Steps

### Step 1: Sales Order Creation (12h)

1. Extend `odoo-client.js` (from Phase 1) with:
   ```javascript
   async createSaleOrder(values) { ... }  // model='sale.order'
   ```
2. Implement `POST /api/odoo/sales-orders`:
   - Input: `{ orderId: string }`
   - Fetch order + items from D1
   - Transform using `odoo-sales-mapper.js`:
     ```javascript
     {
       partner_id: odooCustomerId,  // from mapping or create on-the-fly
       order_line: [
         { product_id, product_uom_qty, price_unit },
         ...
       }
     }
     ```
   - Call `odooClient.create('sale.order', values)`
   - Save mapping: `local_id=order.id → odoo_id=saleOrder.id`
   - Return: `{ success: true, saleOrderId, odooId }`
3. Wire into `orders.js`: after order created (not completed), push to Odoo
4. Write tests:
   - Mock Odoo → verify SO created with correct lines
   - Test idempotency: duplicate call → returns existing mapping
   - Test failure: Odoo down → retry queued

### Step 2: Product Availability API (8h)

1. Implement `GET /api/odoo/products/:id/availability`:
   - Query Odoo `product.product` → `qty_available`
   - Cache in KV for 30s (reduce API calls)
   - Return: `{ available: boolean, stock: number, estimatedRestock }`
2. Integrate into `cart-summary.js`:
   - Before checkout, check each item availability
   - If stock < quantity → show warning, block checkout
3. Admin endpoint: `GET /admin/product-sync-status` — last sync per product
4. Tests:
   - Mock Odoo stock levels
   - Test cache hit/miss
   - Test checkout blocked when out of stock

### Step 3: Two-Way Product Sync (10h)

**Pull from Odoo (price/stock updates):**
1. Cron job (`cron.js` every 15 min):
   ```javascript
   const changed = await odooClient.searchRead('product.product', [
     ['write_date', '>', lastSync]
   ], ['id', 'default_code', 'list_price', 'qty_available']);
   await updateLocalProducts(changed);
   ```
2. Update `products` table (if exists) or create new sync table
3. Log sync metrics: count updated, errors

**Push to Odoo (our menu changes → Odoo):**
1. Webhook from admin panel: when admin updates product in our system
2. Call `odooClient.write('product.product', odooId, { list_price, qty_available })`
3. Handle conflicts (Odoo modified concurrently → last-write-wins with warning)

### Step 4: Webhook Receivers (Odoo → us) (6h)

1. Odoo can send webhooks on model changes (sale.order, product.product)
2. Create endpoint: `POST /api/webhooks/odoo`:
   - Verify signature (shared secret)
   - Parse model + operation (create/write/unlink)
   - Update our database accordingly
   - Example: Odoo price change → update `products` table
3. Admin config: set webhook URL in Odoo → our production URL
4. Idempotency: dedupe by Odoo `write_date`

### Step 5: Error Handling & Monitoring (4h)

1. Dead letter queue: use existing `odoo_mappings` table
2. Admin dashboard (`/admin/odoo-pos-sync`):
   - Sync health: last successful pull/push times
   - Failed mappings table with retry button
   - Stock discrepancy alerts (our qty vs Odoo qty differs > threshold)
3. Alerting: send Telegram message to admin on repeated failures

---

## API Reference

### POST /api/odoo/sales-orders

**Auth:** Owner JWT

**Body:**
```json
{
  "orderId": "ord_abc123"
}
```

**Response:**
```json
{
  "success": true,
  "saleOrderId": 456,
  "mappingId": 123,
  "status": "synced"
}
```

### GET /api/odoo/products/:id/availability

**Auth:** Customer JWT (during checkout)

**Response:**
```json
{
  "available": true,
  "stock": 15,
  "estimatedRestock": null,
  "cachedAt": "2026-06-26T10:30:00Z"
}
```

### POST /api/webhooks/odoo

**Auth:** Signature header `X-Odoo-Signature`

**Body (example):**
```json
{
  "model": "product.product",
  "operation": "write",
  "record_id": 789,
  "values": { "list_price": 45000 },
  "write_date": "2026-06-26T10:25:00Z"
}
```

**Response:** `200 OK` (acknowledge)

---

## Database Schema Additions

```sql
-- Extend odoo_mappings for POS entities
-- (already created in Phase 1)

-- Product sync cache
CREATE TABLE odoo_product_sync (
  product_id TEXT PRIMARY KEY,  -- our product ID
  odoo_product_id INTEGER NOT NULL,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  odoo_write_date TIMESTAMP,  -- for delta sync
  cached_stock INTEGER,
  cached_price DECIMAL(10,2),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Sync failures (if not covered by odoo_mappings)
CREATE TABLE odoo_sync_failures (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,  -- 'sale.order', 'product.product'
  local_id TEXT NOT NULL,
  operation TEXT NOT NULL,  -- 'create', 'write'
  error_message TEXT,
  attempts INTEGER DEFAULT 1,
  last_attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, local_id, operation)
);
```

---

## Testing Checklist

- [ ] Unit: `odoo-sales-mapper.test.js` — order → SO transformation
- [ ] Unit: `odoo-product-client.test.js` — cache logic, stock check
- [ ] Integration: `odoo-pos-integration.test.js` — order → SO → Odoo
- [ ] E2E: checkout flow blocked when product out of stock
- [ ] Cron: product sync updates local DB
- [ ] Webhook: Odoo price change → our DB update
- [ ] Idempotency: duplicate SO create → returns existing
- [ ] Lint: `npm run lint` passes

---

## Acceptance Criteria

### Must Have (P1)
- ✅ Order → Odoo sales order within 5s
- ✅ Product availability check at checkout
- ✅ Inventory sync: Odoo stock ↔ our menu stock
- ✅ Failed sync retry queue (3 attempts)
- ✅ Admin dashboard for sync health

### Nice to Have (P2)
- Real-time webhook push from Odoo
- Batch reconciliation (detect drift)
- Price override workflow (admin approval)

---

## Rollback

1. Disable POS triggers in `orders.js`
2. Remove product availability check from checkout
3. D1 tables remain but unused (safe)

---

## Unresolved Questions

1. **Product model mapping:** Our `products` table vs Odoo `product.product` — field mapping complete?
2. **Stock allocation:** How does Odoo handle concurrent orders? Need to understand reservation logic.
3. **Price sync direction:** Source of truth? Odoo or our admin panel?
4. **Webhook infrastructure:** Does Odoo instance support outbound webhooks (need config)?

---

**Next:** After Phase 2, proceed to Phase 3 (Odoo CRM Sync).
