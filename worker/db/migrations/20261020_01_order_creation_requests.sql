-- Additive durable idempotency for atomic checkout writes. No existing data is changed.
CREATE TABLE IF NOT EXISTS order_creation_requests (
    scope_key TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    order_id TEXT NOT NULL,
    response_body TEXT NOT NULL,
    created_at TEXT NOT NULL
);
