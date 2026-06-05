-- Migration 07: Add bonus_campaigns and loyalty_audit_log tables
-- Required by: loyalty.js, checkin.js, referrals.js, birthday.js, reports.js

CREATE TABLE IF NOT EXISTS bonus_campaigns (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'checkin', 'referral', 'birthday', 'signup'
  reward_type TEXT NOT NULL, -- 'points', 'cashback', 'discount'
  reward_value INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bonus_campaigns_code ON bonus_campaigns(code);
CREATE INDEX IF NOT EXISTS idx_bonus_campaigns_active ON bonus_campaigns(active);

CREATE TABLE IF NOT EXISTS loyalty_audit_log (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  staff_id TEXT,
  action TEXT NOT NULL, -- 'earn', 'spend', 'bonus', 'referral', 'checkin', 'expire'
  amount_vnd INTEGER DEFAULT 0,
  order_id TEXT,
  metadata TEXT, -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_loyalty_audit_customer ON loyalty_audit_log(customer_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_audit_created ON loyalty_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_audit_action ON loyalty_audit_log(action);
