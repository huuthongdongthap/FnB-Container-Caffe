# 🔍 LOYALTY CODEBASE AUDIT — FnB-Container-Caffe

> **Audit date:** 16/05/2026
> **Repo:** `huuthongdongthap/FnB-Container-Caffe@main`
> **Spec đối chiếu:** `01_LOYALTY_CASHBACK_PROGRAM.md`

---

## ✅ Cái gì đã CÓ sẵn (working)

### Backend (Cloudflare Workers + Hono)
| File | Size | Status | Functionality |
|---|---|---|---|
| `worker/src/routes/loyalty.js` | 16.5KB | ✅ Working | Phone-auth, summary, points history, cashback history, spend-cashback (50% cap), rewards CRUD, redeem, tiers list |
| `worker/src/routes/referrals.js` | 11.8KB | ✅ Working | Code gen, apply, stats, pending→completed sau first purchase |
| `worker/src/routes/orders.js` | - | ⚠️ Có vấn đề | Gọi `processOrderLoyalty()` đúng + gọi `triggerAutoCashback()` dead code |
| `worker/src/index.js` | - | ✅ Working | Mount `/api/loyalty`, `/api/loyalty/referral`, CORS, rate limit KV |

### Database (D1)
| Migration | Status |
|---|---|
| `20260430_01_loyalty_cashback.sql` | Created: `customers, loyalty_tiers, cashback_wallets, cashback_transactions, loyalty_point_logs, user_rewards` + ALTER orders |
| `20260507_02_loyalty_recalibrate.sql` | Recalibrate 3 tier — **sai tên + sai rate** so với spec mới |

### Frontend
| File | Size | Status |
|---|---|---|
| `loyalty.html` | 21KB | ✅ Working — user-facing lookup page, referral box 3 templates |
| `js/loyalty.js` | 35KB | ✅ Working — bootstrap UI + API integration |

### Admin
| File | Status |
|---|---|
| `admin/dashboard.html` | ⚠️ KHÔNG có widget loyalty nào |

---

## 🚨 3 CRITICAL BUGS (MUST FIX trước 6/6)

### Bug #1: Dead code nguy cơ DOUBLE-CREDIT
**File:** `worker/src/routes/orders.js`

`updateOrder` khi status=`delivered` gọi 2 hàm:
- ❌ `triggerAutoCashback()` — query bảng `loyalty_members` + `loyalty_transactions` **KHÔNG TỒN TẠI** → silently fails (try/catch nuốt lỗi)
- ✅ `processOrderLoyalty()` — dùng `customers` + `cashback_wallets` đúng

→ **Nếu sau này có ai tạo `loyalty_members` table** thì cashback cộng **2 lần** cho 1 order. Phải xóa `triggerAutoCashback` ngay.

### Bug #2: KHÔNG có IDEMPOTENCY
**File:** `worker/src/routes/loyalty.js → processOrderLoyalty()`

Nếu order chuyển status `delivered → completed` (2 lần update), function chạy lại → cộng cashback + points **2 lần**.

**Fix:** Check `order.cashback_earned > 0` trước khi cộng, hoặc UNIQUE constraint `(order_id, type='earn')` trong `cashback_transactions`.

### Bug #3: Tier mismatch giữa code và spec
- DB hiện chỉ 3 tier với rate 2/5/8%
- Tên `silver` đang là tier 1 (sai — phải `bronze`)
- `orders.js` line 119 ghi `'bronze'` → inconsistency với DB

**Fix:** Migration v2 — 4 tier Bronze/Silver/Gold/Platinum với rate 3/5/7/10% + threshold theo VND.

---

## 📊 Gaps vs designed spec (12 missing items)

