# Deep Check — GRAND_OPENING_6_6_2026 Loyalty + Promotions
**Date:** 2026-06-02
**Scope:** grand opening flow, loyalty program, promotions seeding, consistency between docs / code / seed SQL / frontend
**Sources checked:**
- `plans/launch-day-runbook.md`
- `docs/loyalty_tier_definitions.md`
- `db/seed-promotions.sql`
- `js/loyalty.js`
- `dang-ky-thanh-vien.html`, `promotions.html`, `checkout.html`, `index.html`
- `worker/src/routes/loyalty.js`, `worker/src/routes/promotions.js`
- prior `reports/marketing/marketing-campaign/DEEP-CHECK-2026-05-27.md`

---

## 1. Campaign Source of Truth (Launch Day 06/06/2026)

| Field | Confirmed |
|------|-----------|
| Campaign code | `GRAND_OPENING_6_6_2026` |
| Active window | `2026-06-06 00:00:00` → `2026-06-08 23:59:59` |
| Signup bonus | `50,000đ` cashback into wallet |
| Signup cap | first **100** new members |
| Cashback multiplier | **x2** during window |
| Min order to earn cashback | `30,000đ` |
| Earn cap per order | `100,000đ` |
| Auto-upgrade trigger | Bronze → Silver when campaign-order spend ≥ `200,000đ` |

Public copy (from signup page meta + runbook):
> Đăng ký nhận ngay 50.000đ vào ví (100 người đầu tiên). Từ 06/06 đến 08/06, mọi đơn từ 30K được x2 cashback theo hạng thành viên.

---

## 2. Seeded Promo Codes (`db/seed-promotions.sql`)

| Code | Discount | Min order | Max discount | Window | Status |
|------|----------|-----------|--------------|--------|--------|
| `AURA20` | 20% | 0 | 50K | 06/06 only | active |
| `AURA10` | 10% | 0 | 30K | 06/07 → 06/13 | active |
| `WELCOME` | 10% | 0 | 30K | permanent | active |

`checkout.html` placeholder example `WELCOME` — **matches seed** ✅
`promotions.html` renders whatever `/api/promotions` returns — relies on above seed ✅

---

## 3. Loyalty Tier Definitions — DOC vs CODE Cross-Check

| Tier (docs) | Min LP | Cashback (docs) | Point mult (docs) | Bday disc (docs) | Mult in `js/loyalty.js` | Bday disc in `js/loyalty.js` |
|---|---|---|---|---|---|---|
| Bronze / Đồng | 0 | 3% | x1.0 | 10% | x1.0 | 5% |
| Silver / Bạc | 50 | 5% | x1.2 | 20% | x1.1 | 10% |
| Gold / Vàng | 200 | 7% | x1.5 | 35% | x1.3 | 15% |
| Platinum / Bạch Kim | 500 | 10% | x2.0 | 50% | x1.5 | 20% |

**🔴 FINDING — Multiplier drift:** Frontend `POINTS_RULES` multiplier tier is `x1.0/x1.1/x1.3/x1.5`. Official tier doc (`docs/loyalty_tier_definitions.md`) specifies `x1.0/x1.2/x1.5/x2.0`. The 6/6 deep-check from 2026-05-27 called the backend's campaign multiplier "x2" the authoritative source of truth — but frontend UI previews (loyalty page, calculator, tier badges) will show the WRONG point preview if user is Silver/Gold/Platinum until the JS constants are aligned. **Risk: user expectation mismatch on signup → lower perceived value.**

**🔴 FINDING — Birthday discount drift:** Frontend `BIRTHDAY_BONUS` = 5/10/15/20%. Tier doc = 10/20/35/50%. Same drift. Birthday flow runs server-side at checkout per comment in code, but the UI preview shown on loyalty page (birthday badge/notice) uses the wrong numbers.

**🟡 FINDING — `referral_referee: 0`:** docs say referee gets +100 pts +100 avail points. Code hardcodes `referral_referee: 0`. Backend may override (not visible in this check); if not, referral loop under-delivers vs documented promise.

---

## 4. Grand-Opening Event Hookup

`POINTS_RULES.SPECIAL_EVENTS` in `js/loyalty.js`:
```
'2/9': 2, '30/4': 2, 'tet': 3, 'black-friday': 5
```
**🟡 FINDING — 6/6 is NOT listed** as a special event in the frontend rules. Backend applies x2 via `GRAND_OPENING_6_6_2026` campaign config — confirmed working per 5/27 deep-check — but the frontend preview (if it shows "estimated points for this order") will NOT reflect the 06/06-08/06 x2 unless the client reads the active-campaign endpoint and applies the multiplier itself. Verify `promotions.html`/`loyalty.html` calls `/api/loyalty/active-campaign` for order preview.

---

## 5. Consistency: Marketing Pages vs Campaign Source of Truth

| Page | Reference | Match? |
|------|-----------|--------|
| `dang-ky-thanh-vien.html` meta/title | "50.000đ ... 100 người đầu ... khai trương 6/6/2026" | ✅ |
| `dang-ky-thanh-vien.html` banner | "Tặng 50.000đ ... Cho 100 người đầu tiên — Khai trương 06/06/2026" | ✅ |
| `dang-ky-thanh-vien.html` body | "06/06 — Cashback x2 toàn bộ đơn trong 3 ngày" | ✅ |
| `promotions.html` hero badge | "Khai Trương 2026" | ✅ (matches campaign) |
| `promotions.html` loyalty banner | "Chương Trình Thành Viên AURA LOYALTY ... Đăng ký miễn phí, nhận ngay 100 điểm" | ⚠️ |
| `index.html` (partial scan) | references loyalty + promotions | need full pass |
| `checkout.html` placeholder | `WELCOME` | ✅ matches seed |

