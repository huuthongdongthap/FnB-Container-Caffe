# Minimal Viable SaaS Scope — Solo OPC F&B (Cloudflare Workers)

**Project:** FnB Container Caffe SaaS Pivot — B2B white-label for solo coffee shop owners  
**Constraints:** Single operator, no employee accounts, mobile-first, Workers + Hono + D1  
**Date:** 2026-08-04  

---

## 1. Top-N Features (P0 — Ship First)

| # | Feature | Evidence in codebase | Reuse target |
|---|---------|---------------------|--------------|
| **F1** | **Guest Check-In (QR scan → name + phone, no login)** | `POST /api/checkin` exists; returns reward balance; duplicate-day guard | `src/routes/checkin.ts` |
| **F2** | **Dine-In (QR per table → menu → order → payment → status)** | QR signer in `tree/qr/`, tables seeded, `orders-mobile.ts` handles waiter=guest | `orders-mobile.ts` + `tables.ts` |
| **F3** | **Takeaway / Delivery (same order flow, no table)** | Same `orders` schema; add `fulfillment_type` column only | Extend `POST /mobile/orders` |
| **F4** | **PayOS (online) + COD flag (cash on spot)** | create-link + webhook + refund fully wired | `src/routes/payments.ts` — add `payment_method` + `is_cod` |
| **F5** | **Admin Dashboard (orders + payout summary)** | `analyticsRouter` covers summary, top-products, peak-hours, CSV | `src/routes/analytics-hono.ts` — add payout = paid − refunded − COD |

Architecture fit: All 5 reuse existing route files. Zero new D1 tables for F1, F2, F4. Zero new infrastructure. F3 = 1 column. F5 = 1 subquery.

---

## 2. Menu Layer (P1 — Ship alongside F1-F3)

**NOT a separate app. Live inside checkout SPA.**

| Component | Notes |
|-----------|-------|
| Menu CRUD (name, price VND, category, image varchar, active flag) | Single operator only — no approval flow needed |
| Categories (Đồ uống, Ăn nhẹ, Combo) | Simple `menu_categories` table |
| Availability toggle | `active INTEGER` per item — owner flips from admin |

Reuse: No new route module needed — add to `menu.ts` or merge into admin-orders.

---

## 3. D1 Schema Delta (vs. existing migrations 001-013)

| New table / column | Why |
|--------------------|-----|
| `orders.fulfillment_type TEXT DEFAULT 'DINE_IN'` | F3 takeaway/delivery |
| `orders.payment_method TEXT DEFAULT 'payos'` | F4 COD vs online |
| `orders.is_cod INTEGER DEFAULT 0` | F4 fast filter for cash desk |
| `menu_items` table | F1/F2 menu (name, price_vnd, category, active) |
| `menu_categories` table | Menu grouping |

No new D1 tables for F1, F2, F5.

---

## 4. Deposit / COD Cash Desk (One Smart Button)

Solo OPC only — when `is_cod=true`:
- Flow: order created → status="cod_pending" → owner taps "Đã thu tiền" → status="completed"
- No PayOS link, no webhook, no refund path (COD is final)
- Cash payout is just: sum(paid status=cod_completed) — this feeds F5 payout summary directly

---

## 5. Mobile UX (3 screens)

| Screen | Purpose |
|--------|---------|
| **Guest flow** — scan QR → see menu → add → enter phone → submit → PayOS/COD | F1 + F2 |
| **Takeaway flow** — pick items → phone + address → COD or PayOS link | F3 |
| **Owner screen** — orders list + 1-tap status change + payout summary card | F2 + F5 |

No login for guest. Owner has one JWT session (already in codebase).

---

## 6. MVP Scope Cut (explicitly deferred)

| Deferred | Why |
|---------|-----|
| Employee accounts / staff roles | CEO is solo — adds complexity; come back if hires staff |
| Subscription billing per tenant | SaaS pricing tables exist (010/011) but tier-activation flow not wired — defer to Phase 2 |
| Promotions / vouchers | `promotions.ts` exists but unused for MVP |
| ERPNext sync | `erpnext-sync.ts` exists; POS integration is Phase 2 |
| Inngest workflows | Stripe webhooks — overkill for PayOS webhook + cron SLA already present |
| Multi-tenant tenant isolation | MVP is single-tenant (caffe owner); slug-based routing comes later |

---

## 7. Adoption Risk

| Risk | Level | Mitigation |
|------|-------|-----------|
| PayOS sandbox → live gap | MEDIUM | Test real transaction before CEO handover (barrier doc already covers this) |
| QR UX friction (camera permissions) | LOW | Use direct link fallback (table slug URL no QR) |
| COD fraud (no payment confirmation) | LOW | Solo operator sees customer face-to-face |
| Codebase bloat (9173 lines across routes) | MEDIUM | Only touch 5 files; no new route files |

---

## 8. Recommendation — Ranked

1. **Ship F4 first** (PayOS + COD) — payment is the revenue valve; everything else is display
2. **Ship F2 second** (Dine-In QR flow) — core F&B experience
3. **Ship F3 third** (Takeaway with same order code path) — 1 column diff
4. **Ship F1 fourth** (Guest checkin reward) — unlocks loyalty, low risk
5. **Ship F5 fifth** (Admin payout card) — 1 endpoint on existing analytics

F6 (menu CRUD) ships in parallel with F2 — same sprint, zero new patterns.

Total new line count estimate: ~300 lines (payment flag + COD flow + fulfillment_type + payout query). All reuse existing D1 + Hono + Zod infrastructure.

---

*Sources: `docs/ceo-handover.md`, `src/routes/checkin.ts`, `src/routes/payments.ts`, `src/routes/analytics-hono.ts`, `migrations/010_saas_pricing.sql`, `migrations/011_saas_tenants.sql`*
