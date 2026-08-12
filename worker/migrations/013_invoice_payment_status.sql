-- 013_invoice_payment_status.sql
-- Extend invoice status enum + add payment tracking columns
-- Fix: source table may lack currency/created_at/updated_at — copy existing
-- columns and default the missing ones so the recreate-table pattern works
-- against both fresh and legacy prod schemas.

CREATE TABLE IF NOT EXISTS subscription_invoices_new (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  invoice_number TEXT UNIQUE,
  amount_vnd INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_ref TEXT,
  paid_at TEXT,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO subscription_invoices_new
  (id, subscription_id, invoice_number, amount_vnd, currency, status,
   payment_method, payment_ref, paid_at, period_start, period_end,
   created_at, updated_at)
  SELECT
    id, subscription_id, invoice_number, amount_vnd, 'VND',
    COALESCE(NULLIF(status, ''), 'pending'),
    payment_method, payment_ref, paid_at, period_start, period_end,
    datetime('now'), datetime('now')
  FROM subscription_invoices;

DROP TABLE IF EXISTS subscription_invoices;
ALTER TABLE subscription_invoices_new RENAME TO subscription_invoices;

CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_ref ON subscription_invoices(payment_ref);
