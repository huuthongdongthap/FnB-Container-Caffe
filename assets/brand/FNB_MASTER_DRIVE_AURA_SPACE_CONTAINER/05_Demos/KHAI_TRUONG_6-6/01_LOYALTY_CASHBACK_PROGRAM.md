# 🎫 AURA CAFE — Chương trình thành viên & Hoàn tiền v1.0

> **Activation:** 06/06/2026 (cùng ngày khai trương)
> **Platform:** Web hiện có (D1 + KV + Workers) — tối ưu thêm từ hệ đã có
> **Brand:** v6 Mineral + Cobalt (sắp deploy)

---

## 🎯 Triết lý chương trình

**Khẩu hiệu nội bộ:** "Khách quay lại lần 2 — đó là khi quán thành công."

Cashback (hoàn tiền) là cú đẩy mạnh nhất cho khách quay lại lần 2, 3, 4. Khác với discount (chỉ giảm 1 lần), cashback **tạo ví có giá trị → khách phải quay lại để dùng**.

**3 nguyên tắc:**
1. **Dễ hiểu** — khách tỉnh lẻ Sa Đéc không cần điều kiện phức tạp
2. **Visible** — khách thấy ngay ví sau mỗi order
3. **Quay vòng** — cashback luôn dùng cho lần sau, không rút tiền mặt

---

## 🏆 4 Tier Thành Viên

Tận dụng cấu trúc đã có trong web — tinh chỉnh tỉ lệ cashback cho realistic với cafe Sa Đéc.

### Tier 1 — Đồng (Bronze) 🥉

| | |
|---|---|
| **Điều kiện** | Đăng ký miễn phí (Zalo/SĐT) |
| **Tích lũy năm** | 0 - 500k VNĐ |
| **Cashback** | **3%** mỗi giao dịch |
| **Phúc lợi** | Sinh nhật tặng 1 ly free, refer-a-friend +20k |
| **Hết hạn** | Cashback có giá trị 90 ngày |

### Tier 2 — Bạc (Silver) 🥈

| | |
|---|---|
| **Điều kiện** | Tích lũy 500k - 2tr/năm |
| **Cashback** | **5%** mỗi giao dịch |
| **Phúc lợi** | Bronze + Free upgrade size 1 lần/tuần |
| **Đặc quyền** | Ưu tiên booking bàn cuối tuần |
| **Hết hạn** | Cashback có giá trị 120 ngày |

### Tier 3 — Vàng (Gold) 🥇

| | |
|---|---|
| **Điều kiện** | Tích lũy 2tr - 5tr/năm |
| **Cashback** | **7%** mỗi giao dịch |
| **Phúc lợi** | Silver + Birthday gift box + Free welcome drink mỗi tháng |
| **Đặc quyền** | Mời tham dự event tasting hàng quý |
| **Hết hạn** | Cashback có giá trị 180 ngày |

### Tier 4 — Bạch Kim (Platinum) 💎

| | |
|---|---|
| **Điều kiện** | Tích lũy >5tr/năm hoặc invite VIP |
| **Cashback** | **10%** mỗi giao dịch |
| **Phúc lợi** | Gold + Personal barista call + Free private booking 4h/năm |
| **Đặc quyền** | Test menu mới trước public, name in plaque (nếu opt-in) |
| **Hết hạn** | Cashback không hết hạn |

---

## 💰 Cách hoạt động Cashback

### Quy trình giao dịch
```
1. Khách order: 100k
2. POS: Hỏi SĐT/QR thành viên
3. Tier identify: VD Silver → 5%
4. Order total: 100k (full pay)
5. Cashback credit: 5k vào ví ngay sau payment
6. Notify: SMS/Zalo "+5k vào ví AURA, balance: 50k"
7. Lần sau: Khách dùng tối đa 50% bill từ ví
   VD: bill 60k → max 30k từ ví + 30k cash
```

### Hạn chế (tránh abuse)
- **Min order áp dụng cashback:** 30k (không tích cho bill nhỏ)
- **Max cashback/giao dịch:** 50k (Platinum 5tr+ bill được chia làm 2)
- **Min order khi dùng ví:** 30k
- **Max % dùng từ ví:** 50% bill (đảm bảo cafe có cash flow)
- **Không cộng dồn ưu đãi:** ví dụ đang có voucher 20% rồi thì cashback tier giảm 50%
- **Hết hạn:** theo tier (90/120/180/unlimited)

---

## 🎁 Bonus khai trương 6/6 — 8/6

Áp dụng thêm trên top tier rules — chỉ 3 ngày khai trương:

