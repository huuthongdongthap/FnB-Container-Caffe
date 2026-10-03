-- Multi-Tenant & Franchise Preparation Schema
-- Adds row-level tenant partitioning (tenant_id) to core domain tables
-- and introduces franchise_locations for multi-container cafe deployment.

-- 1. Franchise Locations Table
CREATE TABLE IF NOT EXISTS franchise_locations (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT DEFAULT 'Sa Đéc',
    phone TEXT,
    royalty_percentage REAL DEFAULT 5.0,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_franchise_tenant ON franchise_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_franchise_code ON franchise_locations(code);
CREATE INDEX IF NOT EXISTS idx_franchise_status ON franchise_locations(status);

-- 2. Seed Default Flagship Container
INSERT OR IGNORE INTO franchise_locations (
    id, tenant_id, code, name, address, city, phone, royalty_percentage, status
) VALUES (
    'loc_sadec_flagship', 'default', 'SD-01', 'AURA Sa Đéc Container 01', 'Sa Đéc, Đồng Tháp', 'Sa Đéc', '0901234567', 0.0, 'active'
);

-- 3. Row-Level Tenant Isolation on Core Entities
-- Note: SQLite ALTER TABLE ADD COLUMN adds tenant_id with default 'default'
ALTER TABLE orders ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_orders_tenant_created ON orders(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status);

ALTER TABLE cafe_tables ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_cafe_tables_tenant_num ON cafe_tables(tenant_id, table_number);

ALTER TABLE inventory_items ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant ON inventory_items(tenant_id, item_code);

ALTER TABLE reservations ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
CREATE INDEX IF NOT EXISTS idx_reservations_tenant_date ON reservations(tenant_id, reservation_date);
