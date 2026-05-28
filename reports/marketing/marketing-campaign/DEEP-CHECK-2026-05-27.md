# Deep Check — GRAND_OPENING_6_6_2026 Loyalty Cashback

**Date:** 2026-05-27  
**Scope:** Marketing campaign, loyalty signup, cashback multiplier, D+1 reporting, launch monitor  
**Source of truth:** `db/migrations/20260518_03_loyalty_v2_launch.sql`, `worker/src/routes/loyalty.js`, `reports/marketing/campaign/*`

---

## 1. Campaign Source Of Truth

| Field | Confirmed value |
|---|---|
| Campaign code | `GRAND_OPENING_6_6_2026` |
| Active window | `2026-06-06 00:00:00` → `2026-06-08 23:59:59` |
| Signup bonus | `50.000đ` cashback into wallet |
| Signup cap | First `100` new members |
| Signup bonus liability | `5.000.000đ` max |
| Cashback multiplier | `x2` during active window |
| Base tier cashback | Bronze `3%`, Silver `5%`, Gold `7%`, Platinum `10%` |
| Effective launch cashback | Bronze `6%`, Silver `10%`, Gold `14%`, Platinum `20%` |
| Earn cap | `100.000đ/order` during campaign |
| Min order for earn cashback | `30.000đ` |
| Referral bonus in campaign config | `50.000đ` |
| Auto-upgrade | Bronze → Silver when campaign order spend `>=200.000đ` |

Do not market this as flat "20% cashback first transaction". Correct wording:

> Đăng ký nhận ngay 50.000đ vào ví cho 100 thành viên đầu tiên. Từ 06/06 đến 08/06, mọi đơn đủ điều kiện được x2 cashback theo hạng thành viên.

---

## 2. What Passed

| Area | Status | Evidence |
|---|---|---|
| Signup page copy | PASS | `dang-ky-thanh-vien.html` advertises 50K, first 100, 06/06, x2 cashback |
| QR assets | PASS | `public/qr/qr-signup-standee.png`, `qr-signup-leaflet.png`, `qr-signup-receipt.png` exist |
| Campaign seed | PASS | Migration seeds `bonus_campaigns` with 50K, cap 100, x2, 06/06-08/06 |
| Signup bonus execution | PASS | `/api/loyalty/phone-auth` creates wallet, inserts `bonus` transaction, updates wallet, logs cap position |
| Cashback earn execution | PASS | `processOrderLoyalty` applies tier rate x campaign multiplier, min order 30K, campaign cap, idempotency |
| Admin analytics route | PASS after fix | `/api/admin/loyalty/widget/active-campaign` now uses SQL-compatible timestamps |
| D+1 reports | PASS after fix | `campaign_id` cap-used queries now compare against `bonus_campaigns.id` |
| Launch monitor cap display | PASS after fix | UI now reads `progress.signup_granted` and `progress.signup_cap` |

---

## 3. Fixes Applied

| File | Fix |
|---|---|
| `worker/src/routes/loyalty.js` | Normalize active-campaign comparison timestamp to `YYYY-MM-DD HH:mm:ss` so the 06/06-08/06 window is reliable |
| `worker/src/routes/admin-loyalty.js` | Same timestamp normalization for admin active campaign widget |
| `worker/src/routes/reports.js` | Fix cap-used query from `campaign_id = code` to `campaign_id = bonus_campaigns.id` |
| `admin/launch-monitor.html` | Read signup cap usage from `progress.signup_granted` instead of missing `campaign.signup_bonus_used` |
| `reports/marketing/campaign/launch-checklist.md` | Replace inaccurate 20% messaging, invalid campaign status endpoint, unauthenticated report curls, and nonexistent pause endpoint |

---

## 4. Remaining Risks

| Risk | Severity | Action |
|---|---|---|
| Old `reports/marketing/marketing-campaign/*.md` still references 08/05 launch, 15M budget, 100-point signup bonus, Diamond tier, and many promo codes not confirmed in implementation | High | Treat those files as legacy draft unless updated to 06/06 source of truth |
| Production deploy not confirmed from this shell | High | Deploy with `CLOUDFLARE_API_TOKEN` and working DNS, then run production verify |
| Report endpoints require admin/staff auth but old runbooks omitted token | Medium | Use `Authorization: Bearer $OWNER_TOKEN` in D+1 report commands |
| Promo discount codes like `GRANDOPEN25`, `WELCOME50`, `MONDAYBOOST` are marketing draft, not confirmed as seeded production rules in this check | Medium | Do not publish discount-code table until `promotions` data is verified |
| Zalo OA broadcast depends on account readiness and followers | Medium | Keep Zalo as owned-channel task, not launch blocker |

---

## 5. Production Verify Commands

Run after worker deploy:

```bash
curl -s https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty/active-campaign

curl -s -H "Authorization: Bearer $OWNER_TOKEN" \
  "https://aura-space-worker.sadec-marketing-hub.workers.dev/api/reports/summary?date=2026-06-06"

curl -s -o /dev/null -w "Signup page: %{http_code}\n" \
  https://fnb-caffe-container.pages.dev/dang-ky-thanh-vien

curl -s -o /dev/null -w "Standee QR: %{http_code}\n" \
  https://fnb-caffe-container.pages.dev/qr/qr-signup-standee.png
```

Expected before `2026-06-06 00:00:00`: active campaign may return `campaign: null`. Expected during `2026-06-06` to `2026-06-08`: campaign code `GRAND_OPENING_6_6_2026`, `signup_bonus_vnd: 50000`, `cashback_multiplier: 2`.

---

## 6. Recommended Public Offer

**Headline:** Khai trương 06/06 — nhận 50K vào ví, x2 cashback 3 ngày đầu  

**Body:** Đăng ký thành viên AURA CAFE bằng số điện thoại để nhận ngay 50.000đ vào ví cashback. Chỉ áp dụng cho 100 thành viên đầu tiên. Từ 06/06 đến 08/06, mọi đơn từ 30.000đ được x2 cashback theo hạng thành viên.

**Staff script:** Anh/chị quét QR đăng ký thành viên giúp em nhé. 100 người đầu nhận 50.000đ vào ví, từ hôm nay đến 08/06 còn được x2 cashback cho đơn đủ điều kiện.

