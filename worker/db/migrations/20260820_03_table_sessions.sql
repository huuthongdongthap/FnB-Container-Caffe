-- 015_table_sessions.sql
-- Table sessions: dine-in session lifecycle (seated -> ordering -> paid -> closed).
--
-- Existing orders reference table_id but carry no session, so table turnover
-- time, seated-guest counts, and bill merging were not measurable. A session
-- is the unit of F&B truth: it opens when guests sit, accumulates orders,
-- and closes when the bill is paid.

CREATE TABLE IF NOT EXISTS table_sessions (
    id            TEXT PRIMARY KEY,
    table_id      TEXT NOT NULL,
    customer_id   TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    status        TEXT NOT NULL DEFAULT 'active',  -- active, ordering, paid, closed, no_show
    opened_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at     DATETIME,
    order_count   INTEGER NOT NULL DEFAULT 0,
    total_amount  INTEGER NOT NULL DEFAULT 0,
    notes         TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES cafe_tables(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_table_sessions_table ON table_sessions(table_id);
CREATE INDEX IF NOT EXISTS idx_table_sessions_status ON table_sessions(status);
CREATE INDEX IF NOT EXISTS idx_table_sessions_opened ON table_sessions(opened_at);

-- One active session per table enforced by partial index (SQLite 3.35+).
CREATE UNIQUE INDEX IF NOT EXISTS idx_table_sessions_one_active
    ON table_sessions(table_id) WHERE status = 'active';

-- Trigger: bump updated_at on row change.
CREATE TRIGGER IF NOT EXISTS update_table_sessions_timestamp
AFTER UPDATE ON table_sessions BEGIN
    UPDATE table_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;