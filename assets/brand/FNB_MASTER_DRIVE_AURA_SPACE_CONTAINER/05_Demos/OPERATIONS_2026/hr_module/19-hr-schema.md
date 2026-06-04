# 📋 TASK 19 — HR Schema v1

> **Repo:** `huuthongdongthap/FnB-Container-Caffe`
> **Branch:** `feat/hr-schema-v1`
> **Migration file:** `db/migrations/20260603_01_hr_schema_v1.sql`
> **Estimated:** 3-4h worker autonomous
> **Dependency:** Standalone (chạy đầu tiên trong HR module)

---

## 🎯 Objective

Thiết lập schema D1 cho HR module:
1. `staff_profiles` — master data 4 NV + future hires
2. `staff_attendance` — chấm công check-in/out
3. `uniform_check_log` — vi phạm đồng phục
4. `performance_review` — đánh giá định kỳ quarterly
5. 2 views helper cho payroll + violation count

**Decisions từ anh Còn:**
- Pay method: **Monthly fixed** (KHÔNG hourly)
- Review frequency: **Quarterly**
- Biometric: Không có device → seed `biometric_id=NULL`, dùng QR mobile (Task 20)

---

## 📋 Acceptance Criteria

- [ ] Migration apply ok `--local` + `--remote`
- [ ] 4 staff seeded với monthly_salary đúng:
  - Cường: 7.500.000đ (barista lead)
  - Thư: 7.000.000đ (barista)
  - Khánh: 6.500.000đ (cashier)
  - Ngọc: 5.000.000đ (probation)
- [ ] 4 tables + 2 views verified bằng sqlite_master query
- [ ] PR mở: "feat(hr): schema v1 — staff/attendance/uniform/review"

---

## 🗄 Migration SQL — Full

### File `db/migrations/20260603_01_hr_schema_v1.sql`

