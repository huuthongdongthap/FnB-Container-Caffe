-- =============================================================================
-- Migration: 20261029_06_pilot_shifts_inventory_bom_and_campaigns_seed.sql
-- Purpose:
--   1. Seed the 12 core bar ingredients in both `ingredients` and
--      `inventory_items` (tenant_id = 'default') so GET /api/inventory,
--      GET /api/inventory/forecasting/run-rate, and order BOM stock deductions
--      operate with real Pilot Store inventory data.
--   2. Seed 14 flagship drink BOM `recipes` and `recipe_items` linked to
--      canonical catalog product IDs (`tc001`..`yg001`).
--   3. Seed all 5 canonical `campaign_configs` triggers (`welcome`, `birthday`,
--      `winback`, `post_visit`, `cashback_expiry`).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Core Bar Ingredients (BOM Master)
-- -----------------------------------------------------------------------------

INSERT OR REPLACE INTO ingredients (
  id, name, sku, category, unit, cost_per_unit, current_stock, min_stock, max_stock, is_active, created_at, updated_at
) VALUES
  ('ing_coffee_bean',    'Hạt Cà Phê Robusta/Arabica Đặc Sản', 'SKU-CF-ROBUSTA',  'coffee',    'g',   0.35,  15000, 3000, 30000, 1, datetime('now'), datetime('now')),
  ('ing_condensed_milk', 'Sữa Đặc Ngôi Sao / Ông Thọ',         'SKU-MILK-COND',   'dairy',     'ml',  0.06,  12000, 2000, 25000, 1, datetime('now'), datetime('now')),
  ('ing_fresh_milk',     'Sữa Tươi Thanh Trùng Không Đường',   'SKU-MILK-FRESH',  'dairy',     'ml',  0.04,  20000, 4000, 40000, 1, datetime('now'), datetime('now')),
  ('ing_sugar_syrup',    'Nước Đường Hàn Quốc',                'SKU-SYR-SUGAR',   'syrup',     'ml',  0.03,  10000, 2000, 20000, 1, datetime('now'), datetime('now')),
  ('ing_salted_cream',   'Kem Muối Phú Quý Công Thức Riêng',   'SKU-CRM-SALTED',  'dairy',     'ml',  0.12,   5000, 1000, 10000, 1, datetime('now'), datetime('now')),
  ('ing_black_tea',      'Cốt Hồng Trà Lộc Phát',              'SKU-TEA-BLACK',   'tea',       'ml',  0.02,  15000, 3000, 30000, 1, datetime('now'), datetime('now')),
  ('ing_jasmine_tea',    'Cốt Trà Lài Đặc Biệt',               'SKU-TEA-JASMINE', 'tea',       'ml',  0.025, 15000, 3000, 30000, 1, datetime('now'), datetime('now')),
  ('ing_peach_syrup',    'Syrup Đào & Miếng Đào Ngâm',         'SKU-SYR-PEACH',   'syrup',     'ml',  0.18,   6000, 1200, 12000, 1, datetime('now'), datetime('now')),
  ('ing_matcha_powder',  'Bột Matcha Nhật Bản Nguyên Chất',    'SKU-POW-MATCHA',  'powder',    'g',   1.20,   2500,  500,  5000, 1, datetime('now'), datetime('now')),
  ('ing_cocoa_powder',   'Bột Cacao Nguyên Chất',              'SKU-POW-COCOA',   'powder',    'g',   0.45,   3000,  600,  6000, 1, datetime('now'), datetime('now')),
  ('ing_yogurt_base',    'Sữa Chua Lên Men Tự Nhiên',          'SKU-YOG-BASE',    'dairy',     'g',   0.08,   8000, 1500, 16000, 1, datetime('now'), datetime('now')),
  ('ing_cup_lid_straw',  'Bộ Ly Nhựa 500ml + Nắp + Ống Hút',   'SKU-PKG-CUP500',  'packaging', 'pcs', 1200,   1000,  200,  3000, 1, datetime('now'), datetime('now'));

-- -----------------------------------------------------------------------------
-- 2. Operational Inventory Items (Synced by ID & SKU for tenant 'default')
-- -----------------------------------------------------------------------------