| # | Bonus | Điều kiện | Ai được | Cap |
|---|---|---|---|---|
| 1 | **+50k seed vào ví khi đăng ký** | Đăng ký mới ngày 6/6 | First 100 sign-ups | 100 |
| 2 | **+30k seed vào ví** | Đăng ký 7/6 | First 50 mỗi ngày | 100 |
| 3 | **+20k seed vào ví** | Đăng ký 8/6 | All sign-ups | Unlimited |
| 4 | **Cashback x2** | Mọi tier × 2 trong 3 ngày | All members | Unlimited (capped 100k/customer) |
| 5 | **Auto-upgrade Silver** | Đăng ký + spend ≥200k ngày 6/6 | All | Unlimited |
| 6 | **Refer +50k** thay vì 20k | Refer trong 3 ngày khai trương | All | Max 5 refer/người |

**Total bonus fund:** ~5tr (cap)
- 100 × 50k = 5tr (seed day 1)
- Cashback x2 ~tăng 50% so với normal day → ~1tr
- Refer +50k ước 30 cặp → 1.5tr

→ Spend ~7.5tr bonus → Cap thực tế 3tr trong budget khai trương (priority: seed 60 sign-ups day-1, sau đó giảm/đóng dần).

---

## 📲 Cách đăng ký thành viên

### Phương thức 1: Tại quán (chính)
1. Khách order → staff hỏi "Anh/Chị có thẻ thành viên AURA chưa?"
2. Nếu CHƯA → staff cầm tablet/iPad sign-up:
   - SĐT (bắt buộc, dùng làm ID)
   - Họ tên
   - Ngày sinh (cho birthday gift)
   - Zalo (optional)
3. POS auto-create record trong DB, gửi SMS confirm + welcome bonus
4. Mỗi giao dịch sau chỉ cần đọc SĐT

### Phương thức 2: QR code self-service
1. QR code in trên menu, standee, bàn
2. Khách quét → mở web form `/dang-ky-thanh-vien`
3. Form ngắn: SĐT + Tên + DOB + Optional Zalo
4. Submit → SMS confirm + redirect xem ví
5. Cảm giác "tự đăng ký" → không tốn thời gian staff peak hour

### Phương thức 3: Zalo Mini App (sau khai trương)
- Phase 2 sau 1 tháng — tích hợp Zalo Mini App
- Khách có sẵn ZNS notification + ví hiển thị trong Zalo
- Không cần app riêng (avoid cài đặt)

---

## 🛠 Tối ưu hệ web hiện có

### Backend (Workers + D1) — cần update

**1. Loyalty rules table — cần seed data:**
```sql
INSERT INTO loyalty_tiers (id, name, min_spent, max_spent, cashback_rate, expiry_days) VALUES
  (1, 'Bronze', 0, 500000, 0.03, 90),
  (2, 'Silver', 500000, 2000000, 0.05, 120),
  (3, 'Gold', 2000000, 5000000, 0.07, 180),
  (4, 'Platinum', 5000000, NULL, 0.10, NULL);
```

**2. Bonus campaigns table — NEW:**
```sql
CREATE TABLE bonus_campaigns (
  id INTEGER PRIMARY KEY,
  name TEXT,
  start_date TEXT,
  end_date TEXT,
  cashback_multiplier REAL DEFAULT 1.0,
  signup_bonus INTEGER DEFAULT 0,
  refer_bonus INTEGER DEFAULT 20000,
  max_cap_per_customer INTEGER,
  active BOOLEAN DEFAULT 1
);

INSERT INTO bonus_campaigns VALUES
  (1, 'Grand Opening 6/6', '2026-06-06', '2026-06-08', 2.0, 50000, 50000, 100000, 1);
```

**3. Cashback calc endpoint — cần update logic:**
```js
// worker/src/routes/cashback.js
function calculateCashback(orderTotal, customerTier, activeCampaign) {
  const baseRate = TIER_RATES[customerTier]; // 0.03 - 0.10
  const multiplier = activeCampaign?.cashback_multiplier || 1.0;
  const rawCashback = orderTotal * baseRate * multiplier;
  const cap = activeCampaign?.max_cap_per_customer || 50000;
  return Math.min(rawCashback, cap);
}
```

**4. Sign-up flow update:**
- Check active campaign → +seed bonus
- Auto-upgrade nếu spend ≥200k cùng ngày
- Send SMS welcome + ví balance

### Frontend (web) — cần update

**1. Hero countdown timer (10 ngày trước launch):**
```html
<div class="hero-countdown">
  <span class="label">KHAI TRƯƠNG</span>
  <span class="date">06.06.2026</span>
  <div class="counter">
    <span id="days">12</span> ngày
    <span id="hours">04</span> giờ
    <span id="mins">23</span> phút
  </div>
</div>
```

**2. Loyalty section — copy refresh:**
- Bronze: "Bước chân đầu tiên vào AURA"
- Silver: "Bạn thường xuyên của quán"
- Gold: "Người bạn thân thiết"
- Platinum: "Family của AURA"

