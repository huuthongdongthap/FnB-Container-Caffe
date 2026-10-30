-- =============================================================================
-- Migration: 20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql
-- Purpose:
--   1. Backfill canonical packshot URLs (/menu/aura-drinks/<slug>.webp) on all
--      49 catalog items in both products and menu_items where image_url is null
--      or empty, so /api/menu, /api/v1/menu, POS, KDS, and Admin Catalog return
--      non-null imageUrl across all 49 SKUs.
--   2. Backfill recipe_ingredients from recipe_items JOIN recipes (46 rows) and
--      populate recipes.item_id = product_id so OpenAPI inventory ingredient
--      deletion guards (INGREDIENT_IN_USE) and BOM queries see all active recipes.
--   3. Seed the 5 canonical scheduled jobs into cron_jobs for Admin & OpenAPI
--      cron oversight (/api/cron/jobs and /api/v1/cron/jobs).
-- =============================================================================

-- 1. Backfill canonical drink packshot URLs in products
UPDATE products
SET image_url = CASE id
  WHEN 'bt001' THEN '/menu/aura-drinks/dasani.webp'
  WHEN 'bt002' THEN '/menu/aura-drinks/coca-cola.webp'
  WHEN 'bt003' THEN '/menu/aura-drinks/red-bull.webp'
  WHEN 'fp001' THEN '/menu/aura-drinks/coffee-frappuccino.webp'
  WHEN 'fp002' THEN '/menu/aura-drinks/cookie-frappuccino.webp'
  WHEN 'fp003' THEN '/menu/aura-drinks/mocha-frappuccino.webp'
  WHEN 'fp004' THEN '/menu/aura-drinks/coconut-blueberry-coffee.webp'
  WHEN 'fp005' THEN '/menu/aura-drinks/blueberry-yogurt-frappuccino.webp'
  WHEN 'fp006' THEN '/menu/aura-drinks/matcha-frappuccino.webp'
  WHEN 'hc001' THEN '/menu/aura-drinks/espresso.webp'
  WHEN 'hc002' THEN '/menu/aura-drinks/americano.webp'
  WHEN 'hc003' THEN '/menu/aura-drinks/cappuccino.webp'
  WHEN 'hc004' THEN '/menu/aura-drinks/mocha.webp'
  WHEN 'hc005' THEN '/menu/aura-drinks/latte.webp'
  WHEN 'hc006' THEN '/menu/aura-drinks/matcha-latte-nong.webp'
  WHEN 'jc001' THEN '/menu/aura-drinks/da-chanh.webp'
  WHEN 'jc002' THEN '/menu/aura-drinks/rau-ma.webp'
  WHEN 'jc003' THEN '/menu/aura-drinks/rau-ma-dua-sua.webp'
  WHEN 'jc004' THEN '/menu/aura-drinks/dua-trai.webp'
  WHEN 'jc005' THEN '/menu/aura-drinks/dua-da.webp'
  WHEN 'jc006' THEN '/menu/aura-drinks/cam-vat.webp'
  WHEN 'od001' THEN '/menu/aura-drinks/tra-duong.webp'
  WHEN 'od002' THEN '/menu/aura-drinks/binh-tra-bac.webp'
  WHEN 'od003' THEN '/menu/aura-drinks/da-me.webp'
  WHEN 'od004' THEN '/menu/aura-drinks/chanh-muoi.webp'
  WHEN 'od005' THEN '/menu/aura-drinks/sua-tuoi.webp'
  WHEN 'sd001' THEN '/menu/aura-drinks/soda-sapphire.webp'
  WHEN 'sd002' THEN '/menu/aura-drinks/soda-emerald.webp'
  WHEN 'sm001' THEN '/menu/aura-drinks/sinh-to-dau.webp'
  WHEN 'sm002' THEN '/menu/aura-drinks/sinh-to-bo.webp'
  WHEN 'sm003' THEN '/menu/aura-drinks/sinh-to-mang-cau.webp'
  WHEN 'sm004' THEN '/menu/aura-drinks/sinh-to-sapo.webp'
  WHEN 'tc001' THEN '/menu/aura-drinks/ca-phe-den.webp'
  WHEN 'tc002' THEN '/menu/aura-drinks/ca-phe-sua.webp'
  WHEN 'tc003' THEN '/menu/aura-drinks/ca-phe-muoi.webp'
  WHEN 'tc004' THEN '/menu/aura-drinks/bac-xiu.webp'
  WHEN 'tc005' THEN '/menu/aura-drinks/ca-cao.webp'
  WHEN 'tc006' THEN '/menu/aura-drinks/ca-cao-sua.webp'
  WHEN 'tc007' THEN '/menu/aura-drinks/matcha-latte-da.webp'
  WHEN 'te001' THEN '/menu/aura-drinks/tra-lipton-chanh.webp'
  WHEN 'te002' THEN '/menu/aura-drinks/tra-lipton-sua.webp'
  WHEN 'te003' THEN '/menu/aura-drinks/tra-lipton-cam.webp'
  WHEN 'te004' THEN '/menu/aura-drinks/tra-cuc.webp'
  WHEN 'te005' THEN '/menu/aura-drinks/tra-mang-cau.webp'
  WHEN 'te006' THEN '/menu/aura-drinks/tra-dao.webp'
  WHEN 'yg001' THEN '/menu/aura-drinks/yaourt-da.webp'
  WHEN 'yg002' THEN '/menu/aura-drinks/yaourt-ca-phe.webp'
  WHEN 'yg003' THEN '/menu/aura-drinks/yaourt-viet-quoc.webp'
  WHEN 'yg004' THEN '/menu/aura-drinks/yaourt-hu.webp'
  WHEN 'yo001' THEN '/menu/aura-drinks/yaourt-da.webp'
  WHEN 'yo002' THEN '/menu/aura-drinks/yaourt-ca-phe.webp'
  WHEN 'yo003' THEN '/menu/aura-drinks/yaourt-viet-quoc.webp'
  WHEN 'yo004' THEN '/menu/aura-drinks/yaourt-hu.webp'
  ELSE image_url
