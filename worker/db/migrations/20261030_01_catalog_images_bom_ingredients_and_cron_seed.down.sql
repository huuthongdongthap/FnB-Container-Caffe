-- =============================================================================
-- Rollback: 20261030_01_catalog_images_bom_ingredients_and_cron_seed.down.sql
-- =============================================================================

DELETE FROM cron_jobs
WHERE id IN (
  'cron_payos_reconcile',
  'cron_campaign_engine',
  'cron_erpnext_sync',
  'cron_inventory_forecast',
  'cron_cashback_expiry'
);

DELETE FROM recipe_ingredients
WHERE id IN (SELECT id FROM recipe_items);

UPDATE recipes
SET item_id = NULL
WHERE item_id = product_id;

UPDATE menu_items
SET image_url = NULL
WHERE image_url LIKE '/menu/aura-drinks/%.webp';

UPDATE products
SET image_url = NULL
WHERE image_url LIKE '/menu/aura-drinks/%.webp';