**3. Cashback calculator — pre-fill khai trương x2:**
```js
if (Date.now() <= LAUNCH_DATE_PLUS_3) {
  multiplier = 2; // banner "x2 trong 3 ngày khai trương"
}
```

**4. Đăng ký form `/dang-ky-thanh-vien` — NEW page:**
- Mobile-first
- 4 fields only (SĐT, Tên, DOB, Zalo)
- Submit → success page with welcome bonus + ví balance
- Print thẻ thành viên ID 6 chữ số

---

## 📲 SMS/Zalo notifications

| Event | Channel | Template |
|---|---|---|
| Đăng ký thành công | SMS | "Chào mừng [Tên] đến AURA CAFE! Mã thành viên: AC[6 chữ số]. Ví: 50.000đ. https://aura.cafe/vi/[id]" |
| Sau mỗi giao dịch | SMS | "+[X]đ vào ví AURA. Tổng: [Y]đ. Cảm ơn [Tên]!" |
| Upgrade tier | SMS | "🎉 Chúc mừng [Tên] lên hạng [Tier]! Quà tặng: [Benefit]" |
| Sinh nhật | Zalo | "Sinh nhật vui vẻ [Tên]! Tặng bạn 1 ly tự chọn tại AURA. Hạn 7 ngày." |
| Cashback sắp hết hạn | SMS | "Còn 7 ngày để dùng [X]đ trong ví AURA. Hẹn anh/chị ghé ☕" |

**Chi phí SMS:** ~300đ/tin × 100 khách × 2 SMS/tuần = ~24k/tuần = ~100k/tháng. OK.

---

## 🔒 Anti-fraud measures

| Rủi ro | Mitigation |
|---|---|
| 1 người tạo nhiều account refer self | Verify SĐT khác nhau, IP check, manual review nếu refer >5 |
| Staff scan QR sai customer | POS log staff_id mỗi giao dịch, audit weekly |
| Cashback double-credit do bug | Idempotency key per order, max 1 cashback per order_id |
| Bot đăng ký mass | Captcha sau 3 đăng ký/IP/giờ |
| Phong cào lì xì 6/6 | Phong sealed + staff phát tại counter, không tự chọn |

---

## 📊 KPI tracking (admin dashboard)

Cần thêm widget vào dashboard.html:

| Widget | Metric | Refresh |
|---|---|---|
| Members total | Count by tier | Real-time |
| Cashback issued today | Sum VND | Real-time |
| Cashback redeemed today | Sum VND | Real-time |
| Redemption rate | % redeemed / issued | Daily |
| Top 10 spenders | Tên + tổng spend | Daily |
| Members expiring soon | Cashback hết hạn <7d | Daily |
| New sign-ups by channel | At-store / QR / Zalo | Daily |
| Refer-a-friend converted | Count pairs | Weekly |

---

## ✅ Acceptance criteria trước 6/6

- [ ] D1 schema: loyalty_tiers, bonus_campaigns seeded
- [ ] Worker endpoints: signup, calc-cashback, redeem-cashback, get-balance — all live & tested
- [ ] Frontend: `/dang-ky-thanh-vien` page live + QR code generated
- [ ] SMS gateway integrated (Speedsms/Esms VN) + balance đủ 1 tháng
- [ ] Admin dashboard: 8 widget tracking
- [ ] Test 10 customer mock end-to-end: sign-up → order → cashback → redeem
- [ ] Staff training: 2 buổi, mỗi buổi 2h
- [ ] Print 100 thẻ thành viên cứng (cho VIP Phase 1)
- [ ] Standee giải thích chương trình tại quán
- [ ] Leaflet QR đăng ký gửi kèm hóa đơn

---

## 🚧 Phase 2 ideas (sau 1-3 tháng, tham khảo)

- Birthday month: cashback x2 cả tháng
- "AURA Day" thứ Tư hàng tuần: cashback x1.5
- Tier upgrade visual: progress bar trong app/SMS link
- Gift cashback: tặng cashback cho friend nhân dịp
- Group order (≥4 người): bonus cashback 2%
- Subscription: 199k/tháng → cashback 10% all orders + 1 free coffee/week

---

## 🆘 Rollback plan nếu lỗi nặng 6/6

1. **POS không tính cashback:** Tay ghi vào Google Sheet, refund 5% sau trong tuần
2. **Site đăng ký down:** Bảng giấy tay → nhập DB sau, vẫn cộng bonus
3. **SMS không gửi:** Print thẻ giấy có mã ID + balance, khách giữ
4. **Khách phản ứng tiêu cực với rules:** Free upgrade Silver miễn phí cho complainers

---

Anh review → confirm tier rates / cashback %  / bonus campaign cap → em dispatch worker dev task (task `08-loyalty-launch-prep.md`) sang Mekong CLI để code các endpoint + DB schema.
