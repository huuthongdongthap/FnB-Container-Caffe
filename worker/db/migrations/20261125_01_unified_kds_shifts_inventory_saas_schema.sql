-- =============================================================================
-- Migration: 20261125_01_unified_kds_shifts_inventory_saas_schema.sql
-- Purpose:
--   1. Add KDS cancel-alert persistence columns (previous_status, cancel_alert)
--      and delivery shipper index on orders; strip historical [OVERDUE] tags.
--   2. Add queryable cash handover columns on shift_reconciliations.
--   3. Replace global single-column UNIQUE constraints with tenant-scoped
--      UNIQUE(tenant_id, ...) on inventory_items, ingredients, purchase_orders,
--      subscription_plans, subscription_invoices, franchise_locations, and
--      add tenant_id + UNIQUE(tenant_id, snapshot_date) to mrr_snapshots.
-- =============================================================================

PRAGMA foreign_keys = OFF;
PRAGMA defer_foreign_keys = ON;

-- 1. Orders: KDS cancel-alert columns, shipper index, and historical [OVERDUE] cleanup
ALTER TABLE orders ADD COLUMN previous_status TEXT;
ALTER TABLE orders ADD COLUMN cancel_alert INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_orders_tenant_shipper_status
  ON orders(tenant_id, assigned_shipper_id, status);

UPDATE orders
SET notes = NULLIF(TRIM(REPLACE(REPLACE(REPLACE(notes, ' [OVERDUE]', ''), '[OVERDUE] ', ''), '[OVERDUE]', '')), '')
WHERE notes LIKE '%[OVERDUE]%';

-- 2. Shift reconciliations: explicit handover & online sales columns
ALTER TABLE shift_reconciliations ADD COLUMN remitted_cash REAL DEFAULT 0;
ALTER TABLE shift_reconciliations ADD COLUMN closing_float REAL DEFAULT 0;
ALTER TABLE shift_reconciliations ADD COLUMN handover_to_staff_id TEXT;
ALTER TABLE shift_reconciliations ADD COLUMN online_sales_total REAL DEFAULT 0;

-- 3a. inventory_items: tenant-scoped UNIQUE(tenant_id, sku)
DROP TABLE IF EXISTS _skip_inventory_items_next;
CREATE TABLE IF NOT EXISTS _skip_inventory_items_next (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL,
  name_en TEXT,
  category TEXT NOT NULL DEFAULT 'raw_materials',
  unit TEXT NOT NULL DEFAULT 'pcs',
  current_stock REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  max_stock REAL NOT NULL DEFAULT 1000,
  cost_per_unit REAL DEFAULT 0,
  supplier TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  reorder_point REAL DEFAULT 10,
  location TEXT DEFAULT 'main',
  expiry_date TEXT,
  supplier_id TEXT,
  unit_cost REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  last_restocked_at TEXT,
  UNIQUE(tenant_id, sku)
);

INSERT INTO _skip_inventory_items_next (
  id, sku, tenant_id, name, name_en, category, unit, current_stock, min_stock, max_stock,
  cost_per_unit, supplier, active, created_at, updated_at, reorder_point, location,
  expiry_date, supplier_id, unit_cost, is_active, last_restocked_at
)
SELECT
  id,
  COALESCE(NULLIF(TRIM(sku), ''), id),
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'),
  name,
  name_en,
  COALESCE(category, 'raw_materials'),
  COALESCE(unit, 'pcs'),
  COALESCE(current_stock, 0),
  COALESCE(min_stock, 0),
  COALESCE(max_stock, 1000),
  cost_per_unit,
  supplier,
  active,
  created_at,
  updated_at,
  reorder_point,
  location,
  expiry_date,
  supplier_id,
  unit_cost,
  is_active,
  last_restocked_at
FROM inventory_items;

DROP TABLE IF EXISTS inventory_items;
ALTER TABLE _skip_inventory_items_next RENAME TO inventory_items;

CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_id ON inventory_items(tenant_id);

-- 3b. ingredients: tenant-scoped UNIQUE(tenant_id, sku)
DROP TABLE IF EXISTS _skip_ingredients_next;
CREATE TABLE IF NOT EXISTS _skip_ingredients_next (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'raw_materials',
  unit TEXT NOT NULL DEFAULT 'pcs',
  cost_per_unit REAL DEFAULT 0,
  current_stock REAL NOT NULL DEFAULT 0,
  min_stock REAL NOT NULL DEFAULT 0,
  max_stock REAL NOT NULL DEFAULT 1000,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  supplier_id TEXT,
  last_restocked_at TEXT,
  UNIQUE(tenant_id, sku)
);

