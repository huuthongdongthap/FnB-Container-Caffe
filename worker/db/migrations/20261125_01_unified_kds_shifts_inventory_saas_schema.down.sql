-- =============================================================================
-- Rollback: 20261125_01_unified_kds_shifts_inventory_saas_schema.down.sql
-- Purpose: Reverse schema changes from 20261125_01.
--
-- D1 foreign-key safety:
--   D1 pins `PRAGMA foreign_keys = 1` and cannot be told otherwise, committing
--   each statement independently. A plain `DROP TABLE parent` therefore either
--   aborts (ON DELETE RESTRICT children) or silently deletes child rows
--   (ON DELETE CASCADE children). Each rebuild below stages child rows into
--   `_skip_*_data`, drops the children, drops the parent, renames the staged
--   parent into place, then recreates the children against the final name and
--   repopulates them. Every statement boundary leaves all foreign keys valid.
--
-- Lossy by design: reverting a tenant-scoped UNIQUE back to a global UNIQUE
-- requires collapsing cross-tenant duplicates. The `ROW_NUMBER()` filters keep
-- the newest row per key and drop the rest.
-- =============================================================================

-- 1. Drop columns added by the forward migration.
ALTER TABLE shift_reconciliations DROP COLUMN online_sales_total;
ALTER TABLE shift_reconciliations DROP COLUMN handover_to_staff_id;
ALTER TABLE shift_reconciliations DROP COLUMN closing_float;
ALTER TABLE shift_reconciliations DROP COLUMN remitted_cash;

ALTER TABLE orders DROP COLUMN cancel_alert;
ALTER TABLE orders DROP COLUMN previous_status;

DROP INDEX IF EXISTS idx_orders_tenant_shipper_status;

-- =============================================================================
-- 2. franchise_locations: revert to global UNIQUE(code)
--    No foreign keys reference this table, so the swap is direct.
-- =============================================================================
DROP TABLE IF EXISTS _skip_franchise_locations_prev;
CREATE TABLE IF NOT EXISTS _skip_franchise_locations_prev (
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
INSERT INTO _skip_franchise_locations_prev (
  id, tenant_id, code, name, address, city, phone, royalty_percentage, status, created_at, updated_at
)
SELECT
  id, tenant_id, code, name, address, city, phone, royalty_percentage, status, created_at, updated_at
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY code ORDER BY COALESCE(updated_at, '') DESC, id DESC) AS rn
  FROM franchise_locations
) WHERE rn = 1;

DROP TABLE IF EXISTS franchise_locations;
ALTER TABLE _skip_franchise_locations_prev RENAME TO franchise_locations;

CREATE INDEX IF NOT EXISTS idx_franchise_tenant ON franchise_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_franchise_code ON franchise_locations(code);
CREATE INDEX IF NOT EXISTS idx_franchise_status ON franchise_locations(status);

-- =============================================================================
-- 3. subscription_plans: revert to global UNIQUE(slug)
--    Children: subscriptions (NO ACTION) -> subscription_invoices (NO ACTION).
--    Both children are rebuilt so the parent swap never leaves a dangling ref.
-- =============================================================================
DROP TRIGGER IF EXISTS update_subscription_plans_timestamp;

DROP TABLE IF EXISTS _skip_subscription_plans_prev;
CREATE TABLE IF NOT EXISTS _skip_subscription_plans_prev (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  container_size TEXT NOT NULL DEFAULT 'standard',
  monthly_price_vnd REAL NOT NULL,
  deposit_vnd REAL NOT NULL DEFAULT 0,
  features TEXT DEFAULT '[]',
  max_occupants INTEGER NOT NULL DEFAULT 1,
  is_popular INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  tenant_id TEXT NOT NULL DEFAULT 'default'
);
INSERT INTO _skip_subscription_plans_prev (
  id, name, slug, description, container_size, monthly_price_vnd, deposit_vnd,
  features, max_occupants, is_popular, is_active, sort_order, created_at, updated_at,
  tenant_id
)
SELECT
  id, name, slug, description, container_size, monthly_price_vnd, deposit_vnd,
  features, max_occupants, is_popular, is_active, sort_order, created_at, updated_at,
  tenant_id
FROM (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY slug ORDER BY CASE WHEN tenant_id = 'default' THEN 0 ELSE 1 END, id ASC
  ) AS rn
  FROM subscription_plans
) WHERE rn = 1;

