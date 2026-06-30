# Phase 08 — E2E with Real ERPNext Instance

**Priority:** P1 | **Status:** blocked | **Effort:** 8h | **Depends:** Phase 07

## Blocker

**Requires:** ERPNext instance URL + API key + API secret
- Self-hosted on Raspberry Pi/VPS, OR
- Frappe Cloud free trial (14 days)

## Setup Steps

1. **Install ERPNext v14 (stable)**
   ```bash
   # Option A: Frappe Docker (easiest)
   docker run -d --name erpnext -p 8080:80 frappe/erpnext:v14
   
   # Option B: Manual install on Ubuntu 22.04
   # https://github.com/frappe/bench
   ```

2. **Configure API access**
   - Create API Key + API Secret in ERPNext
   - Enable CORS for CF Worker domain
   - Test: `curl -H "Authorization: token {key}:{secret}" https://{host}/api/resource/Item?limit=1`

3. **Setup minimal data**
   - Create 3 test Items (products)
   - Create 1 test Customer
   - Verify Item availability via Stock Entry

## E2E Tests

### Test 1: Product sync
```bash
# Trigger cron
curl -X POST https://fnb-caffe-container.pages.dev/api/erpnext/products/sync \
  -H "Authorization: Bearer {admin_token}"
# Expect: { success: true, synced: N }
```

### Test 2: Invoice creation
```bash
# Create test order, trigger invoice
# Expect: Sales Invoice created in ERPNext
```

### Test 3: CRM lead creation
```bash
# Register new customer
# Expect: Lead/Customer created in ERPNext, tags applied
```

### Test 4: Product availability
```bash
# GET /api/public/products/:id/availability
# Expect: { available: true/false } from ERPNext Bin
```

### Test 5: Webhook
```bash
# Simulate ERPNext webhook to /api/webhooks/erpnext
# Expect: 200 OK, product synced to D1
```

## Verification

- [ ] All Phase 1-7 tests still pass
- [ ] E2E test 1-5 pass with real ERPNext
- [ ] No errors in worker logs
- [ ] Data consistent between D1 and ERPNext

## Fallback

If ERPNext instance unavailable:
- Skip Phase 8
- Mark plan as "Code Complete — Pending ERPNext Instance"
- Proceed to `npm run deploy:full` (ERPNext routes return 503 until configured)
