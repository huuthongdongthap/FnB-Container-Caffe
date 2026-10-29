-- =============================================================================
-- Migration: 20261029_05_catalog_modifiers_kds_stations_and_table_cutover.sql
-- Purpose:
--   1. Seed canonical beverage modifier groups, modifier choices, product links,
--      and menu_modifiers projection matching the exact fnb-caffe-db DDL so
--      GET /api/menu and POST /api/orders support customized sweetness and ice
--      levels across craft drink categories.
--   2. Seed kitchen_stations (with required slug column) and category_stations
--      for all 10 production menu categories (both cat_* IDs and slugs) so KDS
--      station routing and /api/kitchen-stations/:id/tickets succeed.
--   3. Cancel pre-launch non-terminal test orders (created before 2026-10-28)
--      that saturate the oldest-first LIMIT 50 window in GET /api/kds/orders.
--   4. Release stale cafe_tables locks that have no active table_sessions and
--      reconcile table_qr_codes with the 12 canonical table slugs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Beverage Modifier Groups & Choices
-- -----------------------------------------------------------------------------

INSERT OR REPLACE INTO modifier_groups (
  id, name, type, required, sort_order, is_active, created_at, updated_at
) VALUES
  ('mg_sweetness',      'Độ ngọt (Đường)', 'single', 0, 1, 1, datetime('now'), datetime('now')),
  ('mg_ice',            'Mức đá',          'single', 0, 2, 1, datetime('now'), datetime('now')),
  ('mg_bottled_choice', 'Chọn loại nước',  'single', 0, 3, 1, datetime('now'), datetime('now'));

INSERT OR REPLACE INTO modifier_choices (
  id, group_id, name, price_delta, is_default, is_available, sort_order, created_at
) VALUES
  ('mc_sweet_100',      'mg_sweetness',      '100% đường (chuẩn)', 0, 1, 1, 1, datetime('now')),
  ('mc_sweet_70',       'mg_sweetness',      '70% ít ngọt',        0, 0, 1, 2, datetime('now')),
  ('mc_sweet_50',       'mg_sweetness',      '50% ngọt thanh',     0, 0, 1, 3, datetime('now')),
  ('mc_sweet_0',        'mg_sweetness',      'Không đường',        0, 0, 1, 4, datetime('now')),
  ('mc_sweet_soda_100', 'mg_sweetness',      '100% ngọt (chuẩn)',  0, 0, 1, 5, datetime('now')),
  ('mc_ice_full',       'mg_ice',            'Đá đầy đủ (chuẩn)',  0, 1, 1, 1, datetime('now')),
  ('mc_ice_std',        'mg_ice',            'Đá thường (chuẩn)',  0, 0, 1, 2, datetime('now')),
  ('mc_ice_less',       'mg_ice',            'Ít đá',              0, 0, 1, 3, datetime('now')),
  ('mc_ice_sep',        'mg_ice',            'Đá riêng',           0, 0, 1, 4, datetime('now')),
  ('mc_ice_hot',        'mg_ice',            'Uống nóng',          0, 0, 1, 5, datetime('now')),
  ('mc_drink_sting',    'mg_bottled_choice', 'Sting',              0, 1, 1, 1, datetime('now')),
  ('mc_drink_coca',     'mg_bottled_choice', 'Coca',               0, 0, 1, 2, datetime('now')),
  ('mc_drink_pepsi',    'mg_bottled_choice', 'Pepsi',              0, 0, 1, 3, datetime('now')),
  ('mc_drink_7up',      'mg_bottled_choice', '7 UP',               0, 0, 1, 4, datetime('now')),
  ('mc_drink_olong',    'mg_bottled_choice', 'Ô long',             0, 0, 1, 5, datetime('now'));

