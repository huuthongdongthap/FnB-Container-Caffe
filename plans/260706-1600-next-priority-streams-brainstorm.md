# Brainstorm — Next Execution Plan: Physical Buildout + QR Ordering + 4 Pillars Integration

**Date:** 2026-07-06
**Branch:** main (commit fca9ead)
**Verdict:** GO (all 3 streams) | Parallel execution recommended

---

## Stream 1: Physical F&B Buildout — Vendor Selection + Regulatory Path

### Problem

Container cafe tại Sa Đéc, Đồng Tháp (39 Nguyễn Tất Thành) chưa có vendor chọn. PCCC approval là #1 risk. 0/10 staff hired. CAPEX ~750M VND. Timeline 8 tuần W-8→W-0.

### Options

| # | Approach | CAPEX | Timeline | PCCC Risk | Complexity |
|---|----------|-------|----------|-----------|------------|
| **A — Frame-only + local turnkey** | Mua frame container (150-250M) từ Đồng Tháp supplier → tự nội thất | 450-600M | 8-10 tuần | Cao (tự quản lý) | Cao (multi-vendor) |
| **B — Full turnkey** | 1 vendor chịu trách nhiệm trọn gói (container + interior + PCCC support) | 650-850M | 6-8 tuần | Thấp (vendor hỗ trợ) | Thấp (single POC) |
| **C — Refurbished container** | Mua container cũ reshape | 300-450M | 10-12 tuần | Trung bình | Trung bình |

**Recommendation: B — Full turnkey, Đồng Tháp supplier.**

Rationale:
- PCCC approval là critical path. Single vendor chịu trách nhiệm → 1 POC thay vì 3-4 vendors.
- YAGNI: không cần over-engineer nếu user đã quyết định location + concept.
- Timeline 6-8 tuần → vẫn kịp nếu start ngay W-8.
- Cost premium 100-200M VND vs frame-only = insurance cho legal + timeline.

### Staffing Priority (Parallel Track)

| Role | Hire By | Priority | Source |
|------|---------|----------|--------|
| Barista/Cashier | W-6 | P0 | Local Sa Đéc recruitment |
| Kitchen staff | W-5 | P0 | Đồng Tháp vocational school |
| Manager | W-4 | P0 | Internal promotion / headhunt |
| Cleaner | W-3 | P1 | Local referral |

**Action:** Start recruitment parallel container order — không wait container xong mới hire.

### Next Steps (This Week)

1. **Vendor shortlist + site visit Đồng Tháp** — 3 suppliers, quote frame vs turnkey
2. **PCCC consultancy** — hire local consultant có experience container build PCCC approval
3. **GPKD + VSATTP preliminary filing** — start early, không wait container ready
4. **Staff job posts** — 2 channels: local FB groups + vocational school

---

## Stream 2: QR Table Ordering

### Problem

Khách hàng ngồi bàn → không có cách order trực tiếp từ điện thoại. Hiện phải nhân viên nhận order → manual → bottleneck giờ cao điểm.

### Scope

| Feature | Description | Complexity |
|---------|-------------|------------|
| QR code per table | Mỗi bàn có QR chứa `table_id` | Low (qrcodejs lib) |
| Guest order flow | Scan QR → view menu → cart → checkout (no auth) | Medium |
| Table status management | `free` → `occupied` → `paid` → `free` | Low |
| Admin QR generator | Page tạo/print QR stickers per table | Low |
| Revenue attribution | Orders from QR → linked to table + zone | Low |

### Implementation Approach (5 phases, TDD)

**Phase 1: Backend — Table + QR endpoints**

- `GET /api/tables` — list tables with status (ép sang staff hoặc allow public read — **P0 security decision**)
- `PATCH /api/tables/:id/status` — staff-only, node: `free` → `occupied` → `paid`
- `POST /api/orders/table` — guest order flow (no JWT, session-based)
- `GET /api/qr/:tableSlug` — serve QR image per table

**Touchpoints:** `worker/src/routes/tables.ts` (new), `worker/src/routes/orders/create-order.ts` (add `table_id` field), D1 migration add `table_id` to orders.

**P0 Security decision needed:** Guest ordering → no auth cómo protect? Options:
- (A) Session token generated on first QR scan, stored in IndexedDB
- (B) Time-limited one-time order tokens per table per day
- (C) Signature-based: `?table=X&sig=HMAC(timestamp|table, secret)` → 5 min expiry

