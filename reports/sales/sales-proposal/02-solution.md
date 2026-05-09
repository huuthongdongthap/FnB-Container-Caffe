# 02 · Solution Design

**Client**: AURA SPACE
**Package**: "AURA GRAND OPENING — Uống Là Có Lời"

---

## A. Solution Overview

Gói giải pháp 2 tầng, 30 ngày:

```
┌─────────────────────────────────────────────────┐
│            TẦNG 1: KHAI TRƯƠNG (30 NGÀY)        │
│  11 promo codes · 5 kênh marketing · Paid ads   │
│  Target: 500 KH mới · Budget: 15M₫              │
└─────────────────────────────────────────────────┘
                        ↓ chuyển tiếp tự động
┌─────────────────────────────────────────────────┐
│           TẦNG 2: THƯỜNG NIÊN (ONGOING)         │
│  4-tier loyalty · Cashback 2-8% · Rewards       │
│  10 rewards · Referral · Birthday auto          │
└─────────────────────────────────────────────────┘
```

---

## B. Tầng 1 — Khai Trương (30 ngày)

### B1. Promotion Codes — 11 Mã

| Code | Giảm | Đối tượng | Limit | Mục đích |
|------|------|-----------|-------|----------|
| `GRANDOPEN25` | 25% | Tất cả | 200 | Launch day buzz |
| `FIRSTORDER` | 20% | KH mới | 300 | Acquisition |
| `TIKTOK15` | 15% | KH TikTok | 200 | Channel-specific |
| `INSTA15` | 15% | KH Instagram | 100 | Channel-specific |
| `WELCOME50` | 50% | KH mới | 100 | High conversion offer |
| `WEEKEND20` | 20% | Tất cả | 200 | Weekend boost |
| `MONDAYBOOST` | Points ×2 | Tất cả | Unl. | Monday lull fill |
| `DUO20` | Combo -20K | Cặp đôi | 150 | Pair dining |
| `THANKYOU15` | 15% | KH cũ | 500 | Retention |
| `ACOUSTIC20` | 20% | Event | 100 | Event promo |
| `VIPFIRST` | 10% + upsize | VIP | 50 | High-tier perk |

### B2. Channel Activation — 5 Kênh

| Kênh | Budget | Content | Frequency |
|------|--------|---------|-----------|
| **TikTok** | 3M₫ ads + 1.5M₫ KOL | Reel check-in, behind-the-scenes, UGC | 3-4 video/tuần |
| **Facebook** | 3M₫ ads | Post + Messenger bot + group seeding | 2 bài/ngày |
| **Google Maps** | 1.5M₫ ads | Listing optimization + review campaign | 2 post/tuần |
| **Instagram** | 1.5M₫ ads | Story + grid lifestyle | 2 post + 3 story/tuần |
| **Email / Website** | — | Landing page + 4 email triggers | Promotions page |

### B3. Content Calendar

30 ngày content được lập lịch chi tiết từng ngày, từng nền tảng (xem `03-content-calendar.md` trong marketing campaign).

---

## C. Tầng 2 — Thường Niên (Ongoing)

### C1. Loyalty 4-Tier

| Tier | Điểm | Cashback | Point × | Birthday | Perks |
|------|------|----------|---------|----------|-------|
| 🥉 **Đồng** | 0 | 2% | 1.0x | 10% off | Cơ bản |
| 🥈 **Bạc** | 5,000 | 4% | 1.5x | 100 điểm | Free upsize |
| 🥇 **Vàng** | 15,000 | 6% | 2.0x | 200 điểm | 10% discount + referral bonus |
| 💎 **Kim Cương** | 50,000 | 8% | 3.0x | 500 điểm | 15% discount + secret menu + VIP event |

### C2. Rewards Catalog — 10 Rewards

| Reward | Điểm | Loại |
|--------|------|------|
| Free Espresso | 150 | Free drink |
| Voucher 20K | 200 | Discount |
| Free Signature Drink | 300 | Free drink |
| Free Croissant | 120 | Free food |
| Voucher 50K | 500 | Discount |
| Combo 2 người | 600 | Combo |
| Voucher 100K | 1,000 | Discount |
| Ly giữ nhiệt AURA | 800 | Merch |
| 15% Discount (5 lần) | 1,500 | % Discount |
| Secret Menu Access | 2,000 | Exclusive |

### C3. Point Earning Activities

| Activity | Points |
|----------|--------|
| Mỗi 10,000₫ chi tiêu | 1 (× tier multiplier) |
| Đăng ký loyalty mới | 100 |
| Mua đơn đầu tiên | 100 |
| Viết Google review 5★ | 50 |
| Share MXH tag @AURA | 30 |
| Giới thiệu bạn bè | 200 (cả 2) |
| Sinh nhật | Tùy tier |

### C4. Email Automation — 4 Triggers

| Trigger | Email |
|---------|-------|
| Đăng ký loyalty | Welcome + 100 bonus + FIRSTORDER |
| 3 ngày không ghé | "Nhớ bạn rồi" + 10% off |
| Lên tier | Chúc mừng + perks mới |
| Sinh nhật | Discount tùy tier |

---

## D. Tech Stack — Triển khai trên hạ tầng hiện có

| Component | Status | Action Required |
|-----------|--------|-----------------|
| **API /api/promotions** | ✅ Có sẵn | Seed 11 codes vào DB |
| **API /api/loyalty** | ✅ Có sẵn | Đã có loyalty routes + DB |
| **Bảng promotions** | ✅ Schema có | INSERT seed data |
| **Bảng loyalty_tiers** | ✅ Có sẵn | Đã seed (Đồng/Bạc/Vàng/KC) |
| **UI checkout** | ✅ Có ô nhập code | Cần thêm hiển thị codes gợi ý |
| **UI promotions page** | ❌ Chưa có | Tạo promotions.html |
| **Email triggers** | ❌ Chưa có | Build Worker email service |
| **Tracking (GA4/Pixel)** | ❌ Chưa có | Cài tracking script |

---

## E. Deliverables

| # | Deliverable | Format | Timeline |
|---|-------------|--------|----------|
| 1 | Seed SQL — 11 promotion codes | `.sql` file | Day 1 |
| 2 | `promotions.html` — hiển thị mã active | HTML page | Day 2 |
| 3 | Email template — 4 triggers | HTML + Worker route | Day 3 |
| 4 | Checkout UI enhancement — gợi ý codes | JS update | Day 2 |
| 5 | Google Business Profile optimization | — | Day 1 |
| 6 | TikTok/Facebook ad creative pack | 10 assets | Day 3 |
| 7 | Staff training script — loyalty explainer | `.md` | Day 5 |
| 8 | Analytics tracking setup | Script tag | Day 1 |

---

## F. Timeline — 7 Ngày Triển Khai

```
Day 1: Seed DB + Google Profile + Tracking
Day 2: promotions.html + Checkout UI enhancement
Day 3: Email templates + Ad creatives
Day 4-5: Test full flow (order → points → cashback → redeem)
Day 6: Staff training + soft launch
Day 7: GO LIVE — ads active, influencer content posted
```
