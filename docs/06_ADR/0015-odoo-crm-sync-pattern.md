# ADR 0015 — Odoo CRM Customer Sync Pattern

**Date:** 2026-06-30 | **Status:** Superseded by ADR-0018 (ERPNext) | **Phase:** 3 (CRM)

---

## Context

Thông tin khách hàng cần đồng bộ giữa Aura D1 (loyalty, orders) và Odoo CRM (leads, tags, notes). Mỗi hệ thống có 1 phần data riêng:
- **D1:** Loyalty points, tiers, order history, referral network
- **Odoo:** CRM notes, tags, lead status, communication history

## Decision

**Event-driven sync với consent gate.**

1. **Customer registration → create Odoo lead:** Non-blocking, fire-and-forget
2. **Loyalty tier change → update Odoo tag:** `loyalty_tier:premium` → tag `Premium` trong Odoo
3. **Admin adds note → POST /api/odoo/leads/:id/notes:** Ghi CRM note trong Odoo
4. **Consent gate:** Chỉ sync nếu `odoo_customer_consent.consent=true` (opt-in)
5. **Direction:** D1 → Odoo (one-way). Odoo là CRM backend, không push về D1

## Rationale

- **Consent gate:** Tuân thủ GDPR tinh thần (dù VN chưa bắt buộc)
- **One-way sync:** Tránh conflict — mỗi field có 1 source of truth rõ ràng
- **Tag-based tier:** Odoo tag dễ filter/report, không cần custom field
- **Fire-and-forget:** CRM notes không critical path, có thể retry async

## Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Two-way sync | Conflict resolution phức tạp, không cần thiết cho CRM notes |
| Odoo là source of truth cho customer | Loyalty data (points, referral) không fit Odoo model |
| Batch sync hàng đêm | Admin notes cần real-time để customer support kịp thời |

## Consequences

- **Positive:** Clean separation — Odoo cho CRM, D1 cho loyalty
- **Negative:** Data fragmentation — support staff cần mở cả 2 system
- **Mitigation:** Admin UI hiển thị Odoo notes/tags embed trong customer page

## Related

- `0013-odoo-accounting-integration.md`
- `worker/src/clients/odoo-crm-client.js` — CRM client
- `worker/src/routes/odoo.js` — CRM routes
- `admin/customers.html` — Embedded Odoo display
