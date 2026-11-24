-- Add retry tracking columns (attempts, last_error, updated_at) and terminal 'failed' status
-- to refund_loyalty_work so scheduled retries never overwrite completed_at on pending rows.
DROP TABLE IF EXISTS _skip_refund_loyalty_work_next;
CREATE TABLE IF NOT EXISTS _skip_refund_loyalty_work_next (
  tenant_id TEXT NOT NULL,
  reversal_key TEXT NOT NULL,
  payment_id TEXT,
  order_id TEXT NOT NULL,
  customer_id TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  points_reversed INTEGER NOT NULL DEFAULT 0,
  cashback_reversed INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  completed_at TEXT,
  PRIMARY KEY (tenant_id, reversal_key)
);

INSERT INTO _skip_refund_loyalty_work_next (
  tenant_id,
  reversal_key,
  payment_id,
  order_id,
  customer_id,
  amount,
  status,
  points_reversed,
  cashback_reversed,
  attempts,
  last_error,
  created_at,
  updated_at,
  completed_at
)
SELECT
  tenant_id,
  reversal_key,
  payment_id,
  order_id,
  customer_id,
  amount,
  status,
  points_reversed,
  cashback_reversed,
  0,
  NULL,
  created_at,
  CASE WHEN status = 'pending' THEN completed_at ELSE NULL END,
  CASE WHEN status = 'pending' THEN NULL ELSE completed_at END
FROM refund_loyalty_work;

DROP TABLE IF EXISTS refund_loyalty_work;
ALTER TABLE _skip_refund_loyalty_work_next RENAME TO refund_loyalty_work;

CREATE INDEX IF NOT EXISTS idx_refund_loyalty_order
  ON refund_loyalty_work(tenant_id, order_id, status);
