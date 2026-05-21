# 🗄 TASK 08 — Loyalty Schema v2 Migration

> **Target repo:** `huuthongdongthap/FnB-Container-Caffe`
> **Branch:** `feat/loyalty-schema-v2-launch`
> **Estimated:** 2h worker autonomous
> **Priority:** P0 (blocker cho Task 09)

---

## 🎯 Goals

1. Migrate tier system từ 3 tier (silver/gold/platinum, rate 2/5/8%) → **4 tier Bronze/Silver/Gold/Platinum, rate 3/5/7/10%**
2. Add column `expires_at` cho cashback_transactions (expiry 90/120/180/null days theo tier)
3. Create `bonus_campaigns` table cho Grand Opening 6/6 + future campaigns
4. Create `signup_bonus_log` cho tracking ai đã nhận seed bonus
5. Fix data quality: UNIQUE phone, indexes

---

## 📋 Implementation

### Step 1: Setup branch
```bash
cd /Users/mac/mekong-cli/FnB-Container-Caffe
cat CLAUDE.md  # behavior protocol
git checkout main && git pull origin main
git checkout -b feat/loyalty-schema-v2-launch
```

### Step 2: Create migration file
**File:** `db/migrations/20260518_03_loyalty_v2_launch.sql`

```sql
-- ════════════════════════════════════════════════════════════
-- AURA CAFE — Loyalty v2 Launch Migration
-- Migrate 3-tier → 4-tier với rate đúng spec
-- Add bonus_campaigns + signup_bonus_log + expires_at
-- ════════════════════════════════════════════════════════════

PRAGMA foreign_keys = OFF;

-- ─── 1. RESET loyalty_tiers với 4 tier mới ───
DELETE FROM loyalty_tiers;

INSERT INTO loyalty_tiers (id, name, display_name_vi, min_spent_vnd, max_spent_vnd, cashback_rate, expiry_days, sort_order) VALUES
  (1, 'bronze',   'Đồng',     0,        500000,  0.03, 90,  1),
  (2, 'silver',   'Bạc',      500000,   2000000, 0.05, 120, 2),
  (3, 'gold',     'Vàng',     2000000,  5000000, 0.07, 180, 3),
  (4, 'platinum', 'Bạch Kim', 5000000,  NULL,    0.10, NULL, 4);

-- ─── 2. ALTER loyalty_tiers cần thêm cột nếu chưa có ───
-- (Nếu schema cũ chưa có các cột này, ALTER TABLE)
-- ALTER TABLE loyalty_tiers ADD COLUMN display_name_vi TEXT;
-- ALTER TABLE loyalty_tiers ADD COLUMN min_spent_vnd INTEGER;
-- ALTER TABLE loyalty_tiers ADD COLUMN max_spent_vnd INTEGER;
-- ALTER TABLE loyalty_tiers ADD COLUMN expiry_days INTEGER;
-- ALTER TABLE loyalty_tiers ADD COLUMN sort_order INTEGER;
-- (Worker check schema hiện tại, ALTER nếu thiếu)

-- ─── 3. Update existing customers tier default ───
-- Nếu customer chưa có tier hoặc tier name cũ → set Bronze
UPDATE customers
SET loyalty_tier = 'bronze'
WHERE loyalty_tier IS NULL
   OR loyalty_tier NOT IN ('bronze', 'silver', 'gold', 'platinum');

-- ─── 4. Add UNIQUE constraint cho phone ───
-- Tránh duplicate signup
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique ON customers(phone) WHERE phone IS NOT NULL;

-- ─── 5. Add expires_at cho cashback_transactions ───
ALTER TABLE cashback_transactions ADD COLUMN expires_at TEXT;

-- Update existing earn transactions với expires_at theo tier customer hiện tại
UPDATE cashback_transactions
SET expires_at = (
  SELECT
    CASE c.loyalty_tier
      WHEN 'bronze' THEN datetime(cashback_transactions.created_at, '+90 days')
      WHEN 'silver' THEN datetime(cashback_transactions.created_at, '+120 days')
      WHEN 'gold' THEN datetime(cashback_transactions.created_at, '+180 days')
      WHEN 'platinum' THEN NULL
      ELSE datetime(cashback_transactions.created_at, '+90 days')
    END
  FROM customers c WHERE c.id = cashback_transactions.customer_id
)
WHERE type = 'earn' AND expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_cashback_expires ON cashback_transactions(expires_at, type)
  WHERE type = 'earn' AND expires_at IS NOT NULL;

-- ─── 6. Idempotency: UNIQUE (order_id, type='earn') ───
-- Tránh double-credit cùng order
CREATE UNIQUE INDEX IF NOT EXISTS idx_cashback_order_earn_unique
  ON cashback_transactions(order_id, type)
  WHERE type = 'earn' AND order_id IS NOT NULL;

-- ─── 7. Create bonus_campaigns table ───
CREATE TABLE IF NOT EXISTS bonus_campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  cashback_multiplier REAL DEFAULT 1.0,
  signup_bonus_vnd INTEGER DEFAULT 0,
  signup_bonus_cap INTEGER,
  refer_bonus_vnd INTEGER DEFAULT 20000,
  max_cap_per_customer_vnd INTEGER DEFAULT 50000,
  auto_upgrade_tier TEXT,
  auto_upgrade_min_spend INTEGER,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_campaigns_active_dates ON bonus_campaigns(active, start_date, end_date);

-- ─── 8. Seed Grand Opening campaign ───
INSERT INTO bonus_campaigns (code, name, description, start_date, end_date, cashback_multiplier, signup_bonus_vnd, signup_bonus_cap, refer_bonus_vnd, max_cap_per_customer_vnd, auto_upgrade_tier, auto_upgrade_min_spend, active)
VALUES (
  'GRAND_OPENING_6_6_2026',
  'Khai trương AURA CAFE 6/6',
  'Cashback x2 + Signup +50k cho 100 người đầu + Refer +50k + Auto-upgrade Silver khi spend ≥200k ngày 6/6',
  '2026-06-06',
  '2026-06-08 23:59:59',
  2.0,
  50000,
  100,
  50000,
  100000,
  'silver',
  200000,
  1
);

-- ─── 9. Create signup_bonus_log table ───
CREATE TABLE IF NOT EXISTS signup_bonus_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  campaign_id INTEGER NOT NULL,
  bonus_vnd INTEGER NOT NULL,
  granted_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (campaign_id) REFERENCES bonus_campaigns(id),
  UNIQUE(customer_id, campaign_id)
);

CREATE INDEX IF NOT EXISTS idx_signup_bonus_campaign ON signup_bonus_log(campaign_id, granted_at);

-- ─── 10. Loyalty audit log (anti-fraud) ───
CREATE TABLE IF NOT EXISTS loyalty_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER,
  staff_id INTEGER,
  action TEXT NOT NULL,
  amount_vnd INTEGER,
  order_id INTEGER,
  metadata TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_customer_date ON loyalty_audit_log(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_action_date ON loyalty_audit_log(action, created_at);

PRAGMA foreign_keys = ON;
```