DROP TABLE IF EXISTS _skip_subscriptions_data;
CREATE TABLE IF NOT EXISTS _skip_subscriptions_data AS SELECT * FROM subscriptions;

DROP TABLE IF EXISTS _skip_subscription_invoices_data;
CREATE TABLE IF NOT EXISTS _skip_subscription_invoices_data AS SELECT * FROM subscription_invoices;

DROP TABLE IF EXISTS subscription_invoices;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS subscription_plans;

ALTER TABLE _skip_subscription_plans_prev RENAME TO subscription_plans;

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES subscription_plans(id),
  customer_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  container_number TEXT,
  zone TEXT NOT NULL DEFAULT 'indoor',
  status TEXT NOT NULL DEFAULT 'active',
  billing_cycle TEXT NOT NULL DEFAULT 'monthly',
  current_period_start TEXT NOT NULL,
  current_period_end TEXT NOT NULL,
  next_billing_date TEXT NOT NULL,
  amount_vnd REAL NOT NULL,
  deposit_paid REAL NOT NULL DEFAULT 0,
  deposit_vnd REAL NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  cancelled_at TEXT,
  cancellation_reason TEXT,
  paused_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  tenant_id TEXT NOT NULL DEFAULT 'default'
);

INSERT INTO subscriptions (
  id, plan_id, customer_id, customer_name, customer_email, customer_phone,
  container_number, zone, status, billing_cycle, current_period_start,
  current_period_end, next_billing_date, amount_vnd, deposit_paid, deposit_vnd,
  notes, cancelled_at, cancellation_reason, paused_at, created_at, updated_at,
  tenant_id
)
SELECT
  id, plan_id, customer_id, customer_name, customer_email, customer_phone,
  container_number, zone, status, billing_cycle, current_period_start,
  current_period_end, next_billing_date, amount_vnd, deposit_paid, deposit_vnd,
  notes, cancelled_at, cancellation_reason, paused_at, created_at, updated_at,
  tenant_id
FROM _skip_subscriptions_data;

-- period_start / period_end stay nullable: the production table was already
-- nullable before this migration, and settled invoices can carry no period.
CREATE TABLE IF NOT EXISTS subscription_invoices (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
  invoice_number TEXT UNIQUE,
  amount_vnd REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_ref TEXT,
  paid_at TEXT,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  tenant_id TEXT NOT NULL DEFAULT 'default'
);

INSERT INTO subscription_invoices (
  id, subscription_id, invoice_number, amount_vnd, currency, status,
  payment_method, payment_ref, paid_at, period_start, period_end, created_at,
  updated_at, tenant_id
)
SELECT
  id,
  subscription_id,
  CASE WHEN inv_rn = 1 THEN invoice_number ELSE NULL END,
  amount_vnd, currency, status,
  payment_method, payment_ref, paid_at, period_start, period_end, created_at,
  updated_at, tenant_id
FROM (
  SELECT *,
    CASE WHEN invoice_number IS NULL THEN 1
         ELSE ROW_NUMBER() OVER (PARTITION BY invoice_number ORDER BY COALESCE(updated_at, '') DESC, id DESC)
    END AS inv_rn
  FROM _skip_subscription_invoices_data
);

DROP TABLE IF EXISTS _skip_subscriptions_data;
DROP TABLE IF EXISTS _skip_subscription_invoices_data;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_tenant_id ON subscription_plans(tenant_id);

