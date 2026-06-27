# PHASE 03: ODOO CRM SYNC

**Effort:** 16 hours
**Priority:** P2 (Customer Data Sync)
**Status:** Not Started
**Dependencies:** Phase 1 complete (Odoo Accounting working)

---

## Context

Phase 3 completes the Odoo suite by integrating Odoo CRM:
- New customers from signup → Odoo leads
- Loyalty tier sync (Bronze/Silver/Gold/Platinum → Odoo tags)
- Pull customer notes from Odoo to our admin panel
- Unified customer view across systems

**Business impact:** Sales team gets full customer history in Odoo, enables targeted campaigns.

---

## Requirements

### Functional
- [ ] `POST /api/odoo/leads` — Create Odoo lead from customer signup
- [ ] Loyalty tier auto-tagging in Odoo (based on points/tier)
- [ ] `GET /api/odoo/customers/:id/notes` — Pull Odoo notes to our admin
- [ ] Webhook: Odoo contact updates → our customer record
- [ ] Customer mapping table: our customer.id ↔ Odoo res.partner.id
- [ ] Admin UI: show Odoo CRM link for each customer

### Non-Functional
- Real-time: lead created within 2s of signup
- Idempotent: duplicate signup → no duplicate leads
- Privacy: only sync opt-in customers (consent flag)
- Backfill: migrate existing customers to Odoo (one-time script)

---

## Files to Create

| File | Purpose |
|------|---------|
| `worker/src/routes/odoo.js` (extend) | Add leads endpoint, contact sync |
| `worker/src/clients/odoo-crm-client.js` | CRM-specific operations |
| `worker/src/lib/odoo-crm-mapper.js` | Transform customer → Odoo lead/partner |
| `tests/odoo-crm-sync.test.js` | Lead creation, tag sync tests |
| `scripts/backfill-odoo-customers.js` | One-time migration of existing customers |
| `docs/06_ADR/0015-odoo-crm-sync-pattern.md` | ADR for this phase |

---

## Files to Modify

| File | Changes |
|------|---------|
| `worker/src/routes/auth.js` | On signup → POST `/api/odoo/leads` |
| `admin/customers.html` (or admin panel) | Show Odoo link, notes section |
| `docs/12_CHANGELOG.md` | Add CRM integration entry |
| `docs/05_TASKS/integration.md` | Update Odoo CRM task → ✅ |

---

## Implementation Steps

### Step 1: CRM Client & Mapper (3h)

1. Create `odoo-crm-client.js` extending `odoo-client.js`:
   ```javascript
   export class OdooCrmClient extends OdooClient {
     async createLead(values) { ... }  // model='crm.lead'
     async updatePartner(partnerId, values) { ... }  // model='res.partner'
     async addTag(partnerId, tagName) { ... }
   }
   ```
2. Implement `odoo-crm-mapper.js`:
   ```javascript
   function mapCustomerToLead(customer) {
     return {
       name: customer.name || customer.phone,
       phone: customer.phone,
       email: customer.email,
       x_our_customer_id: customer.id,  // custom field for mapping
       tag_ids: mapLoyaltyTier(customer.tier)
     };
   }
   ```
3. Unit tests: verify mapping fields, tier → tag conversion

### Step 2: Lead Creation on Signup (4h)

1. Extend `POST /api/odoo/leads`:
   - Input: `{ customerId: string }` (from auth flow)
   - Fetch customer from D1
   - Check consent flag (only sync if consented)
   - Transform via mapper → Odoo lead values
   - Call `odooCrmClient.createLead(values)`
   - Save mapping: `local_id=customer.id → odoo_id=lead.id`
   - Return: `{ success: true, leadId }`
2. Hook into `auth.js` — after customer created, trigger lead sync
3. Tests:
   - Mock Odoo CRM → verify lead created
   - Test idempotency: duplicate → returns existing
   - Test consent: no consent → skip sync

### Step 3: Loyalty Tier Tagging (3h)

1. Extend `odoo-crm-mapper.js`: `mapLoyaltyTier(tier)` → Odoo tag IDs
   - Bronze → tag "Bronze Member"
   - Silver → tag "Silver Member"
   - Gold → tag "Gold Member"
   - Platinum → tag "VIP"
2. Pre-create tags in Odoo (manual step or API call)
3. On tier upgrade (loyalty.js → webhook), update Odoo tags:
   ```javascript
   await odooCrmClient.addTag(partnerId, newTierTag);
   await odooCrmClient.removeTag(partnerId, oldTierTag);
   ```
4. Tests: tier change → tags updated in Odoo