END
WHERE image_url IS NULL OR image_url = '';

-- 2. Backfill canonical drink packshot URLs in menu_items
UPDATE menu_items
SET image_url = CASE id
  WHEN 'bt001' THEN '/menu/aura-drinks/dasani.webp'
  WHEN 'bt002' THEN '/menu/aura-drinks/coca-cola.webp'
  WHEN 'bt003' THEN '/menu/aura-drinks/red-bull.webp'
  WHEN 'fp001' THEN '/menu/aura-drinks/coffee-frappuccino.webp'
  WHEN 'fp002' THEN '/menu/aura-drinks/cookie-frappuccino.webp'
  WHEN 'fp003' THEN '/menu/aura-drinks/mocha-frappuccino.webp'
  WHEN 'fp004' THEN '/menu/aura-drinks/coconut-blueberry-coffee.webp'
  WHEN 'fp005' THEN '/menu/aura-drinks/blueberry-yogurt-frappuccino.webp'
  WHEN 'fp006' THEN '/menu/aura-drinks/matcha-frappuccino.webp'
  WHEN 'hc001' THEN '/menu/aura-drinks/espresso.webp'
  WHEN 'hc002' THEN '/menu/aura-drinks/americano.webp'
  WHEN 'hc003' THEN '/menu/aura-drinks/cappuccino.webp'
  WHEN 'hc004' THEN '/menu/aura-drinks/mocha.webp'
  WHEN 'hc005' THEN '/menu/aura-drinks/latte.webp'
  WHEN 'hc006' THEN '/menu/aura-drinks/matcha-latte-nong.webp'
  WHEN 'jc001' THEN '/menu/aura-drinks/da-chanh.webp'
  WHEN 'jc002' THEN '/menu/aura-drinks/rau-ma.webp'
  WHEN 'jc003' THEN '/menu/aura-drinks/rau-ma-dua-sua.webp'
  WHEN 'jc004' THEN '/menu/aura-drinks/dua-trai.webp'
  WHEN 'jc005' THEN '/menu/aura-drinks/dua-da.webp'
  WHEN 'jc006' THEN '/menu/aura-drinks/cam-vat.webp'
  WHEN 'od001' THEN '/menu/aura-drinks/tra-duong.webp'
  WHEN 'od002' THEN '/menu/aura-drinks/binh-tra-bac.webp'
  WHEN 'od003' THEN '/menu/aura-drinks/da-me.webp'
  WHEN 'od004' THEN '/menu/aura-drinks/chanh-muoi.webp'
  WHEN 'od005' THEN '/menu/aura-drinks/sua-tuoi.webp'
  WHEN 'sd001' THEN '/menu/aura-drinks/soda-sapphire.webp'
  WHEN 'sd002' THEN '/menu/aura-drinks/soda-emerald.webp'
  WHEN 'sm001' THEN '/menu/aura-drinks/sinh-to-dau.webp'
  WHEN 'sm002' THEN '/menu/aura-drinks/sinh-to-bo.webp'
  WHEN 'sm003' THEN '/menu/aura-drinks/sinh-to-mang-cau.webp'
  WHEN 'sm004' THEN '/menu/aura-drinks/sinh-to-sapo.webp'
  WHEN 'tc001' THEN '/menu/aura-drinks/ca-phe-den.webp'
  WHEN 'tc002' THEN '/menu/aura-drinks/ca-phe-sua.webp'
  WHEN 'tc003' THEN '/menu/aura-drinks/ca-phe-muoi.webp'
  WHEN 'tc004' THEN '/menu/aura-drinks/bac-xiu.webp'
  WHEN 'tc005' THEN '/menu/aura-drinks/ca-cao.webp'
  WHEN 'tc006' THEN '/menu/aura-drinks/ca-cao-sua.webp'
  WHEN 'tc007' THEN '/menu/aura-drinks/matcha-latte-da.webp'
  WHEN 'te001' THEN '/menu/aura-drinks/tra-lipton-chanh.webp'
  WHEN 'te002' THEN '/menu/aura-drinks/tra-lipton-sua.webp'
  WHEN 'te003' THEN '/menu/aura-drinks/tra-lipton-cam.webp'
  WHEN 'te004' THEN '/menu/aura-drinks/tra-cuc.webp'
  WHEN 'te005' THEN '/menu/aura-drinks/tra-mang-cau.webp'
  WHEN 'te006' THEN '/menu/aura-drinks/tra-dao.webp'
  WHEN 'yg001' THEN '/menu/aura-drinks/yaourt-da.webp'
  WHEN 'yg002' THEN '/menu/aura-drinks/yaourt-ca-phe.webp'
  WHEN 'yg003' THEN '/menu/aura-drinks/yaourt-viet-quoc.webp'
  WHEN 'yg004' THEN '/menu/aura-drinks/yaourt-hu.webp'
  WHEN 'yo001' THEN '/menu/aura-drinks/yaourt-da.webp'
  WHEN 'yo002' THEN '/menu/aura-drinks/yaourt-ca-phe.webp'
  WHEN 'yo003' THEN '/menu/aura-drinks/yaourt-viet-quoc.webp'
  WHEN 'yo004' THEN '/menu/aura-drinks/yaourt-hu.webp'
  ELSE image_url
