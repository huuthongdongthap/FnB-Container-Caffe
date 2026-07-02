-- ============================================
-- CAMPAIGN CONFIGS — Admin Campaign Management
-- Phase 6 of automated-marketing-campaigns plan
-- Created: 2026-07-02
-- ============================================

-- Table: campaign_configs
-- Stores admin-configurable settings for each automated campaign trigger.
-- Each trigger has one row with toggle, channel selection, and timing.
CREATE TABLE IF NOT EXISTS campaign_configs (
  trigger TEXT PRIMARY KEY CHECK (trigger IN ('welcome', 'birthday', 'winback', 'post_visit', 'cashback_expiry')),
  is_active INTEGER NOT NULL DEFAULT 1,
  channels TEXT NOT NULL DEFAULT '["sms"]',
  timing TEXT,
  updated_at TEXT
);
