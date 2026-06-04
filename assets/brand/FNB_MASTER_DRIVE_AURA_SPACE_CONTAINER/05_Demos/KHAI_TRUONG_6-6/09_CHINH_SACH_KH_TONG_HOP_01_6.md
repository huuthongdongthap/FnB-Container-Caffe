# 📜 CHÍNH SÁCH KHÁCH HÀNG — AURA CAFE (cập nhật 01/06/2026)

> **Tài liệu tổng hợp:** Tất cả ưu đãi + quy tắc áp dụng cho KH từ 06/06/2026
> **Đối tượng đọc:** Anh Còn + Cường + Khánh + Thư + Ngọc
> **In + ép plastic dán quầy thu ngân** (để tra nhanh khi khách hỏi)
> **Đã deploy production:** ✅ tất cả qua PRs #38-42 (30-31/5)

---

## 🏆 1. HỆ THỐNG THÀNH VIÊN — 4 TIER

| Tier | Điều kiện (chi tiêu/năm) | Cashback | Birthday discount | Cashback hết hạn |
|---|---|---|---|---|
| 🥉 **Đồng (Bronze)** | 0 - 500.000đ | **3%** | 5% cả tháng | 90 ngày |
| 🥈 **Bạc (Silver)** | 500k - 5tr | **5%** | 10% cả tháng | 120 ngày |
| 🥇 **Vàng (Gold)** | 5tr - 15tr | **7%** | 15% cả tháng | 180 ngày |
| 💎 **Bạch Kim (Platinum)** | > 15tr | **10%** | 20% cả tháng | KHÔNG hết hạn |

**Tier auto-upgrade:** Khi `lifetime_spent` đạt ngưỡng tier mới → tự lên hạng (chậm nhất 24h)

---

## 💰 2. CASHBACK — QUY TẮC HOẠT ĐỘNG

### Cách tích cashback (khi khách mua hàng):

| Quy tắc | Giá trị |
|---|---|
| Min order để **tích** cashback (EARN) | **20.000đ** |
| Cap tích / 1 giao dịch | **50.000đ** (campaign 6-8/6: cap 100k) |
| Tỷ lệ tích theo tier | 3% / 5% / 7% / 10% |
| Cashback x2 trong campaign | 6-8/6 (3 ngày khai trương) |
| Cashback expiry | Theo tier (90/120/180/∞ ngày) |

### Cách dùng cashback (khi khách trả tiền):

| Quy tắc | Giá trị |
|---|---|
| Min order để dùng ví | **20.000đ** |
| Max % bill dùng từ ví | **50%** (giữ cap như cũ) |
| Cộng với voucher khác | **KHÔNG** (chỉ 1 ưu đãi/lần) |

**Ví dụ:**
- Khách Silver có ví 100k → mua bill 60k → dùng tối đa 30k ví (50% × 60k) + 30k cash
- Khách Platinum bill 1tr × 10% cashback = 100k → cap 50k → ví +50k (mất 50k cap)
- Trong campaign 6-8/6: bill 1tr × 20% (10% × 2) = 200k → cap 100k campaign → ví +100k

---

## 🎁 3. BONUS CAMPAIGN — 3 CAMPAIGN ACTIVE THÁNG 6

### 🌟 Campaign A: GRAND_OPENING (6-8/06)

| Item | Giá trị |
|---|---|
| Cashback multiplier | **x2 toàn tier** (Bronze 6%, Silver 10%, Gold 14%, Platinum 20%) |
| Signup bonus | **0đ** (bỏ — không tặng ví khi đăng ký) |
| Cap cashback/khách | 100.000đ trong 3 ngày |

### 📸 Campaign B: CHECKIN_WEEK (6-13/06)

| Item | Giá trị |
|---|---|
| Phần thưởng | **+20.000đ vào ví** AURA |
| Số lần | **1 lần/khách duy nhất** trong tháng 6 |
| Yêu cầu | Khách post FB/Zalo có tag `#AURACafeSaDec` + đưa staff approve |
| Verify | Trust-based — staff xem screenshot post |

### 💸 Campaign C: CHECKIN_DISCOUNT (14-30/06)

| Item | Giá trị |
|---|---|
| Phần thưởng | **Giảm 10% trực tiếp** trên đơn hiện tại |
| Số lần | **1 lần/khách duy nhất** trong tháng 6 (chia sẻ với Campaign B) |
| Yêu cầu | Khách post FB/Zalo có tag → staff approve |
| Không vào ví | Discount direct, không tích cumulative |

⚠️ **Lưu ý:** Khách chỉ check-in **1 lần duy nhất** trong tháng 6 — chọn 1 trong 2 phase. DB layer enforce qua UNIQUE INDEX, không cho check-in lần 2.

---

## 🎂 4. BIRTHDAY DISCOUNT

| Tier | Discount tháng sinh nhật |
|---|---|
| Bronze | 5% off |
| Silver | 10% off |
| Gold | 15% off |
| Platinum | 20% off |