END
WHERE image_url IS NULL OR image_url = '';

-- 3. Backfill BOM recipe_ingredients from recipe_items JOIN recipes
UPDATE recipes
SET item_id = product_id
WHERE item_id IS NULL;

INSERT OR IGNORE INTO recipe_ingredients (
  id, recipe_id, product_id, ingredient_id, item_id, quantity, unit, created_at
)
SELECT
  ri.id,
  ri.recipe_id,
  r.product_id,
  ri.ingredient_id,
  ri.ingredient_id,
  ri.quantity,
  ri.unit,
  COALESCE(r.created_at, datetime('now'))
FROM recipe_items ri
JOIN recipes r ON r.id = ri.recipe_id;

-- 4. Seed canonical scheduled jobs into cron_jobs
INSERT OR IGNORE INTO cron_jobs (
  id, name, description, cron_expression, handler, payload,
  timeout_seconds, max_retries, retry_delay_seconds, is_active, status, location_id, created_by
) VALUES
  (
    'cron_payos_reconcile',
    'PayOS Payment Reconciliation',
    'Reconciles pending PayOS payment links and updates order payment statuses every 5 minutes.',
    '*/5 * * * *',
    'payos_reconciliation',
    '{"window_minutes":30}',
    120, 3, 60, 1, 'idle', 'loc_sadec_flagship', 'system'
  ),
  (
    'cron_campaign_engine',
    'Marketing & Loyalty Campaign Engine',
    'Evaluates customer birthday offers, streak rewards, and scheduled campaign triggers daily.',
    '0 8 * * *',
    'campaign_engine',
    '{"tenant_id":"default"}',
    300, 3, 120, 1, 'idle', 'loc_sadec_flagship', 'system'
  ),
  (
    'cron_erpnext_sync',
    'ERPNext Invoice & Stock Sync',
    'Flushes queued POS invoices and inventory stock deductions to ERPNext.',
    '*/15 * * * *',
    'erpnext_sync',
    '{"batch_size":50}',
    180, 3, 60, 1, 'idle', 'loc_sadec_flagship', 'system'
  ),
  (
    'cron_inventory_forecast',
    'AI Inventory Demand Forecast',
    'Computes daily ingredient burn rates and reorder recommendations for Sa Dec store.',
    '0 2 * * *',
    'inventory_forecast',
    '{"horizon_days":7}',
    300, 2, 120, 1, 'idle', 'loc_sadec_flagship', 'system'
  ),
  (
    'cron_cashback_expiry',
    'Loyalty Cashback Expiry & Warning Notifier',
    'Sends 7-day expiry reminders and expires stale promotional cashback balances.',
    '0 9 * * *',
    'cashback_expiry',
    '{"warning_days":7}',
    180, 2, 60, 1, 'idle', 'loc_sadec_flagship', 'system'
  );
