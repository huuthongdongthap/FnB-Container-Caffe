-- 20260824_01_checkins_table.sql
-- Daily check-in rewards: code reads/writes `checkins` (checkin.ts, reports.ts,
-- admin-loyalty.ts) but no migration ever created the table, so any fresh
-- database returns "no such table". This is the canonical DDL.
--
-- One row per customer per day; the unique index enforces the duplicate
-- check that checkin.ts performs with SELECT ... WHERE customer_id = ? AND checkin_date = ?.

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  checkin_date TEXT NOT NULL,          -- YYYY-MM-DD
  checkin_time TEXT NOT NULL,          -- HH:MM:SS
  reward_amount INTEGER NOT NULL DEFAULT 5000,  -- VND
  status TEXT NOT NULL DEFAULT 'pending',       -- pending, approved, rejected
  staff_id TEXT,                       -- staff who approved (nullable)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_customer_date ON checkins(customer_id, checkin_date);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON checkins(checkin_date);
CREATE INDEX IF NOT EXISTS idx_checkins_status ON checkins(status);