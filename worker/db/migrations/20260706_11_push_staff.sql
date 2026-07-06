-- G4: Push Notifications — push_subscriptions table + staff_shifts.clock_in_planned
-- Created: 2026-07-06

-- push_subscriptions: stores Web Push endpoints for both customers and staff
CREATE TABLE IF NOT EXISTS push_subscriptions (
 id TEXT PRIMARY KEY,
 customer_id TEXT,
 role TEXT DEFAULT 'customer', -- 'customer' | 'staff-kitchen' | 'staff-cashier' | 'staff-all'
 endpoint TEXT NOT NULL UNIQUE,
 auth_key TEXT NOT NULL,
 p256dh_key TEXT NOT NULL,
 user_agent TEXT,
 last_used_at TEXT,
 created_at TEXT DEFAULT (datetime('now')),
 updated_at TEXT DEFAULT (datetime('now')),
 FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_role ON push_subscriptions(role);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_customer ON push_subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- notification_audit for push (extends existing notification_audit_log concept)
-- Reuse notification_audit_log — just add 'push' to allowed channels
-- (D1 doesn't support ALTER TABLE ADD CONSTRAINT, so we just allow push inserts
--  and rely on application-level validation)

-- staff_shifts: add clock_in_planned for shift reminder cron
ALTER TABLE staff_shifts ADD COLUMN clock_in_planned TEXT;
