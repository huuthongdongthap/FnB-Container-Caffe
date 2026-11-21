-- Hoàn tác sổ hoàn tiền / Roll back refund transfer ledger.
-- Export retained financial evidence before applying this destructive rollback.
DROP TABLE IF EXISTS payment_refund_transfers;