```sql
-- Migration: HR Module v1 — Schema + 4 staff seed
-- Date: 2026-06-03
-- Anh Còn quyết: monthly salary, quarterly review, no biometric (QR mobile)
--
-- Idempotent: CREATE IF NOT EXISTS + INSERT OR IGNORE

-- ════════════════════════════════════════════════════════════════
-- 1. staff_profiles — master data
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS staff_profiles (
  id                  TEXT PRIMARY KEY,
  email               TEXT UNIQUE NOT NULL,
  full_name           TEXT NOT NULL,
  phone               TEXT,
  role                TEXT NOT NULL DEFAULT 'staff' CHECK(role IN ('owner','staff','volunteer','manager')),
  department          TEXT CHECK(department IN ('barista','cashier','cleaning','manager','mixed')),
  hire_date           TEXT NOT NULL,
  monthly_salary_vnd  INTEGER DEFAULT 0,
  pay_method          TEXT DEFAULT 'monthly' CHECK(pay_method IN ('monthly','hourly')),
  hourly_rate_vnd     INTEGER DEFAULT 0,
  biometric_id        TEXT,
  emergency_contact   TEXT,
  notes               TEXT,
  is_active           INTEGER DEFAULT 1,
  probation_end_date  TEXT,
  created_at          TEXT DEFAULT (datetime('now')),
  updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_staff_role_active ON staff_profiles(role, is_active);
CREATE INDEX IF NOT EXISTS idx_staff_department ON staff_profiles(department);

-- Seed 4 staff hiện tại
INSERT OR IGNORE INTO staff_profiles
  (id, email, full_name, phone, role, department, hire_date, monthly_salary_vnd, pay_method, probation_end_date)
VALUES
  ('STAFF_CUONG', 'cuong@auraspace.vn', 'Cường R', NULL, 'staff', 'barista', '2026-04-01', 7500000, 'monthly', NULL),
  ('STAFF_THU',   'thu@auraspace.vn',   'Thư PC',  NULL, 'staff', 'barista', '2026-04-01', 7000000, 'monthly', NULL),
  ('STAFF_KHANH', 'khanh@auraspace.vn', 'Khánh PC', NULL, 'staff', 'cashier', '2026-04-01', 6500000, 'monthly', NULL),
  ('STAFF_NGOC',  'ngoc@auraspace.vn',  'Ngọc',    NULL, 'staff', 'mixed', '2026-05-25', 5000000, 'monthly', '2026-07-25');

-- ════════════════════════════════════════════════════════════════
-- 2. staff_attendance — chấm công
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS staff_attendance (
  id              TEXT PRIMARY KEY,
  staff_id        TEXT NOT NULL REFERENCES staff_profiles(id),
  shift_date      TEXT NOT NULL,
  shift_type      TEXT NOT NULL CHECK(shift_type IN ('morning','afternoon','evening','full_day','custom')),
  check_in_at     TEXT NOT NULL,
  check_out_at    TEXT,
  expected_in     TEXT,
  expected_out    TEXT,
  hours_worked    REAL,
  late_minutes    INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  source          TEXT NOT NULL CHECK(source IN ('qr_mobile','biometric','manual','admin_override')),
  device_id       TEXT,
  approver_id     TEXT,
  notes           TEXT,
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique
  ON staff_attendance(staff_id, shift_date, shift_type);

CREATE INDEX IF NOT EXISTS idx_attendance_staff_date
  ON staff_attendance(staff_id, shift_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_date
  ON staff_attendance(shift_date);
CREATE INDEX IF NOT EXISTS idx_attendance_open_shifts
  ON staff_attendance(staff_id) WHERE check_out_at IS NULL;

-- ════════════════════════════════════════════════════════════════
-- 3. uniform_check_log — vi phạm đồng phục
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS uniform_check_log (
  id              TEXT PRIMARY KEY,
  staff_id        TEXT NOT NULL REFERENCES staff_profiles(id),
  check_date      TEXT NOT NULL,
  shift_type      TEXT NOT NULL,
  status          TEXT NOT NULL CHECK(status IN ('ok','minor_violation','major_violation')),
  shirt_ok        INTEGER DEFAULT 1,
  apron_ok        INTEGER DEFAULT 1,
  hair_ok         INTEGER DEFAULT 1,
  shoes_ok        INTEGER DEFAULT 1,
  hygiene_ok      INTEGER DEFAULT 1,
  violation_note  TEXT,
  photo_url       TEXT,
  checker_id      TEXT NOT NULL REFERENCES staff_profiles(id),
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_uniform_staff_date
  ON uniform_check_log(staff_id, check_date DESC);
CREATE INDEX IF NOT EXISTS idx_uniform_status
  ON uniform_check_log(status, check_date DESC);

-- ════════════════════════════════════════════════════════════════
-- 4. performance_review — đánh giá quarterly
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS performance_review (
  id                    TEXT PRIMARY KEY,
  staff_id              TEXT NOT NULL REFERENCES staff_profiles(id),
  period_type           TEXT NOT NULL DEFAULT 'quarterly' CHECK(period_type IN ('monthly','quarterly','yearly','probation')),
  period_label          TEXT NOT NULL,  -- 'Q3-2026', 'M07-2026', 'Probation-Ngoc'
  period_start          TEXT NOT NULL,
  period_end            TEXT NOT NULL,

  -- 5 KPI (1-5 sao)
  score_punctuality     REAL,
  score_uniform         REAL,
  score_quality         REAL,
  score_attitude        REAL,
  score_teamwork        REAL,
  score_total           REAL,

  -- Auto-calc from attendance + uniform_check
  total_hours_worked    REAL,
  total_days_attended   INTEGER,
  total_late_minutes    INTEGER,
  total_uniform_violations INTEGER,

  -- Manual feedback
  strengths             TEXT,
  improvements          TEXT,
  goals_next            TEXT,

  -- Sign workflow
  reviewer_id           TEXT NOT NULL REFERENCES staff_profiles(id),
  reviewer_signed_at    TEXT,
  staff_signed_at       TEXT,

  -- Reward/discipline
  bonus_vnd             INTEGER DEFAULT 0,
  raise_pct             REAL DEFAULT 0,
  warning_level         TEXT CHECK(warning_level IN ('verbal','written','final') OR warning_level IS NULL),
  status                TEXT DEFAULT 'draft' CHECK(status IN ('draft','reviewed','signed','archived')),

  created_at            TEXT DEFAULT (datetime('now')),
  updated_at            TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_unique
  ON performance_review(staff_id, period_label);
CREATE INDEX IF NOT EXISTS idx_review_status
  ON performance_review(status, period_end);

-- ════════════════════════════════════════════════════════════════
-- 5. Views helper
-- ════════════════════════════════════════════════════════════════

-- Monthly attendance summary
CREATE VIEW IF NOT EXISTS v_staff_monthly_summary AS
SELECT
  sp.id AS staff_id,
  sp.full_name,
  sp.department,
  sp.monthly_salary_vnd,
  strftime('%Y-%m', sa.shift_date) AS month_period,
  COUNT(DISTINCT sa.shift_date) AS days_worked,
  COALESCE(SUM(sa.hours_worked), 0) AS total_hours,
  COALESCE(SUM(sa.late_minutes), 0) AS total_late_mins,
  COALESCE(SUM(sa.overtime_minutes), 0) AS total_overtime_mins
FROM staff_profiles sp
LEFT JOIN staff_attendance sa
  ON sa.staff_id = sp.id AND sa.check_out_at IS NOT NULL
WHERE sp.is_active = 1
GROUP BY sp.id, strftime('%Y-%m', sa.shift_date);

-- Uniform violations summary
CREATE VIEW IF NOT EXISTS v_uniform_violations AS
SELECT
  staff_id,
  strftime('%Y-%m', check_date) AS month_period,
  COUNT(*) AS total_checks,
  SUM(CASE WHEN status = 'ok' THEN 1 ELSE 0 END) AS ok_count,
  SUM(CASE WHEN status = 'minor_violation' THEN 1 ELSE 0 END) AS minor_count,
  SUM(CASE WHEN status = 'major_violation' THEN 1 ELSE 0 END) AS major_count
FROM uniform_check_log
GROUP BY staff_id, strftime('%Y-%m', check_date);

-- ════════════════════════════════════════════════════════════════
-- 6. Verify
-- ════════════════════════════════════════════════════════════════
SELECT '=== HR schema v1 ===' AS info;
SELECT id, full_name, department, monthly_salary_vnd FROM staff_profiles ORDER BY monthly_salary_vnd DESC;

SELECT '--- 4 tables created ---' AS info;
SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'staff%' OR name = 'uniform_check_log' OR name = 'performance_review' ORDER BY name;

SELECT '--- 2 views created ---' AS info;
SELECT name FROM sqlite_master WHERE type='view' AND name LIKE 'v_%';

SELECT '=== Migration HR v1 complete ===' AS info;
```

---

## 🔌 Optional API endpoints (Task 19 chỉ schema, endpoints ở Task 20-23)

Worker chỉ cần:
- ✅ Apply migration `--local` test
- ✅ Apply migration `--remote` production
- ✅ Verify 4 staff seeded + 2 views work
- ✅ Mở PR với title "feat(hr): schema v1"

---

## ⚠️ Note quan trọng cho worker

1. **KHÔNG xoá** column `hourly_rate_vnd` — giữ để future flexibility
2. **Probation:** Ngọc có `probation_end_date='2026-07-25'` (2 tháng từ hire_date 25/5)
3. **Pay method default 'monthly'** nhưng schema vẫn support 'hourly' cho future
4. **Anh Còn sẽ update lương** qua admin UI sau khi Task 23 deploy — KHÔNG hardcode trong migration
