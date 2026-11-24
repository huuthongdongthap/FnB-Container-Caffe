-- Roll back retry tracking columns and 'failed' status on refund_loyalty_work.
DROP TABLE IF EXISTS _skip_refund_loyalty_work_prev;
CREATE TABLE IF NOT EXISTS _skip_refund_loyalty_work_prev (
  tenant_id TEXT NOT NULL,
  reversal_key TEXT NOT NULL,
  payment_id TEXT,
  order_id TEXT NOT NULL,
  customer_id TEXT,
  amount INTEGER NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  points_reversed INTEGER NOT NULL DEFAULT 0,
  cashback_reversed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  PRIMARY KEY (tenant_id, reversal_key)
);

INSERT INTO _skip_refund_loyalty_work_prev (
  tenant_id,
  reversal_key,
  payment_id,
  order_id,
  customer_id,
  amount,
  status,
  points_reversed,
  cashback_reversed,
  created_at,
  completed_at
)
SELECT
  tenant_id,
  reversal_key,
  payment_id,
  order_id,
  customer_id,
  amount,
  CASE WHEN status = 'failed' THEN 'pending' ELSE status END,
  points_reversed,
  cashback_reversed,
  created_at,
  CASE WHEN status = 'failed' THEN NULL ELSE completed_at END
FROM refund_loyalty_work;

DROP TABLE IF EXISTS refund_loyalty_work;
ALTER TABLE _skip_refund_loyalty_work_prev RENAME TO refund_loyalty_work;

CREATE INDEX IF NOT EXISTS idx_refund_loyalty_order
  ON refund_loyalty_work(tenant_id, order_id, status);
