# 01 · Lead Qualification — ICP Criteria

**Pipeline**: Khuyến Mãi + Loyalty AURA SPACE
**Date**: 2026-05-07
**Purpose**: Xác định ai là lead chất lượng, cách qualify đầu vào

---

## A. ICP — Ideal Customer Profile

### ICP 1: Gen Z Explorer (P1)
| Tiêu chí | Giá trị |
|----------|---------|
| Tuổi | 18-25 |
| Vị trí | Sa Đéc + 10km |
| Hành vi online | Lướt TikTok ≥1h/ngày, Instagram check-in |
| Thu nhập | 3-7M₫/tháng |
| Pain point | Thiếu không gian sống ảo chất lượng |
| Trigger kênh | TikTok, Instagram |
| Ticket size | 35-55,000₫ |
| Frequency target | 1-2 lần/tuần |

### ICP 2: Office Professional (P2)
| Tiêu chí | Giá trị |
|----------|---------|
| Tuổi | 28-40 |
| Vị trí | Sa Đéc nội thị |
| Hành vi online | Facebook, Google Maps, Zalo |
| Thu nhập | 10-20M₫/tháng |
| Pain point | Cần không gian yên tĩnh làm việc / họp |
| Trigger kênh | Google Maps, Facebook |
| Ticket size | 45-65,000₫ |
| Frequency target | 3-5 lần/tuần |

### ICP 3: Premium Dater (P3)
| Tiêu chí | Giá trị |
|----------|---------|
| Tuổi | 25-35 |
| Vị trí | Sa Đéc + 30km (Cao Lãnh, Long Xuyên) |
| Hành vi online | Instagram, Website booking |
| Thu nhập | 15-30M₫/tháng |
| Pain point | Thiếu chỗ date sang view đẹp |
| Trigger kênh | Instagram Story Ads, Website |
| Ticket size | 80-150,000₫ (combo) |
| Frequency target | 1-2 lần/tháng |

### ICP 4: Tourist Discoverer (P4)
| Tiêu chí | Giá trị |
|----------|---------|
| Tuổi | 30-55 |
| Vị trí | Ngoài Sa Đéc (du lịch Đồng Tháp) |
| Hành vi online | Google Maps, travel blog, Facebook group |
| Thu nhập | 15-50M₫/tháng |
| Pain point | Cần điểm check-in du lịch độc đáo |
| Trigger kênh | Google Maps, Travel groups |
| Ticket size | 55-100,000₫ |
| Frequency target | 1 lần (du lịch), potential repeat nếu quay lại |

---

## B. Qualification Triggers — Nguồn Lead

### B1. Inbound Channels

| Kênh | Signal | Cách capture |
|------|--------|-------------|
| **TikTok** | View video → Click link bio | Link tree → Website → Pixel |
| **Facebook Ads** | Click "Đặt bàn" / "Xem menu" | CTA → Website → Capture email/phone |
| **Google Maps** | Search "cà phê Sa Đéc" → Click website | Maps listing → Website |
| **Instagram** | Swipe up story → Landing page | Story Ads → LP |
| **Walk-in** | Khách ghé trực tiếp | Staff mời đăng ký loyalty (phone) |
| **Referral** | Bạn bè giới thiệu → dùng ref link | `auracafe.vn/ref/ABC123` |

### B2. Lead Capture Points

| Điểm capture | Data thu thập | Form |
|-------------|---------------|------|
| Website popup (thoát trang) | Email | 1 field |
| Checkout page | Phone (bắt buộc) + Email (optional) | 2 fields |
| In-store QR code | Phone | 1 field |
| Messenger bot | Name + Phone | 2 fields |
| Google Maps "Nhắn tin" | Auto-reply → Link form | Bot flow |

---

## C. Lead Qualification Rules

### C1. MUST-HAVE (Disqualify nếu thiếu)

| Tiêu chí | Threshold | Lý do |
|----------|-----------|-------|
| Phone hoặc Email | Bắt buộc | Không có contact = không retarget được |
| Đã từng ghé quán | Không bắt buộc | Cả KH mới và cũ đều là lead |

### C2. SHOULD-HAVE (Tăng điểm)

| Tiêu chí | Threshold | Điểm |
|----------|-----------|------|
| Đã dùng 1 promo code | ≥1 lần | +20 |
| Đã đăng ký loyalty | Có customer_id | +30 |
| Ticket size trung bình | ≥60,000₫ | +15 |
| Đã giới thiệu bạn bè | ≥1 referral | +25 |
| Đã viết review | Google hoặc Facebook | +20 |
| Quay lại trong 7 ngày | ≥2 visits | +10 |
| Sinh nhật trong tháng | Current month | +5 (trigger bonus) |

### C3. NICE-TO-HAVE (Contextual)

| Tiêu chí | Threshold |
|----------|-----------|
| Follow Facebook page | Yes/No |
| Share bài viết | Yes/No |
| Comment trên post | Yes/No |
| Tham gia event | Yes/No |
| Đặt bàn trước (booking) | Yes/No |

---

## D. Lead Segmentation — Sau Qualification

| Segment | Điều kiện | Hành động |
|---------|-----------|-----------|
| **Hot Lead** | Đã đăng ký loyalty + ticket ≥60K | Push lên tier Gold, invite VIP event |
| **Warm Lead** | Đã dùng code + chưa đăng ký loyalty | Email retarget: "Đăng ký loyalty nhận 100đ" |
| **Cold Lead** | Có contact nhưng chưa ghé | Gửi FIRSTORDER code + ảnh không gian |
| **Dormant Lead** | Đã ghé 1 lần >14 ngày không quay lại | Email: "Nhớ bạn rồi" + THANKYOU15 |
| **Champion** | Repeat ≥3 lần + referral + review | Invite làm ambassador, gửi quà surprise |
| **At-Risk** | Đã từng repeat nhưng >30 ngày không ghé | SMS/Email: khảo sát "thiếu gì để quay lại?" |

---

## E. Data Sources — Unified Lead View

```
┌─────────────────────────────────────────────────┐
│                  UNIFIED LEAD VIEW               │
│  customer_id ← key join                         │
├─────────────────────────────────────────────────┤
│  customers        : phone, email, name, tier     │
│  orders           : count, total, last_order,    │
│                     avg_ticket, promo_code_used   │
│  loyalty_points   : balance, history             │
│  cashback_wallets : balance, earned, spent       │
│  user_rewards     : redeemed count               │
│  referral_codes   : times_used, points_earned    │
│  reviews          : count, rating (Google/FB)    │
│  events           : attended count               │
└─────────────────────────────────────────────────┘
```

---

## F. ICP Fit Score — Quick Card

Dùng bởi staff tại quán để qualify walk-in lead:

| Câu hỏi | Có (+1) | Không (0) |
|---------|---------|------------|
| KH có dùng smartphone không? | ☐ | ☐ |
| KH có dùng MXH (TikTok/FB/Zalo) không? | ☐ | ☐ |
| KH có thể quay lại trong tuần? | ☐ | ☐ |
| KH đi cùng bạn bè/đồng nghiệp? | ☐ | ☐ |
| KH có vẻ thích không gian? | ☐ | ☐ |
| **TOTAL (0-5)** | | |

- **4-5**: Hot — mời đăng ký loyalty ngay, tặng bonus 100đ
- **2-3**: Warm — giới thiệu loyalty + tặng FIRSTORDER
- **0-1**: Cold — phục vụ tốt, không push
