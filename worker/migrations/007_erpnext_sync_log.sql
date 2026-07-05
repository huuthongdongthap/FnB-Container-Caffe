-- 007: ERPNext order sync log table
-- Keeps one row per background sync attempt for admin dashboard observability.
CREATE TABLE IF NOT EXISTS erpnext_sync_log (
id TEXT PRIMARY KEY,
method TEXT NOT NULL DEFAULT 'POST',
endpoint TEXT NOT NULL,
request_body TEXT,
response_body TEXT,
error TEXT,
status TEXT NOT NULL DEFAULT 'pending',
retry_count INTEGER NOT NULL DEFAULT 0,
created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_erpnext_sync_log_status
ON erpnext_sync_log (status, retry_count);

CREATE INDEX IF NOT EXISTS idx_erpnext_sync_log_created
ON erpnext_sync_log (created_at);