CREATE TRIGGER IF NOT EXISTS update_subscription_plans_timestamp
AFTER UPDATE ON subscription_plans
FOR EACH ROW
BEGIN
  UPDATE subscription_plans SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_zone ON subscriptions(zone);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant_id ON subscriptions(tenant_id);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON subscription_invoices(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_ref ON subscription_invoices(payment_ref);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_tenant_id ON subscription_invoices(tenant_id);

-- =============================================================================
-- 4. mrr_snapshots: revert to global UNIQUE(snapshot_date), drop tenant_id
--    No foreign keys reference this table.
-- =============================================================================
DROP TABLE IF EXISTS _skip_mrr_snapshots_prev;
CREATE TABLE IF NOT EXISTS _skip_mrr_snapshots_prev (
  id TEXT PRIMARY KEY,
  snapshot_date TEXT UNIQUE NOT NULL,
  mrr_vnd REAL NOT NULL DEFAULT 0,
  arr_vnd REAL NOT NULL DEFAULT 0,
  active_subscriptions INTEGER NOT NULL DEFAULT 0,
  new_subscriptions_month INTEGER NOT NULL DEFAULT 0,
  churned_subscriptions_month INTEGER NOT NULL DEFAULT 0,
  expansion_mrr_vnd REAL DEFAULT 0,
  contraction_mrr_vnd REAL DEFAULT 0,
  churn_rate_pct REAL DEFAULT 0,
  avg_contract_value_vnd REAL DEFAULT 0,
  by_zone TEXT DEFAULT '{}',
  by_plan TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now'))
);
INSERT INTO _skip_mrr_snapshots_prev (
  id, snapshot_date, mrr_vnd, arr_vnd, active_subscriptions, new_subscriptions_month,
  churned_subscriptions_month, expansion_mrr_vnd, contraction_mrr_vnd, churn_rate_pct,
  avg_contract_value_vnd, by_zone, by_plan, created_at
)
SELECT
  id, snapshot_date, mrr_vnd, arr_vnd, active_subscriptions, new_subscriptions_month,
  churned_subscriptions_month, expansion_mrr_vnd, contraction_mrr_vnd, churn_rate_pct,
  avg_contract_value_vnd, by_zone, by_plan, created_at
FROM (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY snapshot_date ORDER BY CASE WHEN tenant_id = 'default' THEN 0 ELSE 1 END, id DESC
  ) AS rn
  FROM mrr_snapshots
) WHERE rn = 1;

DROP TABLE IF EXISTS mrr_snapshots;
ALTER TABLE _skip_mrr_snapshots_prev RENAME TO mrr_snapshots;

CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date);

-- =============================================================================
-- 5. ingredients + purchase_orders: revert to global UNIQUE(sku|po_number)
--    Children of ingredients: recipe_items (RESTRICT), purchase_order_items
--      (RESTRICT), stock_movements (CASCADE), waste_log (CASCADE).
--    Children of purchase_orders: purchase_order_items (CASCADE).
-- =============================================================================
DROP TABLE IF EXISTS _skip_ingredients_prev;
CREATE TABLE IF NOT EXISTS _skip_ingredients_prev (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE NOT NULL,
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
  tenant_id TEXT NOT NULL DEFAULT 'default'
);
INSERT INTO _skip_ingredients_prev (
  id, name, sku, category, unit, cost_per_unit, current_stock, min_stock,
  max_stock, is_active, created_at, updated_at, supplier_id, last_restocked_at,
  tenant_id
)
SELECT
  id, name, sku, category, unit, cost_per_unit, current_stock, min_stock,
  max_stock, is_active, created_at, updated_at, supplier_id, last_restocked_at,
  tenant_id
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY sku ORDER BY COALESCE(updated_at, '') DESC, id DESC) AS rn
  FROM ingredients
) WHERE rn = 1;

DROP TABLE IF EXISTS _skip_purchase_orders_prev;
CREATE TABLE IF NOT EXISTS _skip_purchase_orders_prev (
  id TEXT PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
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
  tenant_id TEXT NOT NULL DEFAULT 'default',
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT
);
INSERT INTO _skip_purchase_orders_prev (
  id, po_number, supplier_id, order_date, expected_delivery_date, status,
  subtotal, tax, shipping, total, notes, created_by, created_at, updated_at,
  expected_date, total_amount, received_date, total_cost, expected_delivery,
  received_at, approved_by, received_by, tenant_id
)
SELECT
  id, po_number, supplier_id, order_date, expected_delivery_date, status,
  subtotal, tax, shipping, total, notes, created_by, created_at, updated_at,
  expected_date, total_amount, received_date, total_cost, expected_delivery,
  received_at, approved_by, received_by, tenant_id
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY po_number ORDER BY COALESCE(updated_at, '') DESC, id DESC) AS rn
  FROM purchase_orders
) WHERE rn = 1;

DROP TABLE IF EXISTS _skip_recipe_items_data;
CREATE TABLE IF NOT EXISTS _skip_recipe_items_data AS SELECT * FROM recipe_items;

