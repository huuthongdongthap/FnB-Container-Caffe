-- Migration: 20261004_03_autonomous_edge_ops.sql
-- Description: Dynamic Pricing, Container IoT Telemetry & Autonomous Watchdog, and AI Customer Support interactions.

-- 1. Dynamic Pricing & Happy Hour Rules
CREATE TABLE IF NOT EXISTS dynamic_pricing_rules (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    rule_type TEXT NOT NULL, -- 'happy_hour', 'early_bird', 'category_flash', 'velocity_clearance'
    discount_percent REAL NOT NULL,
    target_category TEXT,
    target_product_id TEXT,
    min_margin_percent REAL NOT NULL DEFAULT 30.0,
    days_of_week TEXT NOT NULL DEFAULT '1,2,3,4,5', -- 0=Sunday, 1=Monday, ..., 6=Saturday
    start_time TEXT NOT NULL, -- 'HH:MM' 24h format
    end_time TEXT NOT NULL,   -- 'HH:MM' 24h format
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dynamic_pricing_tenant_active
    ON dynamic_pricing_rules(tenant_id, is_active);

-- Seed initial rules for Sa Đéc flagship container
INSERT OR IGNORE INTO dynamic_pricing_rules (
    id, tenant_id, name, rule_type, discount_percent, target_category, min_margin_percent, days_of_week, start_time, end_time, is_active
) VALUES
('rule_happy_hour_sadec', 'default', 'Happy Hour Chiều Sa Đéc', 'happy_hour', 15.0, 'coffee', 30.0, '1,2,3,4,5', '14:00', '17:00', 1),
('rule_early_bird_sadec', 'default', 'Combo Sáng Năng Lượng', 'early_bird', 10.0, 'pastry', 25.0, '0,1,2,3,4,5,6', '06:30', '08:30', 1);

-- 2. Container IoT Telemetry Logs
CREATE TABLE IF NOT EXISTS container_telemetry_logs (
    id TEXT PRIMARY KEY,
    container_id TEXT NOT NULL,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    power_source TEXT NOT NULL, -- 'grid', 'battery', 'solar'
    battery_percentage REAL,
    ambient_temp_celsius REAL NOT NULL,
    kds_online INTEGER NOT NULL DEFAULT 1,
    network_ping_ms INTEGER DEFAULT 20,
    alert_status TEXT NOT NULL DEFAULT 'NORMAL', -- 'NORMAL', 'WARNING', 'CRITICAL'
    alert_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_telemetry_container_created
    ON container_telemetry_logs(container_id, created_at DESC);

-- 3. Customer Support AI Interactions
CREATE TABLE IF NOT EXISTS customer_support_interactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    channel TEXT NOT NULL DEFAULT 'web', -- 'web', 'zalo', 'kiosk'
    customer_phone TEXT,
    user_query TEXT NOT NULL,
    detected_intent TEXT NOT NULL, -- 'order_status', 'menu_inquiry', 'table_bill', 'wifi_info', 'loyalty_points', 'general'
    bot_response TEXT NOT NULL,
    engine_used TEXT NOT NULL DEFAULT 'deterministic', -- 'workers_ai', 'deterministic'
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_support_tenant_phone_created
    ON customer_support_interactions(tenant_id, customer_phone, created_at DESC);
