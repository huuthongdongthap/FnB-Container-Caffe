---
date: 2026-09-12
version: 1.0
status: M0 legacy discovery (v2 §13 M0)
evidence: SOP corpus + FEATURE_MATRIX + CURRENT_OPERATION
---
# PROCESS MAP — as-run processes → AURA domain owners

Maps every operational process from CURRENT_OPERATION.md to its v2 §16
authority + current surface + M-phase where it hardens.

## 1. Daily operating arc (one business day)

```
06:00 OPEN (SOP 01)
  → attendance (FaceID/app)          [Staff domain]
  → uniform + machine warm-up        [SOP, paper]
  → stock check top-10 ingredients    [Inventory — currently eyes+app view]
07:00–22:00 TRADE
  → order in (POS / QR / online)     [Order — PROD]
  → pay (cash/Stripe/crypto)         [Payment — PROD]
  → kitchen ticket /kds              [Kitchen — PROD]
  → serve + complete                 [Order — PROD]
  → loyalty auto-earn                [Loyalty — PROD]
  → loyalty redemption               [Loyalty — PROD]
  → reservation walk-in/booked       [Reservation — PROD]
  → low stock? Cường buys direct     [Purchasing — ❌ manual, no PO]
21:30–22:30 CLOSE (SOP 02)
  → cash count                       [Shift recon — ❌ no system report]
  → closing checklist                 [SOP, paper]
  → (month end) Excel consolidation   [Reporting — ❌ Excel truth]
```

## 2. Process → owner table

| Process | v2 §16 authority | AURA status | Surface | Harden in |
|---|---|---|---|---|
| Attendance check-in | AURA OPS (staff) | 🟡 app-based, no shift report | HR app | M2 |
| Uniform & readiness check | SOP (Kit) | paper | — | M7 Kit |
| Machine prep | SOP (Kit) | paper | — | M7 Kit |
| Stock check (top-10) | AURA INVENTORY | 🟡 manual + stock view | /admin/inventory | M2 |
| Order creation (all channels) | AURA ORDER | ✅ | /checkout, POS | M1 (contract) |
| Payment capture | AURA PAYMENT | ✅ | checkout | M1 (contract) |
| Kitchen queue | AURA KITCHEN | ✅ | /kds | M2 (dedupe) |
| Serve/complete | AURA ORDER | ✅ | /track-order | — |
| Loyalty earn/redeem | AURA CRM | ✅ | /loyalty, /account | M3 views |
| Reservation | AURA ORDER (table) | ✅ | /table-reservation | M2 (policy→domain) |
| Purchasing (buy when low) | AURA INVENTORY | ❌ direct-buy | — | **M2** |
| Cash reconciliation per shift | AURA OPS (shift) | ❌ | — | **M2** |
| Revenue consolidation | AURA HQ | ❌ Excel | — | **M2** |
| Customer feedback | AURA CRM | ✅ reviews live | /reviews | M3 |
| Marketing (student ambassadors) | AURA CRM (campaigns) | 🟡 manual playbook | /admin/campaigns | M3 |
| HR (performance, payroll) | AURA OPS | ❌ specs only (19–23) | — | M3+ |

## 3. Golden loop coverage (v2 §8)

CUSTOMER→MENU→ORDER→PAYMENT→KITCHEN→READY→SERVE→COMPLETE→CRM EVENT→REPORTING

- CUSTOMER→…→COMPLETE: **fully live** (each step creates reliable state —
  DO broadcast timeline, webhook payment sync, loyalty earn events)
- CRM EVENT: earned/broadcast events exist; **visit recording and product
  preference views missing** → M3
- REPORTING: events captured but **not surfaced to owner** (Excel is the
  report) → M2 dashboard

**Loop integrity = 7/10 steps reliable-state today; the 3 missing steps
are all in reporting/CRM visibility, not transaction capture.**

## 4. SOP corpus = embryonic AURA CAFE Kit (v2 §11)

7 SOPs exist as wall-laminated paper: opening, closing, barista recipes
(25 drinks), cashier POS, cleaning, safety, receiving. Per v2 §11 the Kit
must eventually carry Brand/Menu/SOP/Training — the **content** already
exists; the packaging (digital SOP module) is M7. Kit readiness noted,
not built early (D8: do not generalize prematurely).
