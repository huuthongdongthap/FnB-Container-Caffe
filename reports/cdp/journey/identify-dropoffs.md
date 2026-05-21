# IDENTIFY DROPOFFS — AURA SPACE Customer Journey
> Conversion Goals: Walk-by → Visit → Signup → Repeat → Refer  
> Goal: khách hàng chủ yếu là dân đi làm, người trẻ và trung niên, freelancer

---

## Conversion Funnel (All Personas, Monthly)

```
                          ┌──────────────────────────────┐
                          │  15,000 Walk-by impressions   │ 100%
                          └──────────────┬───────────────┘
                                         │ ↓ 3.3% enter
                          ┌──────────────▼───────────────┐
                          │       500 First visits        │  3.3%
                          └──────────────┬───────────────┘
                                         │ ↓ 40% sign up
                          ┌──────────────▼───────────────┐
                          │     200 Loyalty signups       │  1.3%
                          └──────────────┬───────────────┘
                                         │ ↓ 50% return
                          ┌──────────────▼───────────────┐
                          │      100 Active members        │ 0.67%
                          └──────────────┬───────────────┘
                                         │ ↓ 15% refer
                          ┌──────────────▼───────────────┐
                          │       15 Referral loops        │ 0.1%
                          └──────────────────────────────┘
```

---

## Dropoff Analysis

### DROPOFF #1: Walk-by → Enter Store (LOSS: 14,500 people, 96.7%)

| Persona | Why They Don't Enter | Severity | Fix |
|---------|---------------------|----------|-----|
| Minh (VP) | Đang vội đi làm, không thấy menu rõ | 🔴 HIGH | Menu board ngoài trời to hơn, giá rõ ràng |
| Lan (Freelancer) | Không biết có WiFi/ổ cắm, không thấy ai ngồi làm việc | 🟠 MED | Treo bảng "WiFi Miễn Phí — Ổ Cắm Mỗi Bàn" ở mặt tiền |
| Chú Tư (TN) | Quán mới, không quen, thích quán cũ | 🔴 HIGH | Bảng "Cà Phê Phin Truyền Thống — 25K" để thu hút |

**Optimization**: 
- A-frame sign outside: "☕ WiFi FREE · Ổ Cắm · Cà Phê Phin 25K"
- Visible menu with top 5 items + prices
- "Grand Opening" banner (first 30 days)

### DROPOFF #2: First Visit → Signup (LOSS: 300 people, 60%)

| Persona | Why They Don't Sign Up | Severity | Fix |
|---------|----------------------|----------|-----|
| Minh (VP) | NV không mời, hoặc mời không đúng lúc (đang vội) | 🔴 HIGH | Staff script: mời ngay khi đưa bill |
| Lan (Freelancer) | Không thấy QR trên bàn, hoặc QR dẫn đến trang không mobile-friendly | 🟡 LOW | QR code nổi bật trên mỗi bàn, loyalty page mobile-first ✅ |
| Chú Tư (TN) | Không rành điện thoại, không muốn "phức tạp" | 🔴 HIGH | NV nhập SĐT giúp — zero friction |

**Optimization**:
- Staff incentive: 5K₫/signup bonus for first 30 days
- Script timing: offer signup when handing the bill (highest attention moment)
- Staff-assisted signup for older customers (NV gõ SĐT hộ)

### DROPOFF #3: Signup → First Repeat Visit (LOSS: ~100 people, 50%)

| Persona | Why They Don't Return | Severity | Fix |
|---------|----------------------|----------|-----|
| Minh (VP) | Không nhớ loyalty exists, không thấy reminder | 🟠 MED | Zalo OA message: "Anh Minh còn 45pts nữa là đổi được Espresso miễn phí!" |
| Lan (Freelancer) | WiFi chậm, ồn, hết ổ cắm | 🔴 HIGH | Invest in mesh WiFi, add power strips, quiet zone policy |
| Chú Tư (TN) | Cà phê không đúng vị, giá cao hơn quán quen | 🔴 HIGH | Consistent quality, loyalty discount makes price competitive |

**Optimization**:
- Day 3 post-signup: Zalo reminder with points balance
- Day 7: "Còn 7 ngày để dùng 50pts bonus"
- Critical facility: WiFi speed test monthly, power strip audit weekly

