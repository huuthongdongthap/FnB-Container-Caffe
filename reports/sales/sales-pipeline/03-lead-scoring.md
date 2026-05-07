# 03 · Lead Scoring Model

**Pipeline**: AURA SPACE Promotion → Loyalty  
**Model Type**: Predictive (Behavior + Demographic + RFM)  
**Score Range**: 0-100  
**Refresh**: Real-time (mỗi lần có event mới: order, signup, referral, review)

---

## A. Scoring Dimensions

### Dimension 1: RECENCY (Max 30 điểm)

| Days since last visit | Score |
|----------------------|-------|
| 0-3 ngày | 30 |
| 4-7 ngày | 25 |
| 8-14 ngày | 15 |
| 15-30 ngày | 5 |
| >30 ngày | 0 |
| Chưa từng ghé | 0 |

### Dimension 2: FREQUENCY (Max 25 điểm)

| Total visits (all time) | Score |
|------------------------|-------|
| 10+ | 25 |
| 5-9 | 20 |
| 3-4 | 15 |
| 2 | 10 |
| 1 | 5 |
| 0 | 0 |

### Dimension 3: MONETARY — Ticket Size (Max 20 điểm)

| Average ticket | Score |
|---------------|-------|
| ≥100,000₫ | 20 |
| 70-99,000₫ | 15 |
| 50-69,000₫ | 10 |
| 30-49,000₫ | 5 |
| <30,000₫ | 2 |
| Chưa có order | 0 |

### Dimension 4: ENGAGEMENT (Max 25 điểm)

| Action | Score | One-time? |
|--------|-------|------------|
| Đã đăng ký loyalty | +10 | Một lần |
| Đã dùng promo code | +5 | Một lần |
| Đã viết Google review 5★ | +10 | Một lần |
| Đã share Facebook/TikTok tag AURA | +5 | Mỗi lần (max +10) |
| Đã giới thiệu bạn (referral) | +10 | Mỗi referral (max +20) |
| Đã tham gia event | +5 | Mỗi event (max +10) |
| Follow Facebook page | +3 | Một lần |
| Subscribe email | +2 | Một lần |

---

## B. Score Calculation Table

### Example Leads

| Lead | Recency | Frequency | Monetary | Engagement | TOTAL | Grade |
|------|---------|-----------|----------|------------|-------|-------|
| **Chị Hương** (VIP Platinum, ghé 3 lần/tuần, avg ticket 80K, 2 referral, 1 review) | 30 (hôm qua) | 25 (12 visits) | 15 | 28 (10+5+10+3) | **98** | A+ 🏆 |
| **Minh** (Gen Z, ghé 2 lần, dùng TIKTOK15, đã share TikTok) | 25 (5 ngày trước) | 10 (2 visits) | 10 (55K avg) | 13 (5+5+3) | **58** | B |
| **Tuấn** (mới ghé lần đầu, dùng FIRSTORDER, chưa đăng ký loyalty) | 30 (hôm nay) | 5 (1 visit) | 5 (45K) | 5 (code) | **45** | C+ |
| **Cô Lan** (du lịch, ghé 1 lần, viết review Google) | 15 (10 ngày trước) | 5 (1 visit) | 10 (65K) | 10 (review) | **40** | C |
| **Lead Facebook** (click ad, xem web, chưa ghé) | 0 | 0 | 0 | 3 (follow FB) | **3** | E |

---

## C. Lead Grades & Actions

| Grade | Score Range | Label | % Leads Target | Action |
|-------|-------------|-------|----------------|--------|
| **A+** | 90-100 | Champion | 5% | Ambassador program, surprise gifts, VIP invite |
| **A** | 75-89 | VIP | 10% | Tier upgrade push, exclusive perks |
| **B** | 55-74 | Loyal | 20% | Nurture: điểm sắp lên tier, birthday bonus |
| **C+** | 40-54 | Potential | 25% | Retarget: code giảm giá, loyalty explainer |
| **C** | 20-39 | New/Casual | 25% | Welcome flow, FIRSTORDER, review incentive |
| **D** | 5-19 | Cold | 10% | Retarget ad, email 1 lần/tuần |
| **E** | 0-4 | Unknown | 5% | Top-of-funnel content, không push |

---

## D. Scoring Triggers — Khi nào tính lại điểm?

### Real-time Triggers (score cập nhật ngay)

| Event | Dimension affected | Score change |
|-------|-------------------|-------------|
| New order placed | Recency → 30, Frequency +1 tier, Monetary recalc | +5~30 |
| Loyalty signup | Engagement +10 | +10 |
| Promo code used | Engagement +5 | +5 |
| Google review posted | Engagement +10 | +10 |
| Referral successful | Engagement +10 | +10 |
| Social share | Engagement +5 | +5 |

