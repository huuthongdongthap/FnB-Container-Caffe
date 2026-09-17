---
date: 2026-09-12
version: 1.0
status: M0 legacy discovery (AURA_OS_Master_Plan_v2.md §13)
evidence: assets/brand/FNB_MASTER_DRIVE_AURA_SPACE_CONTAINER/05_Demos/ (all citations below)
---
# CURRENT OPERATION — AURA CAFE Sa Đéc (as-run today)

## 1. The café

- **Brand:** AURA CAFE — identity chosen 2026-06-06. Viva Star brand
  license still valid; owner is **gradually building AURA brand** while
  Viva Star remains the **primary coffee supplier** (owner correction
  2026-09-12 — see VIVA_STAR_LEGACY_MAP §1, §6)
- **Location:** Sa Đéc, Đồng Tháp — container rooftop café
- **Hours:** 07:00–22:00 daily (`00_MASTER_PLAN_REVISED_30-5.md`: extended-day normal ops)
- **Staff:** 4 people normally (Khánh, Cường, Thư, Ngọc — `99_DEEP_CHECK_AUDIT_30-5.md` §C3), 12–14 on event days
- **Owner:** "anh Còn" — decision maker, receives reports

## 2. How each workflow runs today

| Workflow | How it happens | Evidence |
|---|---|---|
| **Open shop** | SOP 01: 06:00–07:00 checklist (attendance FaceID/app, uniform, machine warm-up, 10-ingredient stock check vs `/admin/inventory/stock.html`) | `sop_staff/01_OPENING_CHECKLIST.md` |
| **Take order (in-store)** | AURA web POS (`/admin/pos`) + QR-at-table → checkout (dine-in/takeaway/delivery) | FEATURE_MATRIX (all ✅ PROD) |
| **Pay** | Cash (COD column) / Stripe / crypto NOWPayments | migration 014, ADR-0009 |
| **Kitchen** | KDS screen `/kds` (polling + DO broadcast) | ADR-0010 |
| **Loyalty** | 4-tier ladder auto-earn on order success; signup bonus 30k (reduced from 50k) | `00_MASTER_PLAN_REVISED_30-5.md`, commit aa9602f |
| **Close shop** | SOP 02: 21:30–22:30 checklist | `sop_staff/02_CLOSING_CHECKLIST.md` |
| **Revenue reporting** | **Excel** — `BAO-CAO thang 05.2026.xlsx`, DOANH THU sheet, 2 shifts/day, ~77 rows/month | `00_AUDIT_INVENTORY_CURRENT.md` §1.1 |
| **Inventory** | **Excel + eyes** — top-10 ingredient manual check at open; Cường buys directly when low, handwritten notes, no PO trail | same §2 gaps 1–7 |
| **Recipes** | SOP 03 paper (25 signature drinks) — auto-deduct from POS specified (Task 16) but not confirmed live | `sop_staff/03_BARISTA_RECIPES_SOP.md`, `16-recipe-auto-deduct.md` |
| **Staff/HR** | FaceID/app attendance check-in; HR module specs written (19–23) | `hr_module/`, SOP 01 §điểm danh |
| **Purchasing** | Manual, direct buy, no PO system; **Viva Star = primary coffee supplier** | inventory audit Gap 6 |
| **Owner visibility** | Daily Excel summary + Telegram order pings + Zalo group | audit + `tree/orders/telegram.ts` |
| **Marketing** | Student nano-ambassadors (30–40 THPT 11-12, ~1tr cost), organic IG/TikTok | `04b_STUDENT_MARKETING_PLAYBOOK.md` |

## 3. The one-truth problem (v2 §4) — live today

POS (AURA web) says one thing; **Excel** revenue sheet says another;
**Telegram/Zalo** carry order chatter; **staff memory/notebook** holds
stock gaps; **owner** reconciles at month end. The AURA platform owns
order/payment truth already — but inventory, purchasing, revenue
reporting, and HR still live outside it.

## 4. What the AURA platform already replaced (no legacy cutover needed)

Menu, order, payment, kitchen display, order tracking, loyalty, cashback,
referral, check-in, reviews, staff roles — all PROD with tests
(FEATURE_MATRIX). The café does NOT run a competing POS.

## 5. What remains manual/Excel (the real M0 gap)

1. Revenue consolidation (Excel DOANH THU sheet)
2. Inventory counts + low-stock alerts (manual eyes + app view)
3. Purchasing (direct buy, no PO/audit trail)
4. Recipe→stock auto-deduct (spec'd, unverified)
5. HR: attendance is app-based but shifts/payroll/performance are manual
6. Owner dashboard (v2 §15) — owner currently reads Excel + Telegram

## 6. Staffing reality (audit §C3)

Sa Đéc has no trained part-time barista/service pool; hiring 6–8 temp
staff for events is high-risk. SOPs compensate: written opening/closing/
recipes/cashier/cleaning/safety/receiving — i.e. **the SOP corpus is the
training system**. This validates v2 §2's "can the process be trained to
another café?" — the SOPs are the embryonic AURA CAFE Kit.
