# Brainstorm Report: ERPNext Pivot — Thay Odoo + TastyIgniter

**Date:** 2026-06-30 | **Status:** Approved | **Decision:** Switch to ERPNext

---

## Problem Statement

Sau khi hoàn thành Odoo pillar (foundation code, chưa test được vì thiếu credentials), phát hiện:

1. Odoo Community Edition **không có module Accounting** — cần mua Odoo Enterprise ($30-100/tháng) hoặc custom module
2. Odoo JSON-RPC API phức tạp hơn REST API chuẩn
3. Cần thêm TastyIgniter (35h) cho online ordering → tổng 2 hệ thống rời rạc
4. TastyIgniter là PHP stack, cần VPS riêng, khác hoàn toàn với CF Workers

**Goal:** 1 hệ thống ERP miễn phí 100%, tích hợp được với Cloudflare Workers, thay thế cả Odoo + TastyIgniter.

---

## Evaluated Approaches

### A. Stay Odoo + TastyIgniter (baseline)

| Pros | Cons |
|------|------|
| Odoo code đã viết xong (40h) | Odoo Community thiếu Accounting |
| TastyIgniter chuyên F&B | 2 hệ thống rời rạc (Odoo + TastyIgniter) |
| | JSON-RPC phức tạp hơn REST |
| | Tổng effort: 40h done + 35h TastyIgniter = 75h |
| | Odoo Enterprise phí $30-100/tháng |

### B. ERPNext (Selected)

| Pros | Cons |
|------|------|
| 100% free GPL v3 — tất cả module có sẵn | Cần refactor Odoo code đã viết (15h) |
| REST API chuẩn (Frappe) — dễ hơn JSON-RPC | Vẫn cần VPS/RPi để chạy (Python) |
| 1 hệ thống = Accounting + POS + CRM + Inventory | ERPNext Web Shop không mạnh bằng TastyIgniter cho F&B |
| Có sẵn POS module — thay thế được cả TastyIgniter | E-invoice VN cần custom app |
| Cộng đồng lớn, docs tốt, nhiều plugin | Team cần học Frappe framework |

### C. ERPNext + TastyIgniter (hybrid)

| Pros | Cons |
|------|------|
| ERPNext làm ERP, TastyIgniter làm ordering | Vẫn 2 hệ thống = phức tạp |
| Online ordering mạnh hơn ERPNext Web Shop | Tổng effort cao nhất ~60h |

---

## Final Decision: Switch to ERPNext

**ERPNext thay thế:** Odoo (ERP) + TastyIgniter (ordering) → 1 hệ thống duy nhất

### Target Architecture

```
ERPNext (Python/Frappe + MariaDB)          Aura CF Workers + D1
┌────────────────────────────┐           ┌──────────────────────┐
│ 📊 Accounting (free)       │──REST API─▶│ 🍳 KDS (bếp)         │
│ 🏪 POS Module              │           │ 👑 Loyalty (points)   │
│ 👥 CRM                     │           │ 💰 Cashback Wallet    │
│ 📦 Inventory               │           │ 🔗 Referral Engine    │
│ 🛒 Web Shop (ordering)     │           │ 📊 Admin Dashboard    │
│ 🧾 E-invoice VN (custom)  │           │ 📱 Zalo ZNS           │
└────────────────────────────┘           └──────────────────────┘
```

**ERPNext quản lý:** Accounting, POS, CRM, Inventory, Web Shop (online ordering), E-invoice
**Aura giữ:** KDS (bếp), Loyalty + Cashback, Referral, Admin Dashboard, Zalo ZNS — những thứ custom cho Aura Cafe

### 5-Phase Implementation Plan

| Phase | What | Effort | Depends On |
|-------|------|--------|------------|
| **1. Setup ERPNext** | Cài ERPNext trên VPS/RPi, config module Accounting/POS/CRM | 4h | — |
| **2. Refactor Odoo → ERPNext** | Viết ERPNext API client thay Odoo client. Sửa cron, webhook, loyalty trigger sang REST API | 15h | Phase 1 |
| **3. Menu + Inventory Sync** | Đồng bộ product/category từ ERPNext → D1. Delta sync + webhook như pattern Odoo đã làm | 8h | Phase 2 |
| **4. E-invoice VN** | Custom ERPNext app cho hóa đơn điện tử VN (VNPT/VNInvoice). Tích hợp với Accounting module | 10h | Phase 1 |
| **5. Web Shop Integration** | ERPNext Web Shop làm online ordering. Order forward sang Aura để loyalty + KDS | 8h | Phase 3 |

**Total: ~45h** (so với Odoo 40h + TastyIgniter 35h = 75h)

### What Happens to Existing Odoo Code

| File | Action |
|------|--------|
| `worker/src/clients/odoo-client.js` | Rewrite → `erpnext-client.js` (REST API) |
| `worker/src/clients/odoo-crm-client.js` | Merge vào ERPNext client |
| `worker/src/clients/odoo-product-client.js` | Rewrite → ERPNext product sync |
| `worker/src/routes/odoo.js` | Rewrite → `erpnext.js` routes |
| `worker/src/routes/odoo-pos.js` | Merge vào erpnext routes |
| `worker/src/routes/odoo-invoices.js` | Rewrite → ERPNext invoice |
| `docs/06_ADR/0013-0015-*.md` | Giữ lại làm reference, viết ADR mới cho ERPNext |
| `js/checkout/cart-summary.js` | Sửa API URL → ERPNext endpoint |

### Risk Assessment

| Risk | Mitigation |
|------|------------|
| ERPNext cần VPS Python — không phải serverless | Dùng Raspberry Pi (0đ/tháng) hoặc VPS 1GB (~100K/tháng) |
| Refactor 40h Odoo code → mất thời gian | API pattern giống nhau (REST vs JSON-RPC), ~60% code reuse |
| ERPNext Web Shop yếu hơn TastyIgniter | Giữ Aura ordering UI hiện tại làm fallback |
| E-invoice VN chưa có app sẵn | Custom ERPNext app — có thể contribute open source |
| Học Frappe framework mới | Docs tốt + cộng đồng lớn. REST API không cần biết sâu Frappe |

---

## Success Metrics

- [ ] ERPNext instance chạy ổn định, API accessible từ CF Workers
- [ ] Sync 2 chiều: products, orders, customers giữa ERPNext ↔ D1
- [ ] Loyalty points vẫn tính đúng khi order từ ERPNext Web Shop
- [ ] KDS hiển thị order từ ERPNext
- [ ] E-invoice tạo được từ ERPNext Accounting
- [ ] 859 tests vẫn pass sau refactor

---

## Next Steps

1. `/ck:plan` — tạo implementation plan chi tiết 5 phase dựa trên brainstorm này
2. Cài ERPNext instance để có API URL test
3. Bắt đầu Phase 1: Setup + Phase 2: Refactor

---

## Unresolved Questions

- ERPNext version: v14 (stable) hay v15 (latest)?
- Web Shop có cần custom theme cho Aura Cafe brand không?
- E-invoice provider: VNPT hay VNInvoice?
- Ai sẽ cài + maintain ERPNext server? (cần Linux skill cơ bản)
