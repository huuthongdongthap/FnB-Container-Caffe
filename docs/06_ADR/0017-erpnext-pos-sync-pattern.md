# ADR 0017 — ERPNext POS/Product Sync Pattern

**Date:** 2026-06-30 | **Status:** Accepted | **Phase:** 2 (POS/Inventory)

---

## Context

Product catalog and stock levels need sync between D1 (local) and ERPNext (backend). Odoo used `search_read` on `product.product` and `stock.quant`; ERPNext uses the `Item` doctype and `Bin` for stock.

## Decision

**Delta sync via `modified` timestamp with ERPNext REST API.**

1. **Cron delta sync:** GET `/api/resource/Item?filters=[["modified",">=","{last_sync}"]]` → upsert into `odoo_product_sync` + D1 products
2. **Bin stock lookup:** GET `/api/resource/Bin?filters=[["item_code","=","..."]]` for stock levels
3. **Availability check:** KV-cached (30s TTL), falls back to D1
4. **Webhook receiver:** Preserved route at `POST /api/webhooks/erpnext` for real-time product changes

## Rationale

- **Same sync pattern** as Odoo ADR-0014, adapted for REST instead of `search_read`
- **Bin stock** is ERPNext's standard stock level doctype, analogous to `stock.quant`
- **KV cache** carries over — hot items remain sub-ms

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Odoo `stock.quant` approach | Different schema, not applicable to ERPNext |
| Full sync every 5 min | API call overhead for 100+ items |

## Consequences

- **Positive:** Same delta-sync logic reused, only client transport changed
- **Positive:** KV cache from Odoo phase carries over unchanged
- **Negative:** Bin object requires both Item code + warehouse filter

## Related

- `0016-erpnext-accounting-integration.md` — Accounting
- `worker/src/clients/erpnext-product-client.js`
- `worker/src/routes/erpnext-pos.js`