### Step 3: Run migration on D1
```bash
# Local dev test trước
cd worker
npx wrangler d1 execute fnb_caffe_db --local --file=../db/migrations/20260518_03_loyalty_v2_launch.sql

# Verify schema
npx wrangler d1 execute fnb_caffe_db --local --command="SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%campaign%' OR name LIKE '%bonus%' OR name LIKE '%audit%';"

# Verify tier seeded
npx wrangler d1 execute fnb_caffe_db --local --command="SELECT * FROM loyalty_tiers ORDER BY sort_order;"

# Verify campaign
npx wrangler d1 execute fnb_caffe_db --local --command="SELECT * FROM bonus_campaigns WHERE active=1;"

# Nếu OK, chạy production
npx wrangler d1 execute fnb_caffe_db --remote --file=../db/migrations/20260518_03_loyalty_v2_launch.sql
```

### Step 4: Verify với staff_id column existing
```bash
# Check existing schema cashback_transactions
npx wrangler d1 execute fnb_caffe_db --remote --command="PRAGMA table_info(cashback_transactions);"

# Check customers schema
npx wrangler d1 execute fnb_caffe_db --remote --command="PRAGMA table_info(customers);"
```

Nếu `staff_id` chưa có trong `cashback_transactions`, thêm ALTER:
```sql
ALTER TABLE cashback_transactions ADD COLUMN staff_id INTEGER;
ALTER TABLE cashback_transactions ADD COLUMN ip_address TEXT;
```