| # | Item | Status |
|---|---|---|
| 1 | 4 tier Bronze/Silver/Gold/Platinum (3/5/7/10%) | ❌ Sai tên + sai rate |
| 2 | Tier threshold theo VND/năm (500k/2tr/5tr) | ❌ Đang theo `min_points` |
| 3 | Cashback expiry 90/120/180 days | ❌ Schema không có `expires_at` |
| 4 | Min order 30k áp dụng cashback | ❌ Không check |
| 5 | Max cashback 50k/giao dịch | ❌ Không cap |
| 6 | `bonus_campaigns` table + Grand Opening 6/6 | ❌ Không tồn tại |
| 7 | Cashback multiplier x2 logic | ❌ Không có |
| 8 | Signup bonus +50k (first 100 ngày 6/6) | ❌ Không có |
| 9 | `/dang-ky-thanh-vien` public page | ❌ Không có (chỉ `/loyalty` lookup) |
| 10 | QR code generator cho standee | ❌ Không có |
| 11 | SMS gateway (Speedsms/Esms VN) | ❌ Chỉ có Telegram cho bếp |
| 12 | Admin dashboard 8 widgets loyalty | ❌ Không có widget nào |

---

## ⚠️ Code quality issues (P0/P1)

| Issue | Priority | File |
|---|---|---|
| Dead code `triggerAutoCashback` | P0 | `orders.js` |
| No idempotency `processOrderLoyalty` | P0 | `loyalty.js` |
| Tier name/rate mismatch | P0 | `db/migrations/*`, `orders.js`, `loyalty.js` |
| Missing `bonus_campaigns` + multiplier | P0 | DB + `loyalty.js` |
| No SMS notify customer | P0 | new `sms.js` |
| Phone validation yếu `[0-9]{9,15}` | P1 | `loyalty.js` phone-auth |
| `customers.phone` không UNIQUE | P1 | DB schema |
| `processOrderLoyalty` không wrap D1 batch (atomicity) | P1 | `loyalty.js` |
| No staff_id audit log per transaction | P1 | `loyalty.js` spend-cashback |
| No CAPTCHA after 3 signup/IP/h | P1 | `loyalty.js` phone-auth |

---

## 🎯 Effort estimate

| Priority | Tasks | Total time | Khả thi xong trước 6/6? |
|---|---|---|---|
| P0 (launch-blocking) | 4 tasks | ~9-10h | ✅ Yes (12 ngày còn) |
| P1 (post-launch) | 1 task | ~3h | Làm sau 6/6 |

→ **Verdict:** Khả thi hoàn thành P0 trong 2-3 ngày dispatch nếu start ngay 16/5.

---

## 📋 Task breakdown — 5 atomic tasks cho Claude Code CLI

| # | Task | Priority | Time | Blocker for |
|---|---|---|---|---|
| 08 | Loyalty schema v2 (migration 4 tier + bonus_campaigns) | P0 | 2h | All sau |
| 09 | Bonus campaigns + multiplier + fix double-credit + idempotency | P0 | 3h | 6/6 launch |
| 10 | Public signup page `/dang-ky-thanh-vien` + QR generator | P0 | 2h | Marketing leaflet |
| 11 | SMS gateway Speedsms VN integration | P0 | 2h | Customer notify |
| 12 | Admin loyalty dashboard 8 widgets | P1 | 3h | Post-launch |

→ Chi tiết mỗi task ở files `08-*.md` đến `12-*.md`.

---

## 🚀 Recommended dispatch order

```
Ngày 18/5 (T2 — hôm nay): Task 08 (schema v2) — chiều
Ngày 19/5 (T3):           Task 09 (campaigns + fixes) — sáng/chiều
Ngày 20/5 (T4):           Task 10 (signup page + QR) — sáng
Ngày 21/5 (T5):           Task 11 (thẻ giấy + POS) — sáng
Ngày 22-31/5:             Test E2E + Marketing pre-launch + KOL visits
Ngày 01-04/6:             FB Boost + final prep
Ngày 05/6 (T6):           Setup day + final smoke test
Ngày 06/6 (T7):           🎉 D-DAY
Sau 06/6 (CN 07/6+):      Task 12 (admin widgets)
Khoảng 25/6:              Task 13 (Zalo OA + ZNS)
```

→ Anh review audit này → confirm em dispatch ngay Task 08 chiều nay (18/5).