**Quy tắc:**
- Áp dụng **cả tháng** khách sinh (vd: sinh ngày 15/5 → áp 1-31/5)
- Tự động kích hoạt khi POS lookup SĐT
- POS hiển thị banner: "🎂 Sinh nhật tháng X — discount Y%"
- KHÔNG cộng dồn với voucher khác / check-in discount
- ✅ CỘNG cashback tier như bình thường (tính trên post-discount amount)

---

## 🤝 5. REFER-A-FRIEND (Giới thiệu bạn)

| Item | Giá trị |
|---|---|
| Phần thưởng | **+10.000đ cashback** vào ví **NGƯỜI GIỚI THIỆU** |
| Người được giới thiệu | **KHÔNG nhận gì** (không bonus, không discount) |
| Điều kiện kích hoạt | Friend mới có **đơn đầu ≥ 20.000đ** |
| Điểm tier | **KHÔNG cộng** cho cả 2 |
| Cap | 1 refer = 1 reward (1 friend mới chỉ tính 1 lần) |

**Quy trình:**
1. Khách A đăng nhập → lấy mã refer (FNB-XXXXXX) qua POS hoặc tự web
2. A share mã cho friend B qua Zalo/FB
3. B đăng ký + apply mã → record `pending` trong DB
4. B đặt đơn đầu ≥ 20k → auto +10k cashback vào ví A → `completed`

---

## 🎉 6. OFFERS NGÀY KHAI TRƯƠNG 6/6 (CỤ THỂ)

### Đêm khai trương 06/06 (T7) — tất cả khách:

| # | Offer | Cap | Cách áp dụng |
|---|---|---|---|
| 1 | **Discount 20% mọi món** | Unlimited | Tự động POS apply |
| 2 | **Cashback x2** (6/10/14/20% theo tier) | Cap 100k/khách | Tự động qua campaign |
| 3 | **Check-in +20k cashback** | 1 lần/khách | Trust-based, staff approve |
| 4 | **Birthday discount 5/10/15/20%** | Auto | POS detect SĐT có DOB tháng 6 |
| 5 | **Refer +10k** cho người giới thiệu | Friend order ≥ 20k | Tự động trigger |

---

## ❌ NHỮNG GÌ ĐÃ BỎ (KHÁCH CŨ CẦN BIẾT)

| Đã có v1/v2 | v3 hiện tại |
|---|---|
| ~~Signup bonus 50.000đ/30.000đ~~ | **0đ** |
| ~~Welcome drink FREE 100 ly~~ | **Bỏ** (chỉ học sinh wave có free) |
| ~~Free 1 ly sinh nhật~~ | Thay bằng **discount % theo tier** |
| ~~Refer +20-50k cho người mới~~ | **Bỏ** — chỉ tặng người giới thiệu |
| ~~Cashback dùng được 100% bill~~ | **Cap 50% bill** (giữ như cũ) |
| ~~Welcome drink Phase 1 VIP family~~ | **Bỏ** Phase 1 (mở bán bình thường) |
| ~~Lễ cắt băng, MC, ca sĩ acoustic~~ | **Bỏ** (mở bán bình thường) |

---

## 🎤 8. KỊCH BẢN STAFF (Khánh + Cường) — GIẢI THÍCH CHO KHÁCH

### Khi khách hỏi "Đăng ký thành viên có gì?":
> "Dạ anh/chị đăng ký miễn phí, mỗi lần mua sẽ tích **3% cashback** vào ví. Mua từ 20k trở lên là có tích. Ví dùng được cho lần sau, tới 50% hoá đơn. Lên hạng Bạc cashback 5%, Vàng 7%, Bạch Kim 10%."

### Khi khách hỏi "Khai trương có ưu đãi gì?":
> "Dạ ngày 6/6 quán giảm 20% mọi món + cashback x2. Anh/chị đăng ký thành viên tích **3/5/7/10%** cashback theo hạng. Ngoài ra có **check-in tặng 20k cashback** — anh/chị chụp ảnh post FB/Zalo có tag #AURACafeSaDec, đưa em xem, em cộng 20k vô ví ngay."

### Khi khách hỏi "Sinh nhật có gì?":
> "Dạ tháng sinh nhật của anh/chị được giảm 5% (Bronze), 10% (Silver), 15% (Vàng), 20% (Bạch Kim) cho mỗi đơn. Áp dụng cả tháng."

### Khi khách hỏi "Giới thiệu bạn được gì?":
> "Dạ anh/chị có mã giới thiệu — share cho bạn đăng ký + bạn mua đơn đầu từ 20k trở lên là **anh/chị nhận 10k vào ví** ngay. Bạn em không nhận thêm gì."

### Khi khách hỏi "Sao ví không trừ hết được?":
> "Dạ ví của AURA dùng tối đa 50% hoá đơn để đảm bảo quán có cash flow. Bill 60k thì ví trừ tối đa 30k, anh/chị trả thêm 30k cash hoặc chuyển khoản."

### Khi khách hỏi "Check-in lần 2 được không?":
> "Dạ một khách chỉ check-in 1 lần duy nhất trong tháng 6. Anh/chị đã nhận 20k tháng này rồi nhé. Tháng 7 quán sẽ có campaign mới."

---

## 🆘 9. ESCALATION NẾU CÓ TRANH CHẤP