### Scheduled Triggers (cron job — hàng ngày)

| Event | Dimension affected | Score change |
|-------|-------------------|-------------|
| Recency decay | Recency drops 1 tier sau 3/7/14/30 ngày | -5~15 |
| Points near expiry (≤30 ngày) | Flag only (không đổi score) | — |
| Birthday this month | Flag: "birthday_month = true" | — |

---

## E. D1 Implementation — Scoring Table

```sql
-- Lead scores (materialized view — recomputed on trigger)
CREATE TABLE IF NOT EXISTS lead_scores (
    customer_id TEXT PRIMARY KEY,
    recency_score INTEGER DEFAULT 0,
    frequency_score INTEGER DEFAULT 0,
    monetary_score INTEGER DEFAULT 0,
    engagement_score INTEGER DEFAULT 0,
    total_score INTEGER DEFAULT 0,
    grade TEXT DEFAULT 'E',
    last_updated TEXT DEFAULT (datetime('now'))
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS idx_lead_scores_grade ON lead_scores(grade);
CREATE INDEX IF NOT EXISTS idx_lead_scores_total ON lead_scores(total_score DESC);
```

### Scoring Function (Pseudo-code — Worker)

```javascript
function calculateScore(customer) {
  const daysSinceLastVisit = daysBetween(customer.lastOrderDate, now());
  
  // Recency
  let recency = 0;
  if (daysSinceLastVisit <= 3) recency = 30;
  else if (daysSinceLastVisit <= 7) recency = 25;
  else if (daysSinceLastVisit <= 14) recency = 15;
  else if (daysSinceLastVisit <= 30) recency = 5;
  
  // Frequency
  const visits = customer.totalOrders;
  let freq = 0;
  if (visits >= 10) freq = 25;
  else if (visits >= 5) freq = 20;
  else if (visits >= 3) freq = 15;
  else if (visits >= 2) freq = 10;
  else if (visits >= 1) freq = 5;
  
  // Monetary
  const avg = customer.totalSpent / Math.max(visits, 1);
  let monetary = 0;
  if (avg >= 100000) monetary = 20;
  else if (avg >= 70000) monetary = 15;
  else if (avg >= 50000) monetary = 10;
  else if (avg >= 30000) monetary = 5;
  else monetary = 2;
  
  // Engagement
  let engagement = 0;
  if (customer.loyaltyTier) engagement += 10;
  if (customer.promoUsed) engagement += 5;
  if (customer.reviewCount > 0) engagement += 10;
  if (customer.shareCount > 0) engagement += Math.min(customer.shareCount * 5, 10);
  if (customer.referralCount > 0) engagement += Math.min(customer.referralCount * 10, 20);
  if (customer.eventAttended > 0) engagement += Math.min(customer.eventAttended * 5, 10);
  if (customer.followsFB) engagement += 3;
  if (customer.subscribed) engagement += 2;
  
  const total = recency + freq + monetary + engagement;
  
  // Grade
  let grade = 'E';
  if (total >= 90) grade = 'A+';
  else if (total >= 75) grade = 'A';
  else if (total >= 55) grade = 'B';
  else if (total >= 40) grade = 'C+';
  else if (total >= 20) grade = 'C';
  else if (total >= 5) grade = 'D';
  
  return { recency, freq, monetary, engagement, total, grade };
}
```

---

## F. Pipeline Automation Map

| Score Range | Auto-action |
|-------------|-------------|
| **A+ (90-100)** | Tag "Champion" — invite VIP event, gửi quà bất ngờ, ask for testimonial |
| **A (75-89)** | Tag "VIP" — free upsize tuần này, ưu tiên đặt bàn |
| **B (55-74)** | Tag "Loyal" — email "Sắp lên hạng!" nếu thiếu ≤20% points |
| **C+ (40-54)** | Tag "Potential" — retarget THANKYOU15, loyalty explainer |
| **C (20-39)** | Tag "New" — welcome sequence, FIRSTORDER code, review ask |
| **D (5-19)** | Tag "Cold" — retarget ad, email 1 lần/tuần |
| **E (0-4)** | Tag "Unknown" — top-of-funnel content, không push |

---

## G. Scoring Dashboard — KPIs

| Metric | Target 30d |
|--------|------------|
| % leads graded A or higher | ≥15% |
| % leads graded C or lower → upgraded | ≥20% |
| Avg score to repeat (threshold) | ≥40 |
| Avg score to tier upgrade | ≥60 |
| Avg score to referral | ≥75 |
| Avg score improvement per visit | +8~15 |
