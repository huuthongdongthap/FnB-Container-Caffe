-- =============================================================================
-- Migration: 20261125_01_unified_kds_shifts_inventory_saas_schema.sql
-- Purpose:
--   1. Add KDS cancel-alert persistence columns (previous_status, cancel_alert)
--      and the delivery shipper dispatch index on orders; strip historical
--      [OVERDUE] tags.
--   2. Add queryable cash handover columns on shift_reconciliations.
--   3. Replace global single-column UNIQUE constraints with tenant-scoped
--      UNIQUE(tenant_id, ...) on inventory_items, ingredients, purchase_orders,
--      subscription_plans, subscription_invoices, franchise_locations, and
--      add tenant_id + UNIQUE(tenant_id, snapshot_date) to mrr_snapshots.
--
-- Prerequisites (apply first, in this order):
--   20261124_01_orders_kds_prep_timestamps.sql
--   20261124_03_leads_table.sql
--   20261124_04_refund_loyalty_work_retry_tracking.sql
--   20261124_05_orders_delivery_metadata.sql
--
-- D1 foreign-key safety:
--   D1 pins `PRAGMA foreign_keys = 1` and ignores attempts to disable it, so a
--   plain `DROP TABLE parent` either aborts (ON DELETE RESTRICT children) or
--   silently deletes child rows (ON DELETE CASCADE children). Every rebuild
--   below therefore: (a) stages the new parent under a `_skip_` table,
--   (b) copies child rows into `_skip_` staging, (c) drops the children, then
--   the parent, (d) renames the staged parent into place while no child
--   references it, and (e) recreates the children against the final parent name
--   and repopulates them. Each statement boundary leaves every foreign key
--   satisfied, which is what D1 requires because it commits per statement.
-- =============================================================================

-- 1. Orders: KDS cancel-alert columns, shipper dispatch index, [OVERDUE] cleanup
ALTER TABLE orders ADD COLUMN previous_status TEXT;
ALTER TABLE orders ADD COLUMN cancel_alert INTEGER DEFAULT 0;

-- `assigned_shipper_id` arrives with the 20261124_05 prerequisite above, so this
-- index can only be created after that file has been applied.
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

-- =============================================================================
-- 3. inventory_items: tenant-scoped UNIQUE(tenant_id, sku)
--    Children: inventory_transactions, inventory_snapshots (both ON DELETE CASCADE)
-- =============================================================================
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

DROP TABLE IF EXISTS _skip_inventory_transactions_data;
CREATE TABLE IF NOT EXISTS _skip_inventory_transactions_data AS
  SELECT * FROM inventory_transactions;

DROP TABLE IF EXISTS _skip_inventory_snapshots_data;
CREATE TABLE IF NOT EXISTS _skip_inventory_snapshots_data AS
  SELECT * FROM inventory_snapshots;

DROP TABLE IF EXISTS inventory_transactions;
DROP TABLE IF EXISTS inventory_snapshots;
DROP TABLE IF EXISTS inventory_items;

ALTER TABLE _skip_inventory_items_next RENAME TO inventory_items;

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
  staff_id, COALESCE(NULLIF(TRIM(tenant_id), ''), 'default')
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
SELECT
  id, item_id, date, opening_stock, closing_stock, created_at,
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default')
FROM _skip_inventory_snapshots_data;

DROP TABLE IF EXISTS _skip_inventory_transactions_data;
DROP TABLE IF EXISTS _skip_inventory_snapshots_data;

CREATE INDEX IF NOT EXISTS idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON inventory_items(category);
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_id ON inventory_items(tenant_id);

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

-- =============================================================================
-- 4. ingredients + purchase_orders: tenant-scoped UNIQUE(tenant_id, sku|po_number)
--    Children of ingredients: recipe_items (RESTRICT), purchase_order_items
--      (RESTRICT), stock_movements (CASCADE), waste_log (CASCADE).
--    Children of purchase_orders: purchase_order_items (CASCADE).
-- =============================================================================
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

ALTER TABLE _skip_ingredients_next RENAME TO ingredients;
ALTER TABLE _skip_purchase_orders_next RENAME TO purchase_orders;

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
SELECT
  id, recipe_id, ingredient_id, quantity, COALESCE(unit, 'g'),
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default')
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
  created_at, COALESCE(NULLIF(TRIM(tenant_id), ''), 'default')
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
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'), order_id, item_id
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
  received_quantity, po_id, unit_cost, created_at, COALESCE(unit, 'g'),
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default')
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
-- 5. mrr_snapshots: add tenant_id + UNIQUE(tenant_id, snapshot_date)
--    No foreign keys reference this table.
-- =============================================================================
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
-- Live mrr_snapshots predates the tenant column, so historical rows belong to the
-- flagship tenant and are stamped 'default' here.
SELECT
  'default',
  id,
  snapshot_date,
  CAST(COALESCE(mrr_vnd, 0) AS INTEGER),
  CAST(COALESCE(arr_vnd, 0) AS INTEGER),
  active_subscriptions,
  new_subscriptions_month,
  churned_subscriptions_month,
  CAST(COALESCE(expansion_mrr_vnd, 0) AS INTEGER),
  CAST(COALESCE(contraction_mrr_vnd, 0) AS INTEGER),
  churn_rate_pct,
  CAST(COALESCE(avg_contract_value_vnd, 0) AS INTEGER),
  created_at,
  by_zone,
  by_plan