DROP TABLE IF EXISTS _skip_stock_movements_data;
CREATE TABLE IF NOT EXISTS _skip_stock_movements_data AS SELECT * FROM stock_movements;

DROP TABLE IF EXISTS _skip_waste_log_data;
CREATE TABLE IF NOT EXISTS _skip_waste_log_data AS SELECT * FROM waste_log;

DROP TABLE IF EXISTS _skip_purchase_order_items_data;
CREATE TABLE IF NOT EXISTS _skip_purchase_order_items_data AS SELECT * FROM purchase_order_items;

DROP TABLE IF EXISTS purchase_order_items;
DROP TABLE IF EXISTS recipe_items;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS waste_log;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS ingredients;

ALTER TABLE _skip_ingredients_prev RENAME TO ingredients;
ALTER TABLE _skip_purchase_orders_prev RENAME TO purchase_orders;

CREATE TABLE IF NOT EXISTS recipe_items (
  id TEXT PRIMARY KEY,
  recipe_id TEXT NOT NULL,
  ingredient_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL DEFAULT 'g',
  tenant_id TEXT NOT NULL DEFAULT 'default',
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
);

INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity, unit, tenant_id)
SELECT id, recipe_id, ingredient_id, quantity, unit, tenant_id
FROM _skip_recipe_items_data;

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL,
  type TEXT NOT NULL,
  quantity REAL NOT NULL,
  reference_id TEXT,
  reference_type TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

INSERT INTO stock_movements (
  id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_by,
  created_at, tenant_id
)
SELECT
  id, ingredient_id, type, quantity, reference_id, reference_type, notes, created_by,
  created_at, tenant_id
FROM _skip_stock_movements_data;

CREATE TABLE IF NOT EXISTS waste_log (
  id TEXT PRIMARY KEY,
  ingredient_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  reason TEXT NOT NULL,
  recorded_by TEXT,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  order_id TEXT,
  item_id TEXT,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

INSERT INTO waste_log (
  id, ingredient_id, quantity, unit, reason, recorded_by, notes, created_at,
  tenant_id, order_id, item_id
)
SELECT
  id, ingredient_id, quantity, unit, reason, recorded_by, notes, created_at,
  tenant_id, order_id, item_id
FROM _skip_waste_log_data;

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY,
  purchase_order_id TEXT NOT NULL,
  ingredient_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  total_price REAL NOT NULL,
  received_quantity REAL DEFAULT 0,
  po_id TEXT,
  unit_cost REAL DEFAULT 0,
  created_at TEXT,
  unit TEXT NOT NULL DEFAULT 'g',
  tenant_id TEXT NOT NULL DEFAULT 'default',
  FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT
);

INSERT INTO purchase_order_items (
  id, purchase_order_id, ingredient_id, quantity, unit_price, total_price,
  received_quantity, po_id, unit_cost, created_at, unit, tenant_id
)
SELECT
  id, purchase_order_id, ingredient_id, quantity, unit_price, total_price,
  received_quantity, po_id, unit_cost, created_at, unit, tenant_id
FROM _skip_purchase_order_items_data;

DROP TABLE IF EXISTS _skip_recipe_items_data;
DROP TABLE IF EXISTS _skip_stock_movements_data;
DROP TABLE IF EXISTS _skip_waste_log_data;
DROP TABLE IF EXISTS _skip_purchase_order_items_data;

CREATE INDEX IF NOT EXISTS idx_ingredients_sku ON ingredients(sku);
CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category);
CREATE INDEX IF NOT EXISTS idx_ingredients_tenant_id ON ingredients(tenant_id);

CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_tenant_id ON purchase_orders(tenant_id);

