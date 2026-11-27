-- =============================================================================
-- Migration: 20261127_01_reservations_customer_id_and_waitlist.sql
-- Purpose:
--   1. Add reservations.customer_id + index so logged-in customers can view/cancel
--      their own reservations cleanly.
--   2. Create multi-tenant waitlist table for reservation waitlist CRUD.
-- =============================================================================

ALTER TABLE reservations ADD COLUMN customer_id TEXT;
CREATE INDEX IF NOT EXISTS idx_reservations_customer_id ON reservations(customer_id);

CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  table_id TEXT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 2,
  zone TEXT DEFAULT 'indoor',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  notified_at TEXT,
  seated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_waitlist_tenant_status ON waitlist(tenant_id, status, created_at);
