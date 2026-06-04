# 🎫 LOYALTY V3 RULES — Cập nhật 30/05/2026

> **Override file:** `01_LOYALTY_CASHBACK_PROGRAM.md` (deprecated)
> **PR triển khai:** [#40](https://github.com/huuthongdongthap/FnB-Container-Caffe/pull/40)
> **Decision date:** T7 30/05/2026 từ anh Còn
> **Base data:** đơn bình quân **25k** (BCC tháng 5/2026) + COGS target **35%**

---

## 🎯 TRIẾT LÝ MỚI

Loyalty v3 đơn giản, **thắt chặt margin control**, dùng tệp realistic Sa Đéc:

1. **Tier exclusive** — Gold/Platinum là club mơ ước, không phải mass market
2. **Cashback ví linh hoạt 100%** — dùng đổi mọi món, ví không bị "kẹt"
3. **Discount sinh nhật trực tiếp** — bỏ free drink (khó control giá vốn)
4. **Check-in 2 phase** — tuần khai trương cộng ví, sau đó discount direct
5. **Refer minimal** — chỉ thưởng người giới thiệu, không pull người mới bằng bonus
6. **Bỏ signup bonus** — pull bằng học sinh check-in organic thay vì cash incentive

---

## 🏆 4 TIER — Thresholds mới

| Tier | Min/Max spent (tháng) | Cashback rate | Birthday discount | Cashback expiry |
|---|---|---|---|---|
| 🥉 **Bronze** | 0 - 500.000đ | **3%** | **5%** off | 90 ngày |
| 🥈 **Silver** | 500k - 5tr | **5%** | **10%** off | 120 ngày |
| 🥇 **Gold** | 5tr - 15tr | **7%** | **15%** off | 180 ngày |
| 💎 **Platinum** | > 15tr | **10%** | **20%** off | KHÔNG hết hạn |

### Tính realistic năm đầu Sa Đéc

| Tier | Cách đạt | Ước % khách năm 1 |
|---|---|---|
| Bronze | Đăng ký + 1-3 lần ghé | 80-85% |
| Silver | Ghé 2-3 lần/tuần × 3-4 tháng | 12-15% |
| Gold | Khách thân nhất ghé hằng ngày × 6-8 tháng | 2-3% |
| Platinum | "VIP của VIP" — khách doanh nhân + business meet hằng ngày | < 1% |

→ Đúng triết lý "exclusive club".

---

## 💰 CASHBACK — Cách hoạt động (v3)

### Quy trình

```
1. Khách order: 100k
2. POS: Hỏi SĐT/QR thành viên
3. Tier identify: VD Silver → 5%
4. Order total: 100k (full pay hoặc dùng ví)
5. Cashback credit: 5k vào ví ngay sau payment
6. Lần sau: Khách dùng TỐI ĐA bằng số tiền trong ví (BỎ cap 50%)
   VD: bill 60k, ví 100k → có thể dùng tới 60k = MIỄN PHÍ ly đó
   VD: bill 60k, ví 40k → dùng 40k + 20k cash
```

### Rules v3 (mới)

| Rule | v2 cũ | v3 mới |
|---|---|---|
| Min order áp dụng cashback | 20k | 20k ✅ giữ (updated 2026-06-04) |
| Max cashback / giao dịch | 50k | 50k ✅ giữ (campaign: 100k) |
| Min order khi dùng ví | 20k | 20k ✅ giữ (updated 2026-06-04) |
| **Max % bill dùng từ ví** | 50% | **50%** ✅ GIỮ (anh quyết restore) |
| Không cộng dồn với voucher khác | giữ | giữ ✅ |
| Cashback hết hạn theo tier | giữ | giữ ✅ |

### 4 lớp bảo vệ cashback (đầy đủ)

| Lớp | Cấu trúc | Giá trị |
|---|---|---|
| 1️⃣ Per-tx earn cap | MAX_CASHBACK_PER_TX | 50.000đ |
| 2️⃣ Campaign cap | max_cap_per_customer_vnd | 100k (GRAND_OPENING), 20k (CHECKIN_WEEK) |
| 3️⃣ Min order earn | MIN_ORDER_FOR_CASHBACK | 20.000đ |
| 4️⃣ Tier rate | cashback_rate | 3/5/7/10% |
| 5️⃣ **Wallet spend cap** | **50% bill** | ✅ GIỮ NGUYÊN |

→ 5 lớp bảo vệ, đảm bảo cash flow lành mạnh.

---

## 🎂 BIRTHDAY — Discount thay free drink

### v3 mới

| Tier | Discount tháng sinh nhật |
|---|---|
| Bronze | 5% off |
| Silver | 10% off |
| Gold | 15% off |
| Platinum | 20% off |

### Quy trình

- Áp dụng **cả tháng sinh nhật** (vd: tháng 5 sinh, áp 1-31/5)
- Cộng với cashback bình thường (KHÔNG cộng với voucher khác)
- Tự động kích hoạt khi POS lookup SĐT có `date_of_birth` match tháng hiện tại
- Khách thấy banner trong POS: "🎂 Sinh nhật tháng X — discount Y%"

### COGS check

- Đơn 25k × 20% Platinum birthday = 5k off → margin còn 45% (vẫn OK)
- Cộng cashback Platinum 10% = 7.5k tổng → margin 35% (sát threshold)
- → **Cap birthday + cashback combined ≤ 25% bill** (em recommend code rule)

---

## 📸 CHECK-IN — 2 phase

### ⚠️ Anh Còn quyết: **1 LẦN/KHÁCH duy nhất trong tháng 6**

Khách chọn 1 trong 2 phase — KHÔNG được dùng cả 2.

### Phase 1: Tuần khai trương 6-13/6 — +20k cashback ⭐

**Flow:**
1. Khách quét QR `Check-in AURA` ở standee
2. Mở trang `/checkin` — có hướng dẫn:
   - Chụp 1 ảnh tại quán
   - Đăng FB/Zalo có tag @aurasadec + hashtag #AURACafeSaDec
3. Khách screenshot post → đưa Khánh/staff approve tại quầy
4. Staff scan QR loyalty card khách → POS log check-in → +20k vào ví NGAY
5. Khách nhận notify trong app + ví update

**Rules:**
- **Cap 1 lần/khách/tháng 6** (chia sẻ với Phase 2 — chọn 1)
- Yêu cầu: post có visible tag/hashtag
- Trust-based — em không yêu cầu verify automatic
- Enforce qua DB: `UNIQUE(customer_id, substr(checkin_at, 1, 7))`

**Em ước budget:**
- Realistic: 50 khách × 1 lần × 20k = **1tr exposure** (giảm từ 3tr v3 cũ)
- Trong budget Buffer 3.7tr — extremely safe

### Phase 2: Sau khai trương 14-30/6 — Discount 10% direct

**Flow:**
1. Khách quét QR `Check-in AURA` tại quán
2. Post FB/Zalo có tag (như phase 1)
3. Khách screenshot → staff approve → POS apply discount **-10% NGAY** trên đơn hiện tại
4. KHÔNG cộng vào ví

**Rules:**
- **Cap 1 lần/khách/tháng 6** (CHIA SẺ với Phase 1)
- Không vào ví → không cumulative
- Cộng được với cashback (vì cashback từ post-discount amount)

**Em ước budget:**
- Realistic: 30 khách × 1 lần × 10% × 25k = **75k** (giảm từ 375k v3 cũ)
- Negligible vs revenue

### Logic xử lý 2 phase share cap

Khi khách check-in lần 2 cùng tháng (đã check-in trước trong phase khác):
- DB ném `UNIQUE constraint failed`
- Worker bắt error → trả về frontend: "Bạn đã check-in tháng này rồi 😊"
- Staff thấy notify rõ ràng tại POS

### Standee Check-in (em sẽ design)

```
┌──────────────────────────────────┐
│   📸 CHECK-IN AURA                │
│                                  │
│   [QR CODE 8×8cm]                │
│                                  │
│   1. Quét QR                     │
│   2. Chụp ảnh + post FB/Zalo     │
│      có tag #AURACafeSaDec       │
│   3. Show post cho nhân viên     │
│                                  │
│   ✨ Tuần khai trương 6-13/6:    │
│      Tặng 20k vào ví AURA         │
│   ✨ 14-30/6:                     │
│      Giảm 10% trực tiếp           │
└──────────────────────────────────┘
```

→ In standee A2 (~150k), đặt cạnh quầy thu ngân + 1 góc rooftop.

---

## 🎁 REFER-A-FRIEND — Đơn giản hoá v3

### Rules mới

- **Tặng 10.000đ cashback** cho **NGƯỜI GIỚI THIỆU** khi:
  - Friend mới đăng ký thành công (qua link refer)
  - Friend có **đơn đầu tiên ≥ 20.000đ**
- KHÔNG tặng cho người được giới thiệu
- KHÔNG cộng điểm/tier cho cả 2

### Quy trình

1. Khách A đăng nhập web → tạo link refer cá nhân `https://...?ref=A_xxx`
2. A share link cho friend B qua Zalo/FB
3. B click link → đăng ký mới (record `referrer_customer_id=A` trong table `referrals`)
4. B đặt đơn đầu ≥ 20k → status `pending` → `confirmed`
5. System auto +10k vào ví của A
6. Notify A qua Zalo OA (sau task 13)

### Anti-fraud

- 1 customer chỉ được refer 1 lần (UNIQUE constraint `referred_customer_id`)
- Min order 20k để tránh order ảo
- Admin có thể mark `fraud` nếu phát hiện multiple accounts cùng SĐT/IP

### Budget exposure

- 30 cặp refer/tháng × 10k = **300k/tháng** (vs cũ 1.5tr cho 30 cặp)
- Cực kỳ tiết kiệm vì chỉ thưởng người giới thiệu

---

## 🚫 BỎ HOÀN TOÀN

### v3 KHÔNG còn:

- ❌ **Signup bonus 50k/30k** — về 0đ
- ❌ **Welcome drink free 100 ly** — đã bỏ trong master plan v2
- ❌ **Free 1 ly birthday** — chuyển sang discount %
- ❌ **Refer +20-50k cho người mới** — chỉ thưởng giới thiệu
- ❌ **Cap 50% bill khi dùng ví** — dùng 100%
- ❌ **Cashback x2 multiplier cho check-in** (nếu dùng campaign GRAND_OPENING + CHECKIN_WEEK same time)

---

## 📊 SO SÁNH v2 vs v3 — Budget exposure cho 100 khách tháng đầu

| Item | v2 ước tính | v3 mới (1 lần check-in) | Diff |
|---|---|---|---|
| Signup bonus | 5tr (50k×100) | 0 | -5tr |
| Welcome drink | 1.5tr (100×15k) | 0 | -1.5tr |
| Refer-a-friend | 1.5tr (30 cặp × 50k) | 300k (30 cặp × 10k) | -1.2tr |
| Check-in tuần khai trương | - | **1tr (50 khách × 1 lần × 20k)** | +1tr |
| Check-in sau khai trương | - | **75k (30 khách × 1 lần × 2.5k)** | +75k |
| Birthday free drinks | ~500k (15 khách) | 0 | -500k |
| Birthday discount | 0 | ~150k (15 khách × 10k avg) | +150k |
| Cashback issued | ~3tr | ~3tr | 0 |
| **Total exposure** | **~11.5tr** | **~4.5tr** | **-7tr** ✅ |

→ **Tiết kiệm 7tr/tháng** vs v2 (vs 4.7tr với cap check-in cũ).

---

## 🔧 APPLICATION CODE CHANGES (sau migration)

Migration PR #40 chỉ schema. Em sẽ tạo **PR #41** sau với code changes:

### 1. `worker/src/routes/loyalty.js` — GIỮ NGUYÊN cap 50% (KHÔNG đổi)

```js
// v3 vẫn giữ cap 50% như v2 (anh quyết restore):
const maxFromWallet = Math.min(walletBalance, total * 0.5);
```

→ **KHÔNG cần update code cho cap.** Em đã hiểu sai câu hỏi loyalty redeem trước.

### 2. New endpoint: `POST /api/loyalty/checkin`

```js
// Body: { customer_id, campaign_code, post_url?, post_platform, staff_id }
// Logic:
//   - Validate campaign active
//   - Check UNIQUE constraint (1/day/customer/campaign)
//   - Insert checkin_log
//   - If campaign = CHECKIN_WEEK_6_6 → insert cashback_transaction +20k
//   - If campaign = CHECKIN_DISCOUNT_THANG_6 → return discount_pct=10 cho POS apply
```

### 3. New endpoint: `POST /api/loyalty/refer`

```js
// Body: { referrer_customer_id, referred_customer_id }
// Logic:
//   - Validate referrer exists
//   - Insert into referrals (status='pending')
//   - When referred has order ≥ 20k → mark status='confirmed', grant +10k to referrer
```

### 4. New endpoint: `GET /api/loyalty/checkin/:customer_id/today`

Check khách đã check-in hôm nay chưa (để frontend disable nút).

### 5. Update `processOrderLoyalty()` — birthday discount

```js
// Check if today is birthday month
const isBirthdayMonth = customer.date_of_birth?.month === currentMonth;
const birthdayDiscount = isBirthdayMonth ? tier.birthday_discount : 0;
```

---

## 🎨 FRONTEND CHANGES (PR sau)

### 1. `/checkin` — Trang check-in mới

- Mobile-first
- Hiển thị QR/URL cách post
- Button "Tôi đã đăng" → screenshot upload → submit cho staff
- Confirmation screen

### 2. POS update

- Hiển thị banner "🎂 Sinh nhật tháng X — discount Y%" khi lookup SĐT
- Nút "Check-in" quét QR loyalty card → +20k hoặc -10%
- Bỏ cap 50% UI (slider dùng tới 100% ví)

### 3. Standee design

- Em tạo SVG design A2 sau (sau khi anh confirm content)

---

## ✅ ACCEPTANCE CRITERIA — DEPLOYED 30/05 21:11

- [x] **PR #39, #40, #41, #42 merged thành công** (Gemini CLI execute /goal automation)
- [x] **Migrations apply remote** — tra_sua_pilot_sku.sql + loyalty_v3_tier_checkin_referral.sql
- [x] **2 bugs critical fixed trong production** (do Gemini phát hiện sau merge)
- [x] **Worker deployed** to Cloudflare (aura-space-worker.sadec-marketing-hub.workers.dev)
- [x] **Frontend deployed** (checkin.html + admin/checkin-approve.html)
- [x] **Smoke test pass** — GET /api/loyalty/birthday/CUS_test → 404 đúng (customer không tồn tại)
- [ ] Standee check-in in xong trước 5/6 — anh action
- [ ] Staff train 4/6 buổi sáng (3 tiếng) — include check-in flow
- [ ] Test 5 mock customers end-to-end với account thật
- [ ] Admin dashboard verify widgets

---

## 🐛 PRODUCTION BUGS FIXED (30/5 21:00) — Lesson learned

### Bug #1: Hono Route Shadowing

**Symptom:** Routes `/api/loyalty/birthday` và `/api/loyalty/checkin` bị mất hiệu lực — request rơi vào `/api/loyalty/*` generic handler.

**Root cause:** Hono match routes theo thứ tự mount. Generic `app.route('/api/loyalty', loyaltyRouter)` mount TRƯỚC sub-routes → shadow.

**Fix:** Reorder trong `worker/src/index.js`:
```js
// ✅ ĐÚNG — specific routes TRƯỚC, generic SAU
app.route('/api/loyalty/checkin', checkinRouter);
app.route('/api/loyalty/birthday', birthdayRouter);
app.route('/api/loyalty/referral', referralRouter);
app.route('/api/loyalty', loyaltyRouter);  // ← Last (generic)
```

**Bài học cho em:** Khi mount sub-router trong Hono/Express, ALWAYS đặt specific routes trước generic. Em đã thêm `birthdayRouter` SAU `loyaltyRouter` → shadow.

---

### Bug #2: Column Mismatch — `c.birthday` vs `c.date_of_birth`

**Symptom:** `D1_ERROR: no such column: c.birthday` crash trong birthday endpoint.

**Root cause:** Em đọc schema từ migration `20260430_01_loyalty_cashback.sql` thấy column `birthday TEXT`. Production thực tế có schema khác:
- Migration `20260519_01_customers_signup_fields.sql` add `date_of_birth`
- Có thể remote DB đã rename hoặc drop column cũ

**Fix trong `worker/src/routes/birthday.js`:** Dùng `date_of_birth` thay `birthday`:
```sql
-- ❌ SAI (em viết):
SELECT c.id, c.name, c.birthday, c.loyalty_tier ...

-- ✅ ĐÚNG (Gemini fix):
SELECT c.id, c.name, c.date_of_birth AS birthday, c.loyalty_tier ...
```

**Bài học cho em:** KHÔNG assume schema chỉ từ 1 migration file. Phải:
1. Query thực tế: `PRAGMA table_info(customers);` trước khi viết
2. Hoặc check tất cả ALTER TABLE statements trong migration history
3. Sa Đéc remote D1 có thể có schema khác repo do hand-applied ALTER

---

### Bug #3: Missing tables trên remote DB (referrals + referral_codes)

**Symptom:** Migration 03 fail vì `referrals` table chưa tồn tại trên remote D1 — em assume table này tồn tại từ migration cũ.

**Root cause:** Migration `20260507_03_sync_rewards.sql` (theo tên) có lẽ chỉ apply local, không remote. Schema drift.

**Fix:** Gemini tạo tables `referrals` + `referral_codes` trước, sau đó chạy migration v3 (34 queries total).

**Bài học cho em:** Verify remote schema matches local TRƯỚC khi viết migration mới — `wrangler d1 list-tables --remote` hoặc query sqlite_master.

---

## 🎓 SUMMARY 3 BUGS

| # | Bug | Em đã miss | Lesson |
|---|---|---|---|
| 1 | Route shadowing | Mount order sai | Specific routes trước generic |
| 2 | Column `c.birthday` vs `c.date_of_birth` | Assume schema từ 1 file | Verify thực tế |
| 3 | Missing tables remote | Assume migration cũ apply | Check remote schema |

→ Em sẽ note 3 lessons này khi viết migrations/routes tương lai.

---

## 🆘 ROLLBACK PLAN

### Nếu cashback rate quá cao (margin < 30%)

```sql
-- Giảm Platinum xuống 8%:
UPDATE loyalty_tiers SET cashback_rate=0.08 WHERE tier_name='platinum';
```

### Nếu check-in lạm dụng (>100 lần/ngày)

```sql
-- Tạm tắt CHECKIN_WEEK:
UPDATE bonus_campaigns SET active=0 WHERE code='CHECKIN_WEEK_6_6';
```

### Nếu refer ảo

```sql
-- Mark fraud manual:
UPDATE referrals SET status='fraud' WHERE id IN (...);
```

---

## 📞 ESCALATION

Em standby debug + monitor 24/7 trong tuần 6-13/6.

Anh báo em qua chat khi:
- Phát hiện rate sai (Khánh báo)
- Check-in lạm dụng
- Refer ảo
- POS không apply birthday discount

---

📌 **Action số 1 hôm nay 30/5:** Anh review PR #40 → merge + apply remote → em chuẩn bị PR #41 code changes trong CN 31/5.