INSERT OR REPLACE INTO inventory_items (
  id, sku, name, name_en, category, unit, current_stock, min_stock, max_stock, cost_per_unit, supplier, active, tenant_id, created_at, updated_at
) VALUES
  ('ing_coffee_bean',    'SKU-CF-ROBUSTA',  'Hạt Cà Phê Robusta/Arabica Đặc Sản', 'Specialty Coffee Beans',      'coffee',    'g',   15000, 3000, 30000, 0.35,  'AURA Roastery Sa Đéc', 1, 'default', datetime('now'), datetime('now')),
  ('ing_condensed_milk', 'SKU-MILK-COND',   'Sữa Đặc Ngôi Sao / Ông Thọ',         'Condensed Milk',              'dairy',     'ml',  12000, 2000, 25000, 0.06,  'Vinamilk Đồng Tháp',   1, 'default', datetime('now'), datetime('now')),
  ('ing_fresh_milk',     'SKU-MILK-FRESH',  'Sữa Tươi Thanh Trùng Không Đường',   'Fresh Pasteurized Milk',      'dairy',     'ml',  20000, 4000, 40000, 0.04,  'Vinamilk Đồng Tháp',   1, 'default', datetime('now'), datetime('now')),
  ('ing_sugar_syrup',    'SKU-SYR-SUGAR',   'Nước Đường Hàn Quốc',                'Pure Cane Sugar Syrup',       'syrup',     'ml',  10000, 2000, 20000, 0.03,  'CJ Foods',             1, 'default', datetime('now'), datetime('now')),
  ('ing_salted_cream',   'SKU-CRM-SALTED',  'Kem Muối Phú Quý Công Thức Riêng',   'House Salted Cream Foam',     'dairy',     'ml',   5000, 1000, 10000, 0.12,  'AURA Kitchen',         1, 'default', datetime('now'), datetime('now')),
  ('ing_black_tea',      'SKU-TEA-BLACK',   'Cốt Hồng Trà Lộc Phát',              'Black Tea Base',              'tea',       'ml',  15000, 3000, 30000, 0.02,  'Trà Lộc Phát',         1, 'default', datetime('now'), datetime('now')),
  ('ing_jasmine_tea',    'SKU-TEA-JASMINE', 'Cốt Trà Lài Đặc Biệt',               'Jasmine Green Tea Base',      'tea',       'ml',  15000, 3000, 30000, 0.025, 'Trà Lộc Phát',         1, 'default', datetime('now'), datetime('now')),
  ('ing_peach_syrup',    'SKU-SYR-PEACH',   'Syrup Đào & Miếng Đào Ngâm',         'Peach Syrup & Slices',        'syrup',     'ml',   6000, 1200, 12000, 0.18,  'Torani / Kronos',      1, 'default', datetime('now'), datetime('now')),
  ('ing_matcha_powder',  'SKU-POW-MATCHA',  'Bột Matcha Nhật Bản Nguyên Chất',    'Ceremonial Matcha Powder',    'powder',    'g',    2500,  500,  5000, 1.20,  'Uji Matcha',           1, 'default', datetime('now'), datetime('now')),
  ('ing_cocoa_powder',   'SKU-POW-COCOA',   'Bột Cacao Nguyên Chất',              'Pure Cocoa Powder',           'powder',    'g',    3000,  600,  6000, 0.45,  'Cargill Cocoa',        1, 'default', datetime('now'), datetime('now')),
  ('ing_yogurt_base',    'SKU-YOG-BASE',    'Sữa Chua Lên Men Tự Nhiên',          'Natural Fermented Yogurt',    'dairy',     'g',    8000, 1500, 16000, 0.08,  'AURA Kitchen',         1, 'default', datetime('now'), datetime('now')),
  ('ing_cup_lid_straw',  'SKU-PKG-CUP500',  'Bộ Ly Nhựa 500ml + Nắp + Ống Hút',   '500ml Cup, Lid & Straw Set',  'packaging', 'pcs',  1000,  200,  3000, 1200,  'Bao Bì Miền Tây',      1, 'default', datetime('now'), datetime('now'));

-- -----------------------------------------------------------------------------
-- 3. Flagship Beverage BOM Recipes & Recipe Components
-- -----------------------------------------------------------------------------

