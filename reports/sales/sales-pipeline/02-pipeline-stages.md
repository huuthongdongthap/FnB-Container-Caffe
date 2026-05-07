# 02 · Pipeline Stage Definition

**Pipeline**: AURA SPACE — Từ người lạ → Đại sứ thương hiệu
**Stages**: 7
**Cycle time target**: 30 ngày từ Stage 1 → Stage 7

---

## A. Pipeline Overview

```
STAGE 1         STAGE 2         STAGE 3         STAGE 4
AWARENESS  →   INTEREST    →  FIRST VISIT  →  LOYALTY SIGNUP
(1000 leads)    (300 leads)    (150 visits)    (120 signups)

    ↓               ↓               ↓               ↓
Thấy ad/post   Click link     Dùng code      Đăng ký
                Xem website    Gọi món        Phone/Email

────────────────────────────────────────────────────────

STAGE 5         STAGE 6         STAGE 7
REPEAT       → TIER UPGRADE → ADVOCACY
(60 repeats)   (20 upgrades)   (15 advocates)
    ↓               ↓               ↓
Quay lại ≥2     Lên Gold/      Review + Referral
Tự trả tiền     Platinum       UGC content
```

---

## B. Stage Detail

### STAGE 1: AWARENESS — "Biết đến AURA"

| Attribute | Value |
|-----------|-------|
| **Entry trigger** | Thấy ad/post/TikTok/review/được giới thiệu |
| **Exit trigger** | Click vào link / tìm Google Maps / ghé quán |
| **Metric** | Impressions, Reach |
| **Target** | 50,000 reach |
| **Sources** | TikTok, Facebook Ads, IG, Google Maps, Zalo |
| **Content** | Video check-in, ảnh rooftop, promo codes |
| **Conversion rate** | → S2: 2-3% (1,000-1,500 leads) |

### STAGE 2: INTEREST — "Muốn ghé AURA"

| Attribute | Value |
|-----------|-------|
| **Entry trigger** | Click ad → Website / Google Maps / Messenger |
| **Exit trigger** | Ghé quán thực tế hoặc order delivery |
| **Metric** | Website visits, clicks, messages |
| **Target** | 3,000 visits |
| **Actions** | Xem menu, xem ảnh không gian, check giá |
| **Nurture** | Retarget ad ("Bạn đã xem AURA — giảm 20% đơn đầu") |
| **Conversion rate** | → S3: 10-15% (300-450 visits → ghé quán) |

### STAGE 3: FIRST VISIT — "Lần đầu ghé"

| Attribute | Value |
|-----------|-------|
| **Entry trigger** | Đến quán / order GrabFood |
| **Exit trigger** | Đăng ký loyalty hoặc thanh toán xong |
| **Metric** | First orders, promo code usage |
| **Target** | 500 first orders |
| **Key action** | Dùng code khuyến mãi (GRANDOPEN25, FIRSTORDER...) |
| **Staff script** | "Anh/chị dùng code FIRSTORDER giảm 20% nhé. Đăng ký loyalty miễn phí tích điểm nè!" |
| **Conversion rate** | → S4: 80% (400 signups out of 500 visits) |

### STAGE 4: LOYALTY SIGNUP — "Thành viên"

| Attribute | Value |
|-----------|-------|
| **Entry trigger** | Đăng ký loyalty (phone/email) |
| **Exit trigger** | Quay lại lần 2 |
| **Metric** | Loyalty signups, tier = Đồng |
| **Target** | 400 signups |
| **Welcome flow** | Email: "Chào mừng! +100 điểm. Mã FIRSTORDER cho bạn bè." |
| **Key hook** | Hiển thị ngay số điểm + cashback tích được từ đơn vừa rồi |
| **Conversion rate** | → S5: 30-40% (120-160 quay lại trong 30 ngày) |

### STAGE 5: REPEAT PURCHASE — "Khách quen"

| Attribute | Value |
|-----------|-------|
| **Entry trigger** | Visit thứ 2 (tự trả tiền, không cần code) |
| **Exit trigger** | Đủ điểm lên Gold / Platinum |
| **Metric** | Repeat rate, avg ticket, visit frequency |
| **Target** | 150 repeat customers |
| **Nurture** | THANKYOU15, MONDAYBOOST, weekend offers |
| **Behavior signal** | KH bắt đầu quan tâm points balance |
| **Conversion rate** | → S6: 15-20% (20-30 lên tier cao hơn trong 30 ngày) |