INSERT INTO _skip_ingredients_next (
  tenant_id, id, name, sku, category, unit, cost_per_unit, current_stock,
  min_stock, max_stock, is_active, created_at, updated_at, supplier_id, last_restocked_at
)
SELECT
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'),
  id,
  name,
  COALESCE(NULLIF(TRIM(sku), ''), id),
  COALESCE(category, 'raw_materials'),
  COALESCE(unit, 'pcs'),
  cost_per_unit,
  COALESCE(current_stock, 0),
  COALESCE(min_stock, 0),
  COALESCE(max_stock, 1000),
  COALESCE(is_active, 1),
  created_at,
  updated_at,
  supplier_id,
  last_restocked_at
FROM ingredients;

DROP TABLE IF EXISTS ingredients;
ALTER TABLE _skip_ingredients_next RENAME TO ingredients;

CREATE INDEX IF NOT EXISTS idx_ingredients_sku ON ingredients(sku);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);
CREATE INDEX IF NOT EXISTS idx_ingredients_tenant_id ON ingredients(tenant_id);

-- 3c. purchase_orders: tenant-scoped UNIQUE(tenant_id, po_number)
DROP TABLE IF EXISTS _skip_purchase_orders_next;
CREATE TABLE IF NOT EXISTS _skip_purchase_orders_next (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  id TEXT PRIMARY KEY,
  po_number TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  order_date TEXT NOT NULL,
  expected_delivery_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal REAL NOT NULL DEFAULT 0,
  tax REAL NOT NULL DEFAULT 0,
  shipping REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  expected_date TEXT,
  total_amount REAL DEFAULT 0,
  received_date TEXT,
  total_cost REAL DEFAULT 0,
  expected_delivery TEXT,
  received_at TEXT,
  approved_by TEXT,
  received_by TEXT,
  UNIQUE(tenant_id, po_number),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);

INSERT INTO _skip_purchase_orders_next (
  tenant_id, id, po_number, supplier_id, order_date, expected_delivery_date, status,
  subtotal, tax, shipping, total, notes, created_by, created_at, updated_at,
  expected_date, total_amount, received_date, total_cost, expected_delivery,
  received_at, approved_by, received_by
)
SELECT
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'),
  id,
  COALESCE(NULLIF(TRIM(po_number), ''), id),
  supplier_id,
  COALESCE(NULLIF(TRIM(order_date), ''), COALESCE(created_at, date('now'))),
  expected_delivery_date,
  COALESCE(status, 'draft'),
  COALESCE(subtotal, 0),
  COALESCE(tax, 0),
  COALESCE(shipping, 0),
  COALESCE(total, 0),
  notes,
  created_by,
  created_at,
  updated_at,
  expected_date,
  total_amount,
  received_date,
  total_cost,
  expected_delivery,
  received_at,
  approved_by,
  received_by
FROM purchase_orders;

DROP TABLE IF EXISTS purchase_orders;
ALTER TABLE _skip_purchase_orders_next RENAME TO purchase_orders;

CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);

-- 3d. mrr_snapshots: add tenant_id + UNIQUE(tenant_id, snapshot_date)
DROP TABLE IF EXISTS _skip_mrr_snapshots_next;
CREATE TABLE IF NOT EXISTS _skip_mrr_snapshots_next (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  id TEXT PRIMARY KEY,
  snapshot_date TEXT NOT NULL,
  mrr_vnd INTEGER NOT NULL DEFAULT 0,
  arr_vnd INTEGER NOT NULL DEFAULT 0,
  active_subscriptions INTEGER NOT NULL DEFAULT 0,
  new_subscriptions_month INTEGER NOT NULL DEFAULT 0,
  churned_subscriptions_month INTEGER NOT NULL DEFAULT 0,
  expansion_mrr_vnd INTEGER DEFAULT 0,
  contraction_mrr_vnd INTEGER DEFAULT 0,
  churn_rate_pct REAL DEFAULT 0,
  avg_contract_value_vnd INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  by_zone TEXT DEFAULT '{}',
  by_plan TEXT DEFAULT '{}',
  UNIQUE(tenant_id, snapshot_date)
);

INSERT INTO _skip_mrr_snapshots_next (
  tenant_id, id, snapshot_date, mrr_vnd, arr_vnd, active_subscriptions,
  new_subscriptions_month, churned_subscriptions_month, expansion_mrr_vnd,
  contraction_mrr_vnd, churn_rate_pct, avg_contract_value_vnd, created_at,
  by_zone, by_plan
)
SELECT
  'default',
  id,
  snapshot_date,
  mrr_vnd,
  arr_vnd,
  active_subscriptions,
  new_subscriptions_month,
  churned_subscriptions_month,
  expansion_mrr_vnd,
  contraction_mrr_vnd,
  churn_rate_pct,
  avg_contract_value_vnd,
  created_at,
  by_zone,
  by_plan
