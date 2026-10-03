-- 12 Pillars Ecosystem Integration Tables
-- Provides local persistence for TastyIgniter bridge, menu cache, Frigate CCTV events, and OpenWISP WiFi captive portal sessions.

-- 1. TastyIgniter Order Bridge
CREATE TABLE IF NOT EXISTS ti_order_bridge (
    id TEXT PRIMARY KEY,
    local_order_id TEXT NOT NULL,
    ti_order_id TEXT,
    status TEXT NOT NULL,
    error TEXT,
    synced_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ti_bridge_local ON ti_order_bridge(local_order_id);
CREATE INDEX IF NOT EXISTS idx_ti_bridge_ti ON ti_order_bridge(ti_order_id);
CREATE INDEX IF NOT EXISTS idx_ti_bridge_status ON ti_order_bridge(status);

-- 2. TastyIgniter Menu Cache
CREATE TABLE IF NOT EXISTS ti_menu_cache (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    sku TEXT,
    price REAL DEFAULT 0,
    active INTEGER DEFAULT 1,
    cached_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ti_menu_sku ON ti_menu_cache(sku);
CREATE INDEX IF NOT EXISTS idx_ti_menu_active ON ti_menu_cache(active);

-- 3. Frigate CCTV AI Events
CREATE TABLE IF NOT EXISTS frigate_events (
    id TEXT PRIMARY KEY,
    camera TEXT NOT NULL,
    label TEXT NOT NULL,
    start_time REAL NOT NULL,
    end_time REAL,
    score REAL,
    payload TEXT,
    received_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_frigate_camera_time ON frigate_events(camera, start_time);
CREATE INDEX IF NOT EXISTS idx_frigate_label ON frigate_events(label);

-- 4. OpenWISP WiFi Captive Portal Sessions
CREATE TABLE IF NOT EXISTS wifi_sessions (
    id TEXT PRIMARY KEY,
    client_mac TEXT NOT NULL,
    ip_address TEXT,
    phone TEXT,
    customer_id TEXT,
    status TEXT NOT NULL,
    session_timeout INTEGER DEFAULT 3600,
    authorized_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_wifi_mac ON wifi_sessions(client_mac);
CREATE INDEX IF NOT EXISTS idx_wifi_status ON wifi_sessions(status, expires_at);