### Step 4: Admin Panel Integration (3h)

1. In admin customer view (`admin/customers.html` or React admin):
   - Show Odoo partner link: "View in Odoo" (opens Odoo URL)
   - Display Odoo notes field (pulled from Odoo)
   - Button: "Sync to Odoo" (manual trigger)
2. Endpoint: `GET /api/admin/customers/:id/odoo-notes`:
   - Fetch Odoo partner by our customer ID (via mapping)
   - Return notes, tags, last activity
3. Tests: admin can view Odoo data

### Step 5: Webhook Receiver (Odoo → us) (2h)

1. Odoo can push contact updates (notes, tag changes)
2. Endpoint: `POST /api/webhooks/odoo-crm`:
   - Verify signature
   - Parse `res.partner` write operation
   - Find local customer by `x_our_customer_id` custom field
   - Update our customer record (notes, tier if tag changed)
3. Idempotency: use Odoo `write_date` to skip old updates
4. Tests: Odoo note update → our DB updated

### Step 6: Backfill Script (1h)

1. Script: `scripts/backfill-odoo-customers.js`:
   - Fetch all customers from D1
   - For each (with consent), create Odoo lead/partner
   - Skip if mapping exists
   - Log: successes, failures
2. Run: `node scripts/backfill-odoo-customers.js --dry-run` first
3. Production run: `node scripts/backfill-odoo-customers.js`
4. Estimated: ~1000 customers → ~30 min runtime

---

## API Reference

### POST /api/odoo/leads

**Auth:** Owner JWT (called internally by auth service)

**Body:**
```json
{
  "customerId": "cust_123"
}
```

**Response:**
```json
{
  "success": true,
  "leadId": 456,
  "odooPartnerId": 789,
  "mappingId": 123
}
```

### GET /api/admin/customers/:id/odoo-notes

**Auth:** Admin JWT

**Response:**
```json
{
  "partnerId": 789,
  "notes": "VIP customer, prefers iced coffee",
  "tags": ["Gold Member", "Coffee Lover"],
  "lastActivity": "2026-06-25T14:30:00Z",
  "odooUrl": "https://odoo.example.com/web#id=789&model=res.partner"
}
```

### POST /api/webhooks/odoo-crm

**Auth:** `X-Odoo-Signature` header (HMAC-SHA256)

**Body:**
```json
{
  "model": "res.partner",
  "operation": "write",
  "record_id": 789,
  "values": {
    "comment": "Updated note from sales team"
  },
  "write_date": "2026-06-26T10:25:00Z"
}
```

**Response:** `200 OK`

---

## Database Schema

```sql
-- Extend odoo_mappings (from Phase 1) for CRM entities
-- Already supports 'customer' local_type

-- Optional: cache Odoo partner data for faster admin panel
CREATE TABLE odoo_partner_cache (
  customer_id TEXT PRIMARY KEY,
  odoo_partner_id INTEGER NOT NULL,
  notes TEXT,
  tags TEXT,  -- JSON array
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  odoo_write_date TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);
```

---

## Testing Checklist

- [ ] `odoo-crm-mapper.test.js`: customer → lead mapping, tier → tag
- [ ] `odoo-crm-sync.test.js`: lead creation, tag updates
- [ ] Webhook test: Odoo note update → our DB
- [ ] Backfill script dry-run: show count, skip existing
- [ ] Admin panel: Odoo notes display
- [ ] Idempotency: duplicate lead creation → no error
- [ ] Lint: `npm run lint` passes

---

## Acceptance Criteria

### Must Have (P2)
- ✅ New customers → Odoo leads (2s SLA)
- ✅ Loyalty tiers synced as Odoo tags
- ✅ Admin can view Odoo notes/activity
- ✅ Odoo contact updates → our DB (webhook)
- ✅ Backfill script for existing customers

### Nice to Have (P3)
- Odoo opportunity pipeline sync
- Sales forecast integration
- Automated follow-up tasks in Odoo

---

## Rollback

1. Disable lead creation webhook in `auth.js`
2. Remove Odoo links from admin panel
3. Backfill data remains (read-only, harmless)

---

## Unresolved Questions

1. **Odoo CRM fields:** Which fields beyond name/phone/email are needed?
2. **Lead workflow:** Should new leads auto-assign to sales team?
3. **Consent granularity:** Can customers opt-out of CRM sync separately?
4. **Odoo instance capacity:** Can handle 1000+ contact syncs?

---

**Next:** All 3 Odoo phases complete → proceed to next pillar (pretix or SMTP), or start TastyIgniter as planned.
