# ADR 0013 — Odoo Accounting Integration Approach

**Date:** 2026-06-30 | **Status:** Accepted | **Phase:** 1 (Accounting/E-invoicing)

---

## Context

Aura Cafe cần hóa đơn điện tử (e-invoice) tuân thủ quy định Việt Nam. Odoo ERP được chọn làm hệ thống accounting backend. Cần quyết định pattern tích hợp giữa Cloudflare Workers và Odoo JSON-RPC API.

## Decision

**Pattern: Fire-and-forget với retry queue.**

1. Mỗi order hoàn thành → trigger `createOdooInvoice()` non-blocking
2. Odoo invoice creation gọi `account.move` qua JSON-RPC
3. Nếu thất bại → ghi vào `odoo_sync_failures` table, cron retry mỗi 5 phút (max 3 lần)
4. VAT e-invoice submission qua VNPT/VNInvoice API (provider TBD)
5. Customer notification: Zalo ZNS + Email (SendGrid) + Telegram

## Rationale

- **Non-blocking:** Không để Odoo downtime ảnh hưởng đến order flow
- **Retry queue:** Đảm bảo eventual consistency, không mất invoice
- **JSON-RPC:** Protocol chuẩn của Odoo, không cần middleware
- **Self-hosted Odoo:** Chi phí 0 VND/tháng (vs Odoo.sh $30-100/tháng)

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Odoo.sh (cloud) | $100+/tháng, vi phạm nguyên tắc cost optimization |
| REST API wrapper | Không có sẵn, cần build middleware PHP/Python |
| Webhook-only (no polling) | Odoo webhook không reliable, cần retry queue |
| Direct sync (blocking) | Order flow bị chậm, bad UX |

## Consequences

- **Positive:** Cost 0 VND (self-hosted), full control, eventual consistency
- **Negative:** Cần maintain Odoo instance (Raspberry Pi hoặc VPS ~100K/tháng)
- **Risk:** Odoo version upgrade có thể break JSON-RPC schema

## Related

- `0014-odoo-pos-sync-pattern.md` — Product/POS integration
- `0015-odoo-crm-sync-pattern.md` — CRM customer sync
- `worker/src/clients/odoo-accounting-client.js` — Implementation