INSERT OR REPLACE INTO recipes (id, product_id, name, instructions, created_at, updated_at) VALUES
  ('rcp_tc001', 'tc001', 'BOM Cà phê Đen (Nóng/Đá)',         'Chiết xuất 25g cà phê phin/máy + 10ml đường chuẩn',            datetime('now'), datetime('now')),
  ('rcp_tc002', 'tc002', 'BOM Cà phê Sữa (Nóng/Đá)',         'Chiết xuất 25g cà phê + 30ml sữa đặc',                          datetime('now'), datetime('now')),
  ('rcp_tc003', 'tc003', 'BOM Bạc Xỉu (Nóng/Đá)',            '18g cà phê + 40ml sữa đặc + 80ml sữa tươi',                    datetime('now'), datetime('now')),
  ('rcp_tc004', 'tc004', 'BOM Cà phê Muối Phú Quý',          '25g cà phê + 25ml sữa đặc + 35ml kem muối',                    datetime('now'), datetime('now')),
  ('rcp_tc005', 'tc005', 'BOM Cà phê Sữa Tươi Sương Sáo',   '20g cà phê + 25ml sữa đặc + 100ml sữa tươi',                   datetime('now'), datetime('now')),
  ('rcp_hc001', 'hc001', 'BOM Espresso (Nóng/Đá)',           '18g hạt cà phê Espresso nguyên chất',                          datetime('now'), datetime('now')),
  ('rcp_hc002', 'hc002', 'BOM Americano (Nóng/Đá)',          '18g hạt cà phê Espresso + nước tinh khiết',                    datetime('now'), datetime('now')),
  ('rcp_hc003', 'hc003', 'BOM Latte (Nóng/Đá)',              '18g hạt cà phê Espresso + 150ml sữa tươi thanh trùng',          datetime('now'), datetime('now')),
  ('rcp_hc004', 'hc004', 'BOM Cappuccino (Nóng/Đá)',         '18g hạt cà phê Espresso + 130ml sữa tươi đánh bọt',            datetime('now'), datetime('now')),
  ('rcp_te001', 'te001', 'BOM Trà Đào Cam Sả',               '150ml cốt hồng trà + 30ml syrup đào + 15ml đường',             datetime('now'), datetime('now')),
  ('rcp_te002', 'te002', 'BOM Trà Vải Hồng Trà',             '150ml cốt trà lài/hồng trà + 20ml đường',                      datetime('now'), datetime('now')),
  ('rcp_ot001', 'ot001', 'BOM Matcha Latte',                 '8g bột Matcha Nhật + 150ml sữa tươi + 20ml sữa đặc',            datetime('now'), datetime('now')),
  ('rcp_ot002', 'ot002', 'BOM Cacao Sữa Đá / Nóng',          '15g bột Cacao nguyên chất + 35ml sữa đặc + 100ml sữa tươi',     datetime('now'), datetime('now')),
  ('rcp_yg001', 'yg001', 'BOM Sữa Chua Đá Viên',             '120g sữa chua tự nhiên + 20ml sữa đặc',                        datetime('now'), datetime('now'));

