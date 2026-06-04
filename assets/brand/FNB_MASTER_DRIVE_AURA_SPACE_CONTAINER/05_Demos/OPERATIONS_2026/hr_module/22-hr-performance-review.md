# 📋 TASK 22 — Performance Review Quarterly

> **Branch:** `feat/hr-performance-review`
> **Estimated:** 5-6h worker
> **Dependency:** Tasks 19, 20, 21 merged

---

## 🎯 Objective

Đánh giá NV định kỳ **theo quý** (anh Còn quyết) + auto-calc 2 KPI từ data:
- `score_punctuality` từ `staff_attendance` (late_minutes)
- `score_uniform` từ `uniform_check_log` (violations)
- 3 KPI còn lại (quality/attitude/teamwork): owner rate manual 1-5⭐

**Scoring weights:**
- Punctuality: **20%**
- Uniform: **10%**
- Quality: **30%**
- Attitude: **20%**
- Teamwork: **20%**

**Bonus/discipline matrix:**

| Score total | Action |
|---|---|
| 4.5 - 5.0 | Thưởng 500k-1tr + raise 5-10% |
| 4.0 - 4.4 | Thưởng 200-500k |
| 3.5 - 3.9 | Ghi nhận, không bonus |
| 3.0 - 3.4 | Warning verbal |
| 2.5 - 2.9 | Warning written |
| < 2.5 | Final warning / consider termination |

---

## 📋 Acceptance Criteria

- [ ] 4 endpoints test pass
- [ ] Auto-calc punctuality + uniform từ data thật
- [ ] Sign workflow 2 bên (reviewer + staff)
- [ ] Quarterly periods: Q1 (Jan-Mar), Q2 (Apr-Jun), Q3 (Jul-Sep), Q4 (Oct-Dec)
- [ ] PR mở: "feat(hr): performance review quarterly"

---

## 🔌 Endpoints

### 1. `POST /api/hr/review/generate`
**Auth:** Owner JWT
**Body:** `{ "period_label": "Q3-2026" }` (hoặc auto detect quarter hiện tại)