CREATE INDEX IF NOT EXISTS idx_recipe_items_recipe ON recipe_items(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_items_tenant_id ON recipe_items(tenant_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_ingredient ON stock_movements(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON stock_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_ing
  ON stock_movements(tenant_id, ingredient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_tenant_id ON stock_movements(tenant_id);

CREATE INDEX IF NOT EXISTS idx_waste_log_ingredient ON waste_log(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_waste_log_item ON waste_log(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_waste_log_date ON waste_log(created_at);
CREATE INDEX IF NOT EXISTS idx_waste_log_tenant_order ON waste_log(tenant_id, order_id, created_at);

CREATE INDEX IF NOT EXISTS idx_po_items_po ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po_id ON purchase_order_items(po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_tenant_id ON purchase_order_items(tenant_id);

-- =============================================================================
-- 6. inventory_items: revert to global UNIQUE(sku)
--    Children: inventory_transactions, inventory_snapshots (both CASCADE).
-- =============================================================================
DROP TABLE IF EXISTS _skip_inventory_items_prev;
CREATE TABLE IF NOT EXISTS _skip_inventory_items_prev (
  id TEXT PRIMARY KEY,
  sku TEXT UNIQUE NOT NULL,
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
  tenant_id TEXT NOT NULL DEFAULT 'default',
  unit_cost REAL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  last_restocked_at TEXT,
  reorder_point REAL DEFAULT 10,
  location TEXT DEFAULT 'main',
  expiry_date TEXT,
  supplier_id TEXT
);
INSERT INTO _skip_inventory_items_prev (
  id, sku, name, name_en, category, unit, current_stock, min_stock, max_stock,
  cost_per_unit, supplier, active, created_at, updated_at, tenant_id, unit_cost,
  is_active, last_restocked_at, reorder_point, location, expiry_date, supplier_id
)
SELECT
  id, sku, name, name_en, category, unit, current_stock, min_stock, max_stock,
  cost_per_unit, supplier, active, created_at, updated_at, tenant_id, unit_cost,
  is_active, last_restocked_at, reorder_point, location, expiry_date, supplier_id
FROM (
  SELECT *, ROW_NUMBER() OVER (PARTITION BY sku ORDER BY COALESCE(updated_at, '') DESC, id DESC) AS rn
  FROM inventory_items
) WHERE rn = 1;

DROP TABLE IF EXISTS _skip_inventory_transactions_data;
CREATE TABLE IF NOT EXISTS _skip_inventory_transactions_data AS
  SELECT * FROM inventory_transactions;

DROP TABLE IF EXISTS _skip_inventory_snapshots_data;
CREATE TABLE IF NOT EXISTS _skip_inventory_snapshots_data AS
  SELECT * FROM inventory_snapshots;

DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS inventory_snapshots;
DROP TABLE IF EXISTS inventory_items;

ALTER TABLE _skip_inventory_items_prev RENAME TO inventory_items;

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjust', 'waste', 'reserve', 'release')),
  quantity REAL NOT NULL,
  reference_id TEXT,
  reference_type TEXT CHECK(reference_type IN ('order', 'purchase', 'adjustment', 'waste_report', 'sync')),
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  previous_stock REAL DEFAULT 0,
  new_stock REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  reason TEXT,
  performed_by TEXT,
  inventory_item_id TEXT,
  staff_id TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);

INSERT INTO inventory_transactions (
  id, item_id, type, quantity, reference_id, reference_type, notes, created_at,
  previous_stock, new_stock, unit_cost, reason, performed_by, inventory_item_id,
  staff_id, tenant_id
)
SELECT
  id, item_id, type, quantity, reference_id, reference_type, notes, created_at,
  previous_stock, new_stock, unit_cost, reason, performed_by, inventory_item_id,
  staff_id, tenant_id
FROM _skip_inventory_transactions_data;

CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT (date('now')),
  opening_stock REAL NOT NULL,
  closing_stock REAL NOT NULL,
  created_at TEXT,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);

INSERT INTO inventory_snapshots (id, item_id, date, opening_stock, closing_stock, created_at, tenant_id)
SELECT id, item_id, date, opening_stock, closing_stock, created_at, tenant_id
FROM _skip_inventory_snapshots_data;

DROP TABLE IF EXISTS _skip_inventory_transactions_data;
DROP TABLE IF EXISTS _skip_inventory_snapshots_data;

CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);

CREATE INDEX IF NOT EXISTS idx_inventory_transactions_item ON inventory_transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created ON inventory_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_ref ON inventory_transactions(reference_id, reference_type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inv_tx_order_item_dedup
  ON inventory_transactions(tenant_id, reference_type, reference_id, item_id, type)
  WHERE reference_type = 'order' AND reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_tx_tenant_ref
  ON inventory_transactions(tenant_id, reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_tenant_id ON inventory_transactions(tenant_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_snapshots_item_date
  ON inventory_snapshots(item_id, date);
CREATE INDEX IF NOT EXISTS idx_inventory_snapshots_tenant_id ON inventory_snapshots(tenant_id);