### Step 5: Test idempotency UNIQUE constraint
```bash
# Mock: try insert 2 cashback earn for same order
npx wrangler d1 execute fnb_caffe_db --local --command="
INSERT INTO cashback_transactions (customer_id, order_id, type, amount_vnd, created_at)
VALUES (1, 999, 'earn', 5000, datetime('now'));
INSERT INTO cashback_transactions (customer_id, order_id, type, amount_vnd, created_at)
VALUES (1, 999, 'earn', 5000, datetime('now'));
"
# → Second insert SHOULD FAIL (UNIQUE constraint)
```

### Step 6: Commit + PR
```bash
git add db/migrations/20260518_03_loyalty_v2_launch.sql
git commit -m "$(cat <<'EOF'
feat(loyalty): schema v2 — 4 tier + bonus campaigns + idempotency

Changes:
- Reset loyalty_tiers với 4 tier (Bronze/Silver/Gold/Platinum) rate 3/5/7/10%
- Tier threshold theo VND/năm: 500k/2tr/5tr
- Add expires_at cột cho cashback_transactions (90/120/180/null days)
- UNIQUE (order_id, type='earn') chống double-credit
- UNIQUE phone cho customers chống duplicate signup
- New table: bonus_campaigns + seed Grand Opening 6/6 (x2, +50k signup, refer +50k)
- New table: signup_bonus_log (tracking who got seed bonus)
- New table: loyalty_audit_log (staff_id + IP per transaction)
- New indexes cho perf queries

Spec: 01_LOYALTY_CASHBACK_PROGRAM.md
Blocking task 09, 10, 11, 12.
EOF
)"

git push -u origin feat/loyalty-schema-v2-launch

gh pr create --base main --head feat/loyalty-schema-v2-launch \
  --title "feat(loyalty): schema v2 — 4 tier + campaigns + idempotency" \
  --body "$(cat <<'EOF'
## Summary
Migration v2 cho loyalty system trước khai trương 6/6.

## Critical changes
1. **4 tier** (Bronze/Silver/Gold/Platinum) rate 3/5/7/10% — match spec mới
2. **Threshold theo VND** thay vì points — đúng business model
3. **UNIQUE (order_id, type='earn')** — chống double-credit (bug fix)
4. **bonus_campaigns table** — enable cashback x2, signup +50k khai trương
5. **expires_at** — cashback hết hạn 90/120/180 days theo tier
6. **audit log** — anti-fraud staff_id + IP per transaction

## Test plan
- [ ] Local migration success
- [ ] Verify 4 tier seeded đúng
- [ ] Verify campaign GRAND_OPENING_6_6_2026 active=1
- [ ] Test UNIQUE constraint chống double earn
- [ ] Remote migration success
- [ ] Existing customers vẫn lookup được (backward compat)

## Blocks tasks
- 09 (campaigns logic + fix bugs)
- 10 (signup page)
- 11 (SMS gateway)
- 12 (admin widgets)
EOF
)"
```

### Step 7: Wait for review + merge

---

## ✅ Acceptance criteria

- [ ] Migration file created at correct path
- [ ] Local D1 migration success (no SQL error)
- [ ] 4 tier seeded: bronze, silver, gold, platinum
- [ ] Cashback rates: 0.03, 0.05, 0.07, 0.10
- [ ] Expiry days: 90, 120, 180, NULL
- [ ] Campaign GRAND_OPENING_6_6_2026 exists + active=1
- [ ] UNIQUE constraint test passes (2nd insert fails)
- [ ] Remote D1 migration applied
- [ ] PR merged

---

## 🆘 Rollback nếu lỗi

```sql
-- Drop new tables
DROP TABLE IF EXISTS signup_bonus_log;
DROP TABLE IF EXISTS bonus_campaigns;
DROP TABLE IF EXISTS loyalty_audit_log;

-- Drop new indexes
DROP INDEX IF EXISTS idx_cashback_order_earn_unique;
DROP INDEX IF EXISTS idx_cashback_expires;
DROP INDEX IF EXISTS idx_customers_phone_unique;

-- Restore old tier (manual, may need migration backup)
```

→ Khuyến nghị: backup D1 trước migration với `wrangler d1 export`.
