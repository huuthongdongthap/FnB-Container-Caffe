-- Migration 05: Notification audit log
-- Tracks all Zalo ZNS / future channel sends for compliance + debugging

CREATE TABLE IF NOT EXISTS notification_audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  channel       TEXT    NOT NULL CHECK(channel IN ('zalo_zns', 'sms', 'email', 'pos_only')),
  phone         TEXT,
  customer_id   INTEGER,
  template_key  TEXT,
  data          TEXT,
  status        TEXT    NOT NULL CHECK(status IN ('pending', 'sent', 'failed', 'error')),
  response      TEXT,
  created_at    TEXT    DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_notif_customer_date  ON notification_audit_log(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_channel_status ON notification_audit_log(channel, status);
CREATE INDEX IF NOT EXISTS idx_notif_created        ON notification_audit_log(created_at);
