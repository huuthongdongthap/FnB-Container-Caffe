---
phase: 3
gap: G5
title: ERPNext Sync Wiring
status: pending
effort: 10h
priority: P2
depends_on: []
---

# Phase 3: G5 ERPNext Sync Wiring (10h, P2)

## Mục tiêu / Objective

Wire ERPNext sync endpoints to live API — invoices, POS sales orders, CRM leads.

## Existing (đã có)

| File | Status |
|------|--------|
| `worker/src/routes/erpnext-sync.ts` | Route exists, mock mode active |
| `worker/src/clients/erpnext-client.ts` | Client stub with ERPNext API methods |
| `worker/src/routes/inventory/crud.ts` | Inventory CRUD working |

## Thiếu / What's Missing

1. **Live ERPNext API credentials** — config chưa có ERPNext base_url, api_key, api_secret
2. **Invoice creation** — push invoices từ AURA CAFE → ERPNext Sales Invoice
3. **POS Sales Order sync** — orders từ POS → ERPNext Sales Order
4. **CRM Lead sync** — customer inquiries → ERPNext Lead
5. **Error handling + retry** — xử lý ERPNext API failures gracefully
6. **Sync status tracking** — hiển thị trạng thái sync trong admin

## Implementation Plan

### Step 1: Environment config (worker/.env)

```bash
# ERPNext connection
ERP_BASE_URL=https://your-erpnext-domain.com
ERP_API_KEY=<api-key>
ERP_API_SECRET=<api-secret>
ERP_SYNC_ENABLED=false  # flip to true when ready
```

### Step 2: Extend erpnext-client.ts (worker/src/clients/erpnext-client.ts)

Thêm methods:
- `createSalesInvoice(data)` — POST /api/resource/Sales Invoice
- `createSalesOrder(data)` — POST /api/resource/Sales Order
- `createLead(data)` — POST /api/resource/Lead
- `syncInventory(data)` — POST /api/resource/Stock Entry

### Step 3: Wire order → ERPNext invoice (worker/src/routes/erpnext-sync.ts)

Trigger: sau khi order được payment_confirmed:

```typescript
// Sau order.payment_confirmed:
if (env.ERP_SYNC_ENABLED === 'true') {
  await erpnextClient.createSalesInvoice({
    customer: customerName,
    items: orderItems,
    total: orderTotal,
    // ...
  });
}
```

### Step 4: Wire inventory → ERPNext stock (order-deduction.ts)

Trigger: sau khi inventory deducted:

```typescript
// Sau order deduction:
await erpnextClient.syncInventory({
  items: deductedItems,
  warehouse: 'Stores - AURA',
  // ...
});
```

### Step 5: Admin sync status dashboard

UI component hiển thị:
- Last sync timestamp
- Sync success/failure count
- Manual re-sync button
- Error log

## Files

| Action | File |
|--------|------|
| MODIFY | `worker/src/clients/erpnext-client.ts` — add live API methods |
| MODIFY | `worker/src/routes/erpnext-sync.ts` — wire live sync triggers |
| MODIFY | `worker/src/routes/orders-hono.ts` — add invoice sync on payment |
| MODIFY | `worker/src/routes/inventory/order-deduction.ts` — add stock sync |
| CREATE | `src/components/admin/erpnext-sync-status.tsx` — sync dashboard |
| CREATE | `db/migrations/*_g5_erpnext_sync_tracking.sql` — sync log table |

## Risk

- ERPNext API rate limits — handle 429 with exponential backoff
- Data mapping complexity — AURA CAFE schema ≠ ERPNext schema, cần mapping layer
- One-way sync only — changes in ERPNext không reflect về AURA (by design)
