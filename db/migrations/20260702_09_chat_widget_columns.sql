-- =====================================================
-- Chat Widget — Add columns for live chat support
-- Adds: message (alias for content), direction, read_at
-- =====================================================

-- Add direction column for differentiating customer vs admin messages
ALTER TABLE contact_messages ADD COLUMN direction TEXT NOT NULL DEFAULT 'customer';

-- Add message column (mirrors content for backward compat with contact form)
ALTER TABLE contact_messages ADD COLUMN message TEXT;

-- Add read_at timestamp for tracking unread admin messages
ALTER TABLE contact_messages ADD COLUMN read_at TEXT;

-- Backfill: set message = content for existing rows
UPDATE contact_messages SET message = content WHERE message IS NULL;