### STAGE 6: TIER UPGRADE — "VIP"

| Attribute | Value |
|-----------|-------|
| **Entry trigger** | Đạt 500đ (Gold) / 1000đ (Platinum) |
| **Exit trigger** | Bắt đầu giới thiệu bạn bè / viết review |
| **Metric** | Tier distribution, cashback earned |
| **Target** | 20 Gold + 5 Platinum |
| **Perks** | Cashback 5-8%, free upsize, ưu tiên đặt bàn |
| **VIP treatment** | Email cá nhân "Chúc mừng lên Gold!", staff gọi tên khi đến |
| **Conversion rate** | → S7: 50%+ (VIP thường thành advocates) |

### STAGE 7: ADVOCACY — "Đại sứ"

| Attribute | Value |
|-----------|-------|
| **Entry trigger** | Viết review Google 5★ / giới thiệu ≥2 bạn / đăng UGC |
| **Exit trigger** | Trở thành referral engine bền vững |
| **Metric** | Referrals, reviews, UGC posts |
| **Target** | 15 advocates |
| **Reward** | 200đ/referral, surprise gift, invite VIP event |
| **Lifetime value** | 1 advocate → 3-5 KH mới (CAC = 0₫) |

---

## C. Pipeline Dashboard — Real-time Metrics

### Health Indicators

| Stage | Metric | Green | Yellow | Red |
|-------|--------|-------|--------|-----|
| S1→S2 | CTR | >3% | 1-3% | <1% |
| S2→S3 | Visit→Visit | >15% | 8-15% | <8% |
| S3→S4 | Signup rate | >80% | 60-80% | <60% |
| S4→S5 | Repeat rate 30d | >40% | 25-40% | <25% |
| S5→S6 | Tier upgrade rate | >20% | 10-20% | <10% |
| S6→S7 | Advocacy rate | >50% | 30-50% | <30% |

### Conversion Funnel (Target 30 ngày)

```
50,000  ┤  Awareness (reach)
        │  ↓ 3%
 1,500  ┤  Interest (visits)          ─┐
        │  ↓ 33%                        │ 97% drop
   500  ┤  First Visit (orders)       ──┘
        │  ↓ 80%
   400  ┤  Loyalty Signup             ─┐
        │  ↓ 38%                        │ 60% drop
   150  ┤  Repeat Purchase            ──┘
        │  ↓ 17%
    25  ┤  Tier Upgrade               ─┐
        │  ↓ 60%                        │ 40% drop
    15  ┤  Advocacy                   ──┘
```

---

## D. Stage Automation — Worker Triggers

| Stage Transition | Trigger | Automation |
|-----------------|---------|------------|
| S2 → S3 (chưa ghé) | 3 ngày sau click, chưa có order | Email/SMS: "Giảm 20% đơn đầu — FIRSTORDER" |
| S3 → S4 (chưa đăng ký) | Ngay sau order, chưa có customer_id | Staff prompt + QR code + SMS link |
| S4 → S5 (chưa quay lại) | 7 ngày sau visit cuối, 0 order mới | Email: "Nhớ bạn rồi" + THANKYOU15 |
| S4 → S5 (sắp hết hạn points) | 30 ngày trước points expiry | Email: "Bạn còn XX điểm sắp hết hạn" |
| S5 → S6 (gần lên tier) | Points còn thiếu ≤20% để lên tier | Email: "Sắp lên Gold rồi! Chỉ cần XXđ nữa" |
| S6 (sinh nhật) | Birthday this month | Email: "Happy birthday! Tặng bạn XX% off" |
| Any → Dormant | >30 ngày không ghé | Email khảo sát: "Thiếu gì để quay lại?" |
| S7 → Referral loop | Mỗi referral thành công | Cả 2 nhận 200đ + email cảm ơn |

---

## E. Pipeline Ownership

| Stage | Owner | Tool |
|-------|-------|------|
| S1-S2 | Marketing (ads) | TikTok/Facebook/Google Ads |
| S2-S3 | Marketing + Staff | Website analytics + POS |
| S3-S4 | Staff (in-store) | POS + loyalty QR |
| S4-S5 | CRM (automated) | Email/SMS automation |
| S5-S6 | CRM + Staff | Email + in-store recognition |
| S6-S7 | Community Manager | Manual outreach |
