-- 20260820_08_client_errors.sql
-- SPA uncaught-render reports from the per-route ErrorBoundary.

CREATE TABLE IF NOT EXISTS client_errors (
    id         TEXT PRIMARY KEY,
    route      TEXT,
    message    TEXT,
    stack      TEXT,
    href       TEXT,
    user_agent TEXT,
    ts         TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_client_errors_route ON client_errors(route);
CREATE INDEX IF NOT EXISTS idx_client_errors_ts ON client_errors(ts);