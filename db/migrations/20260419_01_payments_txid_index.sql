-- Migration: add index on payments.transaction_id
-- Date:      2026-04-19
-- Rationale: PayOS webhook lookups by transaction_id (orderCode) — hot path, was full-table scan.
-- Apply:     wrangler d1 execute <db-name> --file=db/migrations/20260419_01_payments_txid_index.sql

CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