FROM mrr_snapshots;

DROP TABLE IF EXISTS mrr_snapshots;
ALTER TABLE _skip_mrr_snapshots_next RENAME TO mrr_snapshots;

CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_date ON mrr_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_mrr_snapshots_tenant_date ON mrr_snapshots(tenant_id, snapshot_date);

-- =============================================================================
-- 6. subscription_plans + subscriptions + subscription_invoices
--    Children of subscription_plans: subscriptions (NO ACTION).
--    Children of subscriptions: subscription_invoices (NO ACTION).
--    Both child tables are rebuilt here so the parent swap never leaves a
--    dangling reference and so subscription_invoices gains
--    UNIQUE(tenant_id, invoice_number).
-- =============================================================================
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
  max_occupants INTEGER NOT NULL DEFAULT 1,
  is_popular INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
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
  COALESCE(NULLIF(TRIM(slug), ''), id),
  description,
  container_size,
  CAST(COALESCE(monthly_price_vnd, 0) AS INTEGER),
  CAST(COALESCE(deposit_vnd, 0) AS INTEGER),
  features,
  max_occupants,
  is_popular,
  is_active,
  sort_order,
  created_at,
  updated_at
FROM subscription_plans;

DROP TABLE IF EXISTS _skip_subscriptions_data;
CREATE TABLE IF NOT EXISTS _skip_subscriptions_data AS SELECT * FROM subscriptions;

DROP TABLE IF EXISTS _skip_subscription_invoices_data;
CREATE TABLE IF NOT EXISTS _skip_subscription_invoices_data AS SELECT * FROM subscription_invoices;

-- Free-form status values are normalised here because the rebuild tightens them.
UPDATE _skip_subscription_invoices_data
SET status = COALESCE(NULLIF(LOWER(TRIM(status)), ''), 'pending');

DROP TABLE IF EXISTS subscription_invoices;
DROP TABLE IF EXISTS subscriptions;
DROP TABLE IF EXISTS subscription_plans;

ALTER TABLE _skip_subscription_plans_next RENAME TO subscription_plans;

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
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default')
FROM _skip_subscriptions_data;

CREATE TABLE IF NOT EXISTS subscription_invoices (
  id TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id),
  invoice_number TEXT,
  amount_vnd INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'VND',
  status TEXT NOT NULL DEFAULT 'pending',
  payment_method TEXT,
  payment_ref TEXT,
  paid_at TEXT,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  tenant_id TEXT NOT NULL DEFAULT 'default',
  UNIQUE(tenant_id, invoice_number)
);

INSERT INTO subscription_invoices (
  tenant_id, id, subscription_id, invoice_number, amount_vnd, currency, status,
  payment_method, payment_ref, paid_at, period_start, period_end, created_at, updated_at
)
SELECT
  COALESCE(NULLIF(TRIM(tenant_id), ''), 'default'),
  id,
  subscription_id,
  NULLIF(TRIM(invoice_number), ''),
  CAST(COALESCE(amount_vnd, 0) AS INTEGER),
  COALESCE(NULLIF(TRIM(currency), ''), 'VND'),
  status,
  payment_method,
  payment_ref,
  paid_at,
  period_start,
  period_end,
  created_at,
  updated_at
FROM _skip_subscription_invoices_data;

DROP TABLE IF EXISTS _skip_subscriptions_data;
DROP TABLE IF EXISTS _skip_subscription_invoices_data;

CREATE INDEX IF NOT EXISTS idx_subscription_plans_slug ON subscription_plans(slug);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_tenant_id ON subscription_plans(tenant_id);

DROP TRIGGER IF EXISTS update_subscription_plans_timestamp;
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
-- 7. franchise_locations: tenant-scoped UNIQUE(tenant_id, code)
--    No foreign keys reference this table.
-- =============================================================================
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
  COALESCE(NULLIF(TRIM(code), ''), id),
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

CREATE INDEX IF NOT EXISTS idx_franchise_tenant ON franchise_locations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_franchise_code ON franchise_locations(code);
CREATE INDEX IF NOT EXISTS idx_franchise_status ON franchise_locations(status);
CREATE INDEX IF NOT EXISTS idx_franchise_locations_tenant_id ON franchise_locations(tenant_id);