CREATE TABLE IF NOT EXISTS menu_modifiers (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  option_name TEXT NOT NULL,
  price_delta INTEGER DEFAULT 0,
  available INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

INSERT OR REPLACE INTO menu_modifiers (
  id, group_id, option_name, price_delta, available, updated_at
) VALUES
  ('mc_sweet_100',      'mg_sweetness',      '100% đường (chuẩn)', 0, 1, datetime('now')),
  ('mc_sweet_70',       'mg_sweetness',      '70% ít ngọt',        0, 1, datetime('now')),
  ('mc_sweet_50',       'mg_sweetness',      '50% ngọt thanh',     0, 1, datetime('now')),
  ('mc_sweet_0',        'mg_sweetness',      'Không đường',        0, 1, datetime('now')),
  ('mc_sweet_soda_100', 'mg_sweetness',      '100% ngọt (chuẩn)',  0, 1, datetime('now')),
  ('mc_ice_full',       'mg_ice',            'Đá đầy đủ (chuẩn)',  0, 1, datetime('now')),
  ('mc_ice_std',        'mg_ice',            'Đá thường (chuẩn)',  0, 1, datetime('now')),
  ('mc_ice_less',       'mg_ice',            'Ít đá',              0, 1, datetime('now')),
  ('mc_ice_sep',        'mg_ice',            'Đá riêng',           0, 1, datetime('now')),
  ('mc_ice_hot',        'mg_ice',            'Uống nóng',          0, 1, datetime('now')),
  ('mc_drink_sting',    'mg_bottled_choice', 'Sting',              0, 1, datetime('now')),
  ('mc_drink_coca',     'mg_bottled_choice', 'Coca',               0, 1, datetime('now')),
  ('mc_drink_pepsi',    'mg_bottled_choice', 'Pepsi',              0, 1, datetime('now')),
  ('mc_drink_7up',      'mg_bottled_choice', '7 UP',               0, 1, datetime('now')),
  ('mc_drink_olong',    'mg_bottled_choice', 'Ô long',             0, 1, datetime('now'));

INSERT OR IGNORE INTO product_modifier_groups (product_id, group_id, sort_order) VALUES
  ('bt002', 'mg_bottled_choice', 1);

INSERT OR IGNORE INTO product_modifier_groups (product_id, group_id, sort_order)
SELECT id, 'mg_sweetness', 1
FROM products
WHERE category_id IN ('cat_trad_coffee', 'cat_hot_coffee', 'cat_tea', 'cat_juice', 'cat_soda', 'cat_other');

INSERT OR IGNORE INTO product_modifier_groups (product_id, group_id, sort_order)
SELECT id, 'mg_ice', 2
FROM products
WHERE category_id IN ('cat_trad_coffee', 'cat_tea', 'cat_juice', 'cat_soda', 'cat_other')
   OR (category_id = 'cat_yogurt' AND id != 'yg004');

INSERT OR IGNORE INTO product_modifier_groups (product_id, group_id, sort_order)
SELECT id, 'mg_sweetness', 1
FROM menu_items
WHERE category IN ('traditional-coffee', 'hot-coffee', 'tea', 'juice', 'italian-soda', 'other-drinks', 'cat_trad_coffee', 'cat_hot_coffee', 'cat_tea', 'cat_juice', 'cat_soda', 'cat_other');

INSERT OR IGNORE INTO product_modifier_groups (product_id, group_id, sort_order)
SELECT id, 'mg_ice', 2
FROM menu_items
WHERE category IN ('traditional-coffee', 'tea', 'juice', 'italian-soda', 'other-drinks', 'cat_trad_coffee', 'cat_tea', 'cat_juice', 'cat_soda', 'cat_other')
   OR (category IN ('yogurt', 'cat_yogurt') AND id != 'yg004');

-- -----------------------------------------------------------------------------
-- 2. Kitchen Stations & Category Station Routing
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kitchen_stations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  sort_order INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS category_stations (
  category_id TEXT NOT NULL,
  station_id TEXT NOT NULL,
  PRIMARY KEY (category_id, station_id)
);

INSERT OR REPLACE INTO kitchen_stations (
  id, name, slug, sort_order, active, created_at, updated_at
) VALUES
  ('ks_espresso_bar',  'Quầy Pha Chế Cà Phê',   'espresso-bar',  1, 1, datetime('now'), datetime('now')),
  ('ks_tea_cold_bar',  'Quầy Trà & Soda',       'tea-cold-bar',  2, 1, datetime('now'), datetime('now')),
  ('ks_blended_juice', 'Quầy Đá Xay & Sinh Tố', 'blended-juice', 3, 1, datetime('now'), datetime('now')),
  ('ks_ready_serve',   'Quầy Phục Vụ Nhanh',    'ready-serve',   4, 1, datetime('now'), datetime('now'));

INSERT OR REPLACE INTO category_stations (category_id, station_id) VALUES
  ('cat_trad_coffee',    'ks_espresso_bar'),
  ('cat_hot_coffee',     'ks_espresso_bar'),
  ('cat_tea',            'ks_tea_cold_bar'),
  ('cat_soda',           'ks_tea_cold_bar'),
  ('cat_other',          'ks_tea_cold_bar'),
  ('cat_frappuccino',    'ks_blended_juice'),
  ('cat_smoothies',      'ks_blended_juice'),
  ('cat_juice',          'ks_blended_juice'),
  ('cat_yogurt',         'ks_ready_serve'),
  ('cat_bottled',        'ks_ready_serve'),
  ('traditional-coffee', 'ks_espresso_bar'),
  ('hot-coffee',         'ks_espresso_bar'),
  ('tea',                'ks_tea_cold_bar'),
  ('italian-soda',       'ks_tea_cold_bar'),
  ('other-drinks',       'ks_tea_cold_bar'),
  ('frappuccino',        'ks_blended_juice'),
  ('smoothies',          'ks_blended_juice'),
  ('juice',              'ks_blended_juice'),
  ('yogurt',             'ks_ready_serve'),
  ('bottled',            'ks_ready_serve');

-- -----------------------------------------------------------------------------
-- 3. Pre-Launch Stuck KDS Orders Cleanup
-- -----------------------------------------------------------------------------

UPDATE orders
SET status = 'cancelled',
    updated_at = datetime('now')
WHERE status NOT IN ('completed', 'cancelled')
  AND created_at < '2026-10-28';

-- -----------------------------------------------------------------------------
-- 4. Cafe Tables Reset & QR Slug Seed
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS table_sessions (
  id TEXT PRIMARY KEY,
  table_id INTEGER NOT NULL,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now'))
);

UPDATE cafe_tables
SET status = 'Available',
    updated_at = datetime('now')
WHERE status != 'Available'
  AND id NOT IN (SELECT table_id FROM table_sessions WHERE status = 'active');

DROP TABLE IF EXISTS table_qr_codes;

CREATE TABLE IF NOT EXISTS table_qr_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_table_qr_slug ON table_qr_codes(slug);

INSERT OR REPLACE INTO table_qr_codes (table_id, slug, created_at, updated_at) VALUES
  (1,  '1-indoor',   datetime('now'), datetime('now')),
  (2,  '2-indoor',   datetime('now'), datetime('now')),
  (3,  '3-indoor',   datetime('now'), datetime('now')),
  (4,  '4-indoor',   datetime('now'), datetime('now')),
  (5,  '5-outdoor',  datetime('now'), datetime('now')),
  (6,  '6-outdoor',  datetime('now'), datetime('now')),
  (7,  '7-outdoor',  datetime('now'), datetime('now')),
  (8,  '8-outdoor',  datetime('now'), datetime('now')),
  (9,  '9-rooftop',  datetime('now'), datetime('now')),
  (10, '10-rooftop', datetime('now'), datetime('now')),
  (11, '11-vip',     datetime('now'), datetime('now')),
  (12, '12-vip',     datetime('now'), datetime('now'));