FROM mrr_snapshots;

DROP TABLE IF EXISTS mrr_snapshots;
ALTER TABLE _skip_mrr_snapshots_next RENAME TO mrr_snapshots;

CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_tenant_date ON mrr_snapshots(tenant_id, snapshot_date);

-- 3e. subscription_plans: tenant-scoped UNIQUE(tenant_id, slug)
DROP TRIGGER IF EXISTS update_subscription_plans_timestamp;
DROP TABLE IF EXISTS _skip_subscription_plans_next;
CREATE TABLE IF NOT EXISTS _skip_subscription_plans_next (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT DEFAULT '',
  container_size TEXT NOT NULL DEFAULT 'standard',
  monthly_price_vnd INTEGER NOT NULL,
  deposit_vnd INTEGER DEFAULT 0,
  features TEXT DEFAULT '[]',
  max_occupants INTEGER DEFAULT 1,
  is_popular INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, slug)
);

INSERT INTO _skip_subscription_plans_next (
  tenant_id, id, name, slug, description, container_size, monthly_price_vnd,
  deposit_vnd, features, max_occupants, is_popular, is_active, sort_order,
  created_at, updated_at
)
SELECT
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'),
  id,
  name,
  slug,
  description,
  container_size,
  monthly_price_vnd,
  deposit_vnd,
  features,
  max_occupants,
  is_popular,
  is_active,
  sort_order,
  created_at,
  updated_at
FROM subscription_plans;

DROP TABLE IF EXISTS subscription_plans;
ALTER TABLE _skip_subscription_plans_next RENAME TO subscription_plans;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_tenant_id ON subscription_plans(tenant_id);

CREATE TRIGGER IF NOT EXISTS update_subscription_plans_timestamp
AFTER UPDATE ON subscription_plans
FOR EACH ROW
BEGIN
  UPDATE subscription_plans SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- 3f. subscription_invoices: tenant-scoped UNIQUE(tenant_id, invoice_number)
DROP TABLE IF EXISTS _skip_subscription_invoices_next;
CREATE TABLE IF NOT EXISTS _skip_subscription_invoices_next (
  tenant_id TEXT NOT NULL DEFAULT 'default',
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
  amount_vnd INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  status TEXT NOT NULL DEFAULT 'pending',
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  invoice_number TEXT,
  paid_at TEXT,
  payment_method TEXT,
  payment_ref TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, invoice_number)
);

INSERT INTO _skip_subscription_invoices_next (
  tenant_id, id, subscription_id, amount_vnd, currency, status,
  period_start, period_end, invoice_number, paid_at, payment_method,
  payment_ref, created_at, updated_at
)
SELECT
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'),
  id,
  subscription_id,
  amount_vnd,
  currency,
  status,
  period_start,
  period_end,
  NULLIF(TRIM(invoice_number), ''),
  paid_at,
  payment_method,
  payment_ref,
  created_at,
  updated_at
FROM subscription_invoices;

DROP TABLE IF EXISTS subscription_invoices;
ALTER TABLE _skip_subscription_invoices_next RENAME TO subscription_invoices;

CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON subscription_invoices(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_tenant_id ON subscription_invoices(tenant_id);

-- 3g. franchise_locations: tenant-scoped UNIQUE(tenant_id, code)
DROP TABLE IF EXISTS _skip_franchise_locations_next;
CREATE TABLE IF NOT EXISTS _skip_franchise_locations_next (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT DEFAULT 'Sa Đéc',
  phone TEXT,
  royalty_percentage REAL DEFAULT 5.0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, code)
);

INSERT INTO _skip_franchise_locations_next (
  id, tenant_id, code, name, address, city, phone, royalty_percentage,
  status, created_at, updated_at
)
SELECT
  id,
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'),
  code,
  name,
  address,
  city,
  phone,
  royalty_percentage,
  status,
  created_at,
  updated_at
FROM franchise_locations;

DROP TABLE IF EXISTS franchise_locations;
ALTER TABLE _skip_franchise_locations_next RENAME TO franchise_locations;

CREATE INDEX IF NOT EXISTS idx_franchise_locations_tenant_id ON franchise_locations(tenant_id);

PRAGMA foreign_keys = ON;
