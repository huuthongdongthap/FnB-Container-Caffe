-- ============================================
-- CAMPAIGN LOGS — Automated Marketing Campaigns
-- Phase 5 of automated-marketing-campaigns plan
-- Created: 2026-07-02
-- ============================================

-- Table: campaign_logs
-- Records each automated campaign message sent to customers.
-- Used by deduplicate() to avoid sending repeat messages within cooldown.
CREATE TABLE IF NOT EXISTS campaign_logs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('welcome', 'birthday', 'winback', 'post_visit', 'cashback_expiry')),
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'zalo')),
  sent_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'skipped')),
  error TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Index for deduplicate() lookups: find recent sends by customer + trigger
CREATE INDEX IF NOT EXISTS idx_campaign_logs_customer_trigger ON campaign_logs(customer_id, trigger, sent_at);

-- Index for birthday/annual: find all sends of a given trigger type by period
CREATE INDEX IF NOT EXISTS idx_campaign_logs_trigger_sent ON campaign_logs(trigger, sent_at);

-- Index for cleanup: purge old logs
CREATE INDEX IF NOT EXISTS idx_campaign_logs_sent_at ON campaign_logs(sent_at);