INSERT OR REPLACE INTO recipe_items (id, recipe_id, ingredient_id, quantity, unit) VALUES
  ('ri_tc001_1', 'rcp_tc001', 'ing_coffee_bean',    25,  'g'),
  ('ri_tc001_2', 'rcp_tc001', 'ing_sugar_syrup',    10,  'ml'),
  ('ri_tc001_3', 'rcp_tc001', 'ing_cup_lid_straw',   1,  'pcs'),
  ('ri_tc002_1', 'rcp_tc002', 'ing_coffee_bean',    25,  'g'),
  ('ri_tc002_2', 'rcp_tc002', 'ing_condensed_milk', 30,  'ml'),
  ('ri_tc002_3', 'rcp_tc002', 'ing_cup_lid_straw',   1,  'pcs'),
  ('ri_tc003_1', 'rcp_tc003', 'ing_coffee_bean',    18,  'g'),
  ('ri_tc003_2', 'rcp_tc003', 'ing_condensed_milk', 40,  'ml'),
  ('ri_tc003_3', 'rcp_tc003', 'ing_fresh_milk',     80,  'ml'),
  ('ri_tc003_4', 'rcp_tc003', 'ing_cup_lid_straw',   1,  'pcs'),
  ('ri_tc004_1', 'rcp_tc004', 'ing_coffee_bean',    25,  'g'),
  ('ri_tc004_2', 'rcp_tc004', 'ing_condensed_milk', 25,  'ml'),
  ('ri_tc004_3', 'rcp_tc004', 'ing_salted_cream',   35,  'ml'),
  ('ri_tc004_4', 'rcp_tc004', 'ing_cup_lid_straw',   1,  'pcs'),
  ('ri_tc005_1', 'rcp_tc005', 'ing_coffee_bean',    20,  'g'),
  ('ri_tc005_2', 'rcp_tc005', 'ing_condensed_milk', 25,  'ml'),
  ('ri_tc005_3', 'rcp_tc005', 'ing_fresh_milk',    100,  'ml'),
  ('ri_tc005_4', 'rcp_tc005', 'ing_cup_lid_straw',   1,  'pcs'),
  ('ri_hc001_1', 'rcp_hc001', 'ing_coffee_bean',    18,  'g'),
  ('ri_hc001_2', 'rcp_hc001', 'ing_cup_lid_straw',   1,  'pcs'),
  ('ri_hc002_1', 'rcp_hc002', 'ing_coffee_bean',    18,  'g'),
  ('ri_hc002_2', 'rcp_hc002', 'ing_cup_lid_straw',   1,  'pcs'),
  ('ri_hc003_1', 'rcp_hc003', 'ing_coffee_bean',    18,  'g'),
  ('ri_hc003_2', 'rcp_hc003', 'ing_fresh_milk',    150,  'ml'),
  ('ri_hc003_3', 'rcp_hc003', 'ing_cup_lid_straw',   1,  'pcs'),
  ('ri_hc004_1', 'rcp_hc004', 'ing_coffee_bean',    18,  'g'),
  ('ri_hc004_2', 'rcp_hc004', 'ing_fresh_milk',    130,  'ml'),
  ('ri_hc004_3', 'rcp_hc004', 'ing_cup_lid_straw',   1,  'pcs'),
  ('ri_te001_1', 'rcp_te001', 'ing_black_tea',     150,  'ml'),
  ('ri_te001_2', 'rcp_te001', 'ing_peach_syrup',    30,  'ml'),
  ('ri_te001_3', 'rcp_te001', 'ing_sugar_syrup',    15,  'ml'),
  ('ri_te001_4', 'rcp_te001', 'ing_cup_lid_straw',   1,  'pcs'),
  ('ri_te002_1', 'rcp_te002', 'ing_jasmine_tea',   150,  'ml'),
  ('ri_te002_2', 'rcp_te002', 'ing_sugar_syrup',    20,  'ml'),
  ('ri_te002_3', 'rcp_te002', 'ing_cup_lid_straw',   1,  'pcs'),
  ('ri_ot001_1', 'rcp_ot001', 'ing_matcha_powder',   8,  'g'),
  ('ri_ot001_2', 'rcp_ot001', 'ing_fresh_milk',    150,  'ml'),
  ('ri_ot001_3', 'rcp_ot001', 'ing_condensed_milk', 20,  'ml'),
  ('ri_ot001_4', 'rcp_ot001', 'ing_cup_lid_straw',   1,  'pcs'),
  ('ri_ot002_1', 'rcp_ot002', 'ing_cocoa_powder',   15,  'g'),
  ('ri_ot002_2', 'rcp_ot002', 'ing_condensed_milk', 35,  'ml'),
  ('ri_ot002_3', 'rcp_ot002', 'ing_fresh_milk',    100,  'ml'),
  ('ri_ot002_4', 'rcp_ot002', 'ing_cup_lid_straw',   1,  'pcs'),
  ('ri_yg001_1', 'rcp_yg001', 'ing_yogurt_base',   120,  'g'),
  ('ri_yg001_2', 'rcp_yg001', 'ing_condensed_milk', 20,  'ml'),
  ('ri_yg001_3', 'rcp_yg001', 'ing_cup_lid_straw',   1,  'pcs');

-- -----------------------------------------------------------------------------
-- 4. CRM Campaign Configurations Seed
-- -----------------------------------------------------------------------------

INSERT OR IGNORE INTO campaign_configs (trigger, is_active, channels, timing, updated_at) VALUES
  ('welcome',         1, '["zalo","sms"]',   'immediate',          datetime('now')),
  ('birthday',        1, '["zalo","email"]', '08:00 on birthday',  datetime('now')),
  ('winback',         1, '["zalo","sms"]',   '14 days inactive',   datetime('now')),
  ('post_visit',      1, '["zalo"]',         '2 hours post-order', datetime('now')),
  ('cashback_expiry', 1, '["zalo","sms"]',   '3 days before exp',  datetime('now'));