### DROPOFF #4: Active → Never Return (Churn, LOSS: ~40% of active)

| Persona | Why They Churn | Severity | Fix |
|---------|---------------|----------|-----|
| Minh (VP) | Đổi chỗ làm, chuyển nhà | 🟢 LOW | Natural churn, unavoidable |
| Lan (Freelancer) | Tìm được quán khác ngon/ rẻ hơn | 🟠 MED | Competitive monitoring + Vàng tier VIP perks |
| Chú Tư (TN) | NV quen nghỉ việc, không còn cảm giác thân thuộc | 🟠 MED | CRM ghi chú sở thích khách quen, NV mới được brief |

**Optimization**:
- 30-day inactive → Zalo win-back message: "Nhớ anh/chị! Tặng 30pts khi ghé lại"
- 60-day inactive → SMS: "Cà phê miễn phí chào đón anh/chị trở lại"
- Staff retention: loyalty program also for employees (staff points, bonuses)

### DROPOFF #5: Active → Referral (LOSS: ~85% never refer)

| Persona | Why They Don't Refer | Severity | Fix |
|---------|---------------------|----------|-----|
| All | Không biết có chương trình referral | 🟠 MED | Popup sau signup: "Mời bạn — nhận 100 điểm" |
| All | Ngại "bán hàng" cho bạn bè | 🟠 MED | Cung cấp script share sẵn, nút 1-click share Zalo |
| All | Không thấy đủ incentive (100pts = ~20K₫ value) | 🟡 LOW | Đủ với thị trường Sa Đéc, có thể tăng lên 150pts nếu cần |

**Optimization**:
- Post-signup modal: "Bạn vừa nhận 50pts! Mời thêm bạn → +100pts"
- Zalo 1-click share button (đã có trong loyalty.html)
- In-store: bảng "Khách giới thiệu nhiều nhất tháng" (gamification)

---

## Conversion Optimization Roadmap

### Quick Wins (Week 1, 0₫ cost)
| Action | Impact | Dropoff Targeted |
|--------|--------|-----------------|
| Staff signup script training | +20% signup rate | D2 |
| QR code visible on all tables | +10% self-serve signup | D2 |
| Staff-assisted signup for older customers | +30% signup in 45+ segment | D2 |
| A-frame sign "WiFi FREE + Ổ Cắm" | +5% walk-in rate | D1 |
| Zalo auto-message after signup (day 3) | +15% return rate | D3 |

### Medium Investment (Week 2-4, ~500K₫)
| Action | Impact | Dropoff Targeted |
|--------|--------|-----------------|
| Staff signup bonus (5K₫/signup × 200) | +40% signup rate | D2 |
| WiFi mesh upgrade (if needed) | -50% freelancer churn | D3 |
| Power strips under every table | -30% freelancer churn | D3 |
| Printed referral cards (give with receipt) | +20% referral rate | D5 |

### Long-Term (Month 2+)
| Action | Impact | Dropoff Targeted |
|--------|--------|-----------------|
| Win-back campaign (30-day inactive) | +15% reactivation | D4 |
| Monthly customer event (tasting, workshop) | +10% retention | D3/D4 |
| Employee loyalty program | +Staff retention → -Customer churn | D4 |
| Competitive monitoring dashboard | Early warning of churn risk | D4 |

---

## Priority Matrix

```
                    High Impact
                        │
          ┌─────────────┼─────────────┐
          │  D2-Script  │  D3-WiFi    │
          │  D2-Staff   │  D3-Power   │
          │    help     │  D4-Winback │
          │             │             │
Low Cost ─┼─────────────┼─────────────┤ High Cost
          │             │             │
          │  D1-Sign    │  D5-Referral│
          │  D2-QR      │    cards    │
          │             │             │
          └─────────────┼─────────────┘
                        │
                    Low Impact

  🔥 DO NOW: D2-Staff script + D2-Staff help (top-left, max ROI)
  📋 PLAN: D3-WiFi/Power (if needed based on customer feedback)
  📊 MEASURE: D5-Referral (already built, track adoption before investing more)
```
