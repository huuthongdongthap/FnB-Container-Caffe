# ADR 0014 — Odoo POS/Product Sync Pattern

**Date:** 2026-06-30 | **Status:** Accepted | **Phase:** 2 (POS/Inventory)

---

## Context

Menu và inventory của Aura Cafe cần đồng bộ 2 chiều giữa D1 (local) và Odoo (backend). Cần pattern để:
- Đẩy menu + giá + tồn kho từ Odoo → D1 (source of truth: Odoo)
- Cập nhật tồn kho từ D1 → Odoo khi có order (giảm stock)
- Availability check trước checkout (tránh bán món hết hàng)

## Decision

**Delta polling + webhook hybrid.**

1. **Cron delta sync (15 phút):** Gọi `search_read` với `write_date > last_sync` → upsert vào `odoo_product_sync` + D1 `products`
2. **Webhook receiver (`POST /api/webhooks/odoo`):** Odoo automation rule gọi webhook khi product thay đổi → sync ngay
3. **Availability check tại checkout:** `GET /api/odoo/products/:id/availability` — đọc từ D1 (cache 30s KV cho hot items)
4. **Write-back:** Sau order, trừ stock trong D1 + queue Odoo update

## Data Flow

```
Odoo (source of truth)
  │
  ├── Cron 15min (delta poll) ──→ D1 products table
  ├── Webhook push (real-time) ──→ D1 products table
  │
  ▼
D1 products
  │
  └── GET /api/odoo/products/:id/availability ──→ checkout UI
  │
  └── Stock decrease on order ──→ queue → Odoo write-back
```

## Rationale

- **Delta sync (15min):** Giảm load Odoo API (không full sync mỗi lần)
- **KV cache:** Hot products có sub-ms lookup, không cần query D1
- **Write-back async:** Không block order flow

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Full sync mỗi 5 phút | Tốn Odoo API calls, hơn 100 products → 100+ calls |
| D1 là source of truth | Odoo là ERP, business logic nên ở Odoo |
| No webhook, chỉ cron | Menu update delay 15 phút, không acceptable cho hết hàng |

## Consequences

- **Positive:** Near real-time sync (webhook) + eventual consistency (cron)
- **Negative:** 2 sync paths → risk duplicate/race condition. Mitigated by: write_date check + upsert
- **Risk:** Odoo automation rule cần dev Odoo config, không làm được từ Worker side

## Related

- `0013-odoo-accounting-integration.md`
- `worker/src/clients/odoo-product-client.js` — Sync implementation
- `worker/src/routes/cron.js` — `processOdooProductSync()`
