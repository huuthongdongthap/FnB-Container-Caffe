-- Migration 006: Add refund columns to payments table
-- Enables full and partial refund tracking via PayOS.

ALTER TABLE payments ADD COLUMN refund_status TEXT DEFAULT NULL
  CHECK(refund_status IN (NULL, 'pending', 'processing', 'completed', 'failed'));
ALTER TABLE payments ADD COLUMN refund_amount INTEGER DEFAULT 0;
ALTER TABLE payments ADD COLUMN refund_reason TEXT DEFAULT NULL;
ALTER TABLE payments ADD COLUMN refunded_at TEXT DEFAULT NULL;
