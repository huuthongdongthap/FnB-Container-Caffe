-- AI & Automation Schema Migration
-- Introduces product affinity mining, inventory forecast snapshots, and AI Barista concierge logs

-- 1. AI Product Affinities (Co-occurrence Basket Analysis)
CREATE TABLE IF NOT EXISTS ai_product_affinities (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    item_a TEXT NOT NULL,
    item_b TEXT NOT NULL,
    co_occurrence_count INTEGER NOT NULL DEFAULT 1,
    affinity_score REAL NOT NULL DEFAULT 0.0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_affinity_tenant_item ON ai_product_affinities(tenant_id, item_a, affinity_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_affinity_tenant ON ai_product_affinities(tenant_id);

-- 2. Inventory Forecasting Snapshots (Run-Rate & Days-of-Supply)
CREATE TABLE IF NOT EXISTS inventory_forecast_snapshots (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    item_sku TEXT NOT NULL,
    item_name TEXT,
    daily_run_rate REAL NOT NULL DEFAULT 0.0,
    current_stock REAL NOT NULL DEFAULT 0.0,
    days_of_supply REAL NOT NULL DEFAULT 0.0,
    risk_level TEXT NOT NULL DEFAULT 'HEALTHY',
    suggested_reorder_qty REAL NOT NULL DEFAULT 0.0,
    lead_time_days INTEGER DEFAULT 2,
    snapshot_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inv_forecast_tenant_date ON inventory_forecast_snapshots(tenant_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_inv_forecast_risk ON inventory_forecast_snapshots(tenant_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_inv_forecast_sku ON inventory_forecast_snapshots(tenant_id, item_sku);

-- 3. AI Barista Interactions Log
CREATE TABLE IF NOT EXISTS ai_barista_interactions (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    customer_id TEXT,
    customer_phone TEXT,
    query_prompt TEXT,
    preferences_json TEXT,
    recommended_product_id TEXT NOT NULL,
    recommended_product_name TEXT NOT NULL,
    engine_used TEXT NOT NULL DEFAULT 'deterministic',
    feedback TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_barista_tenant_created ON ai_barista_interactions(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_barista_product ON ai_barista_interactions(recommended_product_id);
