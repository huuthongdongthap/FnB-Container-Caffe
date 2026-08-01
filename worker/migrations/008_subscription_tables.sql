-- 008_subscription_tables.sql
-- Subscription + invoice tables for container rental billing
-- Required by src/tree/subscriptions/* handlers

CREATE TABLE IF NOT EXISTS subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  container_size TEXT NOT NULL DEFAULT 'standard',
  monthly_price_vnd REAL NOT NULL,
  deposit_vnd REAL NOT NULL DEFAULT 0,
  features TEXT DEFAULT '{}',
  max_occupants INTEGER NOT NULL DEFAULT 1,
  is_popular INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  container_number TEXT,
  zone TEXT NOT NULL DEFAULT 'indoor',
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  next_billing_date TEXT NOT NULL,
  amount_vnd REAL NOT NULL,
  deposit_paid REAL NOT NULL DEFAULT 0,
  deposit_vnd REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  cancelled_at TEXT,
  cancellation_reason TEXT,
  paused_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_zone ON subscriptions(zone);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
  amount_vnd REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  payment_method TEXT,
  payment_ref TEXT,
  paid_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON subscription_invoices(status);

CREATE TABLE IF NOT EXISTS mrr_snapshots (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT UNIQUE NOT NULL,
  mrr_vnd REAL NOT NULL,
  arr_vnd REAL NOT NULL,
  active_subscriptions INTEGER NOT NULL,
  by_zone TEXT DEFAULT '{}',
  by_plan TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
