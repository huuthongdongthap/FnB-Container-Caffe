-- Feedback Tables — Rating + Review flow
-- feedback table

CREATE TABLE IF NOT EXISTS feedback (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id),
    customer_id TEXT REFERENCES customers(id),
    customer_name TEXT NOT NULL,
    table_id INTEGER REFERENCES cafe_tables(id),
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    note TEXT DEFAULT '',
    csrf_token TEXT,
    is_locked INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_order_id ON feedback(order_id);
CREATE INDEX IF NOT EXISTS idx_feedback_customer_id ON feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_table_id ON feedback(table_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating);