**🟡 FINDING — Loyalty banner on promotions page** says "nhận ngay 100 điểm" while the actual 6/6 signup bonus is **50,000đ cashback**, not 100 points. The 100-point figure matches `BONUS_ACTIVITIES.first_purchase` in `loyalty.js` (a separate first-purchase bonus) but it conflates with the launch-day 50K signup bonus in the user's mind. **Risk: if a 6/6 user signs up expecting 100 points but receives 50K cashback, they may not recognize the value — or vice versa if they only see "100 điểm" on one page and "50.000đ" on another and think it's two different things.**

---

## 6. Legacy Campaign Files (Pre-6/6 Drafts) — BLOCKING

`reports/marketing/marketing-campaign/{01,02,03,04}-*.md` + the older `campaign/` sibling dir still contain:
- 08/05 launch date (3 weeks stale)
- 15M budget
- "100-point signup bonus" framing
- Diamond tier (does not exist — current is Platinum)
- Promo codes `GRANDOPEN25`, `WELCOME50`, `MONDAYBOOST` — these were marketing draft, **not** the seeded codes `AURA20/AURA10/WELCOME`

Per 2026-05-27 deep-check: **"Treat those files as legacy draft unless updated to 06/06 source of truth."** Status unchanged — these files are still present and still wrong. Anyone reading them (team member, new hire, marketing vendor) will be misled. **Recommendation: either delete/move to `_archive/` or prepend a big deprecation banner.**

---

## 7. API Base URL Drift

`promotions.html` line 331–333:
```
const API_BASE = hostname === 'localhost'
  ? 'http://localhost:8787/api'
  : 'https://fnb-worker.mekong.workers.dev/api';
```
But `launch-day-runbook.md` lists the production worker at:
```
https://aura-space-worker.sadec-marketing-hub.workers.dev
```
And `js/loyalty.js` (Phase 8 block) uses:
```
https://aura-space-worker.sadec-marketing-hub.workers.dev
```
**🟡 FINDING — `promotions.html` hardcodes `fnb-worker.mekong.workers.dev` as prod API base.** If that host is the dev/staging worker, live visitors on 6/6 will hit the wrong backend. Verify DNS + worker route.

---

## 8. Verified Passes (no action needed)

| Area | Evidence |
|------|----------|
| Signup page copy aligns with 6/6 campaign | 50K, cap 100, 06/06, x2 cashback — consistent in `dang-ky-thanh-vien.html` |
| Seed SQL has correct 3 promo codes | `db/seed-promotions.sql` — AURA20, AURA10, WELCOME |
| Tier doc matches backend | `docs/loyalty_tier_definitions.md` aligns with backend migration (per 5/27 confirmation) |
| Launch runbook has full SOP | `plans/launch-day-runbook.md` — T-17 checklist, T4 smoke test, T7 SOP, rollback |
| E2E suite passed 12/12 | noted in runbook |

---

## 9. Action Items (Priority Order)

| # | Priority | Action | Owner |
|---|----------|--------|-------|
| 1 | P0 | **Fix `POINTS_RULES` multiplier & birthday discount in `js/loyalty.js`** to match `docs/loyalty_tier_definitions.md` (Silver x1.2→x1.1, Gold x1.5→x1.3, Platinum x2.0→x1.5; birthday 5/10/15/20→10/20/35/50). | eng |
| 2 | P0 | **Confirm `promotions.html` API_BASE URL** — change `fnb-worker.mekong.workers.dev` → `aura-space-worker.sadec-marketing-hub.workers.dev` (or a shared constant) before deploy. | eng |
| 3 | P1 | **Clarify "100 điểm vs 50K cashback"** in `promotions.html` loyalty banner: either drop the "100 điểm" claim (since 6/6 signup bonus is 50K) or rephrase to "50K vào ví". | copy |
| 4 | P1 | **Add 6/6 grand opening to `SPECIAL_EVENTS`** in `js/loyalty.js` if the frontend renders order-preview points, OR confirm promotions/loyalty page reads active-campaign multiplier from API. | eng |
| 5 | P1 | **Archive or deprecate `reports/marketing/marketing-campaign/{01,02,03,04}-*.md`** — they reference stale 08/05 launch, 15M budget, Diamond tier, wrong promo codes. | PM |
| 6 | P2 | **Verify `referral_referee: 0`** matches backend — if docs promise +100 pts to referee, align JS or docs. | eng |
| 7 | P2 | **`index.html` full scan** — this deep-check only sampled pages that matched grep; run a structured pass on `index.html` hero/countdown/banner to confirm 6/6 date + 50K offer is live everywhere. | eng |
| 8 | P2 | **Zalo OA template IDs** — 4 placeholder IDs in `worker/src/routes/zalo.js` still need real values post-registration (per runbook ~25/6). Not a 6/6 blocker but track. | ops |

---

## 10. Production Verify Commands (re-run on 06/06)

```bash
curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty/active-campaign
# Expect: campaign.code=GRAND_OPENING_6_6_2026, signup_bonus_vnd=50000, cashback_multiplier=2

curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/promotions
# Expect: AURA20 (active 06/06), AURA10 (starts 06/07), WELCOME (always)

curl -s -o /dev/null -w "%{http_code}" https://fnb-caffe-container.pages.dev/promotions.html
# Expect: 200, and network tab shows API_BASE matching production worker
```

---

*Deep check completed 2026-06-02. Prior deep-check 2026-05-27 remains valid for backend plumbing; this update focuses on frontend-doc consistency and pre-launch blockers.*