### 🟡 Mức 1 (Staff tự xử):
- Khách phàn nàn ví trừ ít: giải thích cap 50%
- Khách hỏi cashback tăng sao chậm: kiểm tra `cashback_transactions` qua POS
- Khách quên mã refer: tra POS qua SĐT

### 🔴 Mức 2 (Gọi anh Còn ngay):
- Khách đòi rút tiền mặt từ ví (KHÔNG cho — ví chỉ dùng mua hàng)
- Khách claim đã check-in nhưng app báo chưa: anh Còn check `checkin_log` trong dashboard
- Khách Platinum đòi cashback cao hơn 10%: KHÔNG nhân nhượng, đã ghi rõ chính sách

### 🔥 Mức 3 (Document + xin lỗi):
- Bug system khiến khách mất cashback → ghi note + tặng 1 voucher 50k → admin (anh Còn) manual adjust qua D1 SQL
- Khách phát hiện lỗi nghiêm trọng (rate sai, double-credit) → screenshot + anh Còn báo em ngay

---

## 📊 10. TỔNG CHI PHÍ EXPOSURE ƯỚC TÍNH (100 khách tháng đầu)

| Item | Cost |
|---|---|
| Cashback issued (rate 3-10% × revenue ~25tr × tier mix) | ~3tr |
| Cashback x2 trong 3 ngày khai trương | ~600k |
| Check-in tuần khai trương (50 khách × 1 lần × 20k) | 1tr |
| Check-in sau khai trương (30 khách × 1 lần × 2.5k discount) | 75k |
| Refer 10k × 30 cặp giả định | 300k |
| Birthday discount 15 khách × avg 10k | 150k |
| Học sinh free drinks + vouchers | 1tr |
| **TỔNG EXPOSURE THÁNG 1** | **~6.1tr** |

→ Trong budget Buffer 3.7tr + Offers 6tr ≈ 9.7tr → **vẫn an toàn**.

---

## 📋 11. CÁC LINK QUAN TRỌNG (anh + staff bookmark)

### Khách:
- 🎫 Đăng ký thành viên: `/dang-ky-thanh-vien`
- 📸 Check-in: `/checkin.html`
- 🍵 Menu: `/menu.html`

### Staff:
- 💳 POS: `/admin/pos.html`
- ✅ Check-in Approve: `/admin/checkin-approve.html`
- 📊 Loyalty Dashboard: `/admin/loyalty-dashboard.html`
- 🚀 Launch Dashboard (real-time): `/admin/launch-dashboard.html` (sau merge PR #43)
- 📦 Stock: `/admin/inventory/stock.html` (sau khi dispatch Task 14-18 inventory)

### Admin (anh Còn):
- 🔑 Login: `/admin/login.html` (email `admin@auraspace.vn`)
- ⚙️ Settings: `/admin/dashboard.html`

---

## ⚠️ 12. ANTI-FRAUD MEASURES

| Rủi ro | Cơ chế chặn |
|---|---|
| Khách tạo nhiều account refer self | UNIQUE INDEX `referred_customer_id` (1 customer chỉ được refer 1 lần) |
| Bot đăng ký mass | Rate limit signup 20 lần/IP/5p (đã có ở `index.js`) |
| Check-in giả mạo post FB | Trust-based staff approve + log staff_id + UNIQUE INDEX 1/tháng |
| Cashback double-credit do bug | UNIQUE INDEX `(order_id, type='earn')` |
| Birthday spam (đổi DOB liên tục) | DOB lưu khi signup, không cho edit (TODO: cần add lock) |
| Tier abuse (cố tình split orders) | KPI ngày: anh Còn check dashboard top spenders |

---

## ✅ 13. ACCEPTANCE — Đã verify production (30/5)

- [x] 4 tier loyalty với thresholds + cashback + birthday discount
- [x] 3 campaigns active (GRAND_OPENING, CHECKIN_WEEK, CHECKIN_DISCOUNT)
- [x] Signup bonus = 0
- [x] Refer cashback 10k
- [x] Check-in 1 lần/khách/tháng 6 (DB UNIQUE enforce)
- [x] Birthday endpoint trả discount đúng theo tier
- [x] Frontend check-in.html + admin checkin-approve.html
- [x] 3 SKU trà sữa hidden chờ activate sau pilot
- [ ] Launch dashboard (PR #43 chưa merge)
- [ ] In standee + leaflet với QR thật

---

## 📞 LIÊN HỆ

- **Anh Còn (Owner):** 097xxxxxxxx
- **Em (Claude support):** Standby qua chat Cowork
- **Production URL:**
  - Worker: `aura-space-worker.sadec-marketing-hub.workers.dev`
  - Pages: `fnb-caffe-container.pages.dev`

---

🎯 **TÓM TẮT 1 CÂU:** AURA tier 3/5/7/10%, ví dùng 50% bill, check-in 1 lần/tháng tặng 20k, refer 10k cho người giới thiệu, sinh nhật giảm 5-20% — tất cả tự động qua app.

📌 **In file này A3 dán quầy** + 1 bản A5 đút quầy POS để khách hỏi tra nhanh.