**Logic:**
```js
async function generateQuarterlyReviews(env, periodLabel) {
  // Parse period: "Q3-2026" → start=2026-07-01, end=2026-09-30
  const m = periodLabel.match(/^Q(\d)-(\d{4})$/);
  if (!m) throw new Error('Invalid period_label');
  const [, q, year] = m;
  const startMonth = (parseInt(q) - 1) * 3 + 1;
  const periodStart = `${year}-${String(startMonth).padStart(2,'0')}-01`;
  const periodEndMonth = startMonth + 2;
  const lastDay = new Date(year, periodEndMonth, 0).getDate(); // last day of end month
  const periodEnd = `${year}-${String(periodEndMonth).padStart(2,'0')}-${lastDay}`;

  // Get all active staff
  const { results: staffList } = await env.AURA_DB.prepare(
    'SELECT id, full_name FROM staff_profiles WHERE is_active = 1'
  ).all();

  const created = [];

  for (const staff of staffList) {
    // Aggregate attendance data
    const att = await env.AURA_DB.prepare(`
      SELECT
        COALESCE(SUM(hours_worked), 0) AS total_hours,
        COUNT(DISTINCT shift_date) AS total_days,
        COALESCE(SUM(late_minutes), 0) AS total_late
      FROM staff_attendance
      WHERE staff_id = ? AND shift_date BETWEEN ? AND ?
        AND check_out_at IS NOT NULL
    `).bind(staff.id, periodStart, periodEnd).first();

    // Aggregate uniform violations
    const uniform = await env.AURA_DB.prepare(`
      SELECT
        COUNT(*) AS total_checks,
        SUM(CASE WHEN status='minor_violation' THEN 1 ELSE 0 END) AS minor,
        SUM(CASE WHEN status='major_violation' THEN 2 ELSE 0 END) AS major_weighted
      FROM uniform_check_log
      WHERE staff_id = ? AND check_date BETWEEN ? AND ?
    `).bind(staff.id, periodStart, periodEnd).first();

    // Auto-calc scores
    const avgLatePerDay = att.total_days > 0 ? att.total_late / att.total_days : 0;
    const scorePunctuality = Math.max(1, Math.min(5, 5 - avgLatePerDay / 5));
    // 0 trễ → 5⭐; 10 phút avg → 3⭐; 25+ phút → 1⭐

    const totalViolations = (uniform.minor || 0) + (uniform.major_weighted || 0);
    const scoreUniform = Math.max(1, Math.min(5, 5 - totalViolations / 4));
    // 0 vi phạm → 5⭐; 4 → 4⭐; 16+ → 1⭐

    const reviewId = `REV_${periodLabel.replace('-', '_')}_${staff.id}`;

    // INSERT OR IGNORE (idempotent — re-run sẽ skip existing)
    await env.AURA_DB.prepare(`
      INSERT OR IGNORE INTO performance_review
        (id, staff_id, period_type, period_label, period_start, period_end,
         score_punctuality, score_uniform,
         total_hours_worked, total_days_attended, total_late_minutes,
         total_uniform_violations, reviewer_id, status)
      VALUES (?, ?, 'quarterly', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')
    `).bind(
      reviewId, staff.id, periodLabel, periodStart, periodEnd,
      Math.round(scorePunctuality * 10) / 10,
      Math.round(scoreUniform * 10) / 10,
      att.total_hours, att.total_days, att.total_late,
      totalViolations,
      env.ownerStaffId || 'STAFF_OWNER', // owner staff_id
    ).run();

    created.push({ staff_id: staff.id, review_id: reviewId,
                   score_punctuality: scorePunctuality, score_uniform: scoreUniform });
  }

  return { success: true, period: periodLabel, count: created.length, reviews: created };
}
```

### 2. `PUT /api/hr/review/:review_id`
**Auth:** Owner JWT — update manual fields:

```json
{
  "score_quality": 4.5,
  "score_attitude": 4.0,
  "score_teamwork": 4.2,
  "strengths": "Pha cf đều tay, train Ngọc tốt",
  "improvements": "Cần giao tiếp với khách kỹ hơn",
  "goals_next": "Học latte art cơ bản trong Q4",
  "bonus_vnd": 500000,
  "raise_pct": 0,
  "warning_level": null
}
```

**Auto-calc `score_total`:**
```js
const total = (p * 0.20) + (u * 0.10) + (q * 0.30) + (a * 0.20) + (t * 0.20);
```

### 3. `POST /api/hr/review/:review_id/sign`
**Body:** `{ "signer_type": "reviewer" | "staff" }`

- `reviewer` → set `reviewer_signed_at = now()`, status='reviewed'
- `staff` → set `staff_signed_at = now()`, status='signed'

### 4. `GET /api/hr/review/staff/:staff_id/history`
List tất cả reviews đã có cho 1 staff (cho HR file).

---

## 🎯 Auto-calc formula

### Punctuality score

```
avgLatePerDay = total_late_minutes / total_days_attended

  0 phút avg/ngày  → 5.0 ⭐
  5 phút avg/ngày  → 4.0 ⭐
  10 phút avg/ngày → 3.0 ⭐
  20 phút avg/ngày → 1.0 ⭐
  25+ phút avg     → 1.0 ⭐ (floor)
```

### Uniform score

```
totalViolations = minor_count + (major_count × 2)  -- major nặng gấp đôi

  0 violations  → 5.0 ⭐
  4 violations  → 4.0 ⭐
  8 violations  → 3.0 ⭐
  16+ violations → 1.0 ⭐
```

### Score total (weighted)

```
score_total =
    score_punctuality × 0.20
  + score_uniform × 0.10
  + score_quality × 0.30
  + score_attitude × 0.20
  + score_teamwork × 0.20
```

---

## 🧪 Test cases

```js
// T1: Generate Q3-2026 → 4 staff đều có draft review
// T2: Idempotent: generate lần 2 → INSERT OR IGNORE skip, total still 4
// T3: Cường có 0 trễ, 0 violations → punctuality=5, uniform=5
// T4: Khánh có 60 phút late / 30 ngày → avgLate=2 → punctuality=4.6
// T5: Owner PUT score_quality=4.5 → score_total auto-update
// T6: Sign reviewer → status='reviewed'; Sign staff → 'signed'
```

---

## ⏭ Note quan trọng

- Worker phải lookup `env.ownerStaffId` từ secret hoặc query `staff_profiles WHERE role='owner' LIMIT 1`
- Review của owner Còn → reviewer = self (anh tự đánh giá hoặc skip)
- Period label format strict: `Q[1-4]-YYYY` cho quarterly, `M[01-12]-YYYY` cho monthly (future)