**Recommendation: C** — stateless, no session store, expires fast.

**Phase 2: Frontend — Guest ordering page**

- Route: `/table/:tableSlug` — public, no auth
- Read table info + menu (online-first → offline fallback)
- Cart → checkout → order confirmation (with OTP or table code verification)
- G9 offline mode already supports this (useOrderStore queued orders auto-sync)

**Phase 3: Admin — QR generator page**

- `/admin/generate-qr` already exists — extend with table selection + print layout
- A4 sticker template: 2x3 grid fits standard 40x40mm QR stickers

**Phase 4: Staff — Table management**

- KDS + POS show table → order mapping
- KDS: filter by table, mark order ready → table notification

**Phase 5: E2E + Reporting**

- Revenue per table/zone analytics
- Average dwell time (table occupied duration)

### Risk

- Guest scam: false orders → mitigate with OTP sent to staff device
- Session hijacking: signature expiry mitigates but not prevents shared QR
- YAGNI: skip dwell time analytics, OTP → defer Phase 5 to v2

---

## Stream 3: 4 Pillars Integration — Parallel Plan

### Pillar Status Summary

| Pillar | Current | Gap | Effort | Dependency |
|--------|---------|-----|--------|------------|
| **ERPNext (Phase 08)** | Phase 1-7 done | 🔴 Blocked on credentials | ~15h | ERPNext self-hosted instance |
| **TastyIgniter** | Partial | Menu sync, order bridge, customer merge | ~35h | ERPNext (if using as POS) |
| **OpenWISP** | Zero | WiFi captive portal, zone network mgmt | ~30h | Hardware (Raspberry Pi + WiFi AP) |
| **Home Assistant** | Partial | IoT automation (lights, AC, smart locks) | ~15h | Hardware (Raspberry Pi + sensors) |
| **Frigate** | Zero | NVR camera integration | ~20h | Hardware (cameras + Pi + HA) |

### Approach: 2 Parallel Runs

**Run A: ERPNext Phase 08** (software only, no hardware)

Unblocks TastyIgniter (TastyIgniter can use ERPNext as shared customer/product DB). When credentials arrive → full checkout.

Files: extend existing `worker/src/routes/erpnext/` routes, add Phase 08 migration, test with mock ERPNext API.

**Run B: Home Assistant + Frigate** (IoT + cameras, Pi-based)

HA runs on Pi → Frigate runs on same Pi → OpenWISP runs on router/AP.
Plan: HA automations for zone lighting + AC → Frigate NVR → OpenWISP WiFi management.

**OpenWISP deferred** — needs hardware deployment at container site. Not startable until physical site exists.

### Touchpoints

- ERPNext: `worker/db/migrations/`, `worker/src/routes/erpnext/`, `worker/src/index.ts`
- HA + Frigate: new `worker/scripts/ha-*.mjs`, D1 tables for device registrations
- OpenWISP: separate infra plan — `docs/05_TASKS/openwisp-setup.md`

---

## Execution Order Recommendation

```text
Immediate (this week):
├── QR Table Ordering — /ck:plan --deep --tdd (START NOW, 1 sprint)
├── Vendor brainstorm + site visit Đồng Tháp
├── Recruitment launch (2 roles: barista + kitchen)
└── ERPNext credential follow-up (send reminder)

Week 2:
├── QR implementation (Phase 1-3)
├── PCCC consultancy
└── ERPNext Phase 08 (if credentials arrive)

Week 3-4:
├── QR Phase 4-5 (E2E + reporting)
├── Container order signed
└── HA + Frigate brainstorm → plan

Week 5-8:
├── OpenWISP + container site prep
└── Regulatory filings parallel container build
```

## Unresolved Questions

1. **QR Security:** C (HMAC signature) vs B (one-time tokens) — C is stateless but HMAC secret must be in env; B needs session store in D1/KV.
2. **ERPNext credentials:** When will VPS + ERPNext be ready for Phase 08 testing?
3. **HA hardware budget:** Raspberry Pi 5 + sensors + cameras — budget approval needed (~15M VND).
4. **Staff hiring timeline:** Sa Đéc labor market depth — can we find 10 staff in 6 weeks?
5. **StitchFix100:** `StitchMobileOrderNew.tsx` is an empty stub — relevant to QR ordering? Reuse or rebuild?
