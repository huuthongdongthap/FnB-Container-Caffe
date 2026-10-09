-- 20261007_01_catalog_canonical_reconciliation.sql
-- Catalog DB Contract Reconciliation:
-- 1. Freezes products as canonical Product master table.
-- 2. Ensures categories has image_url and sort_order indexes.
-- 3. Adds missing slug, compare_at_price, sort_order to products table.
-- 4. Ensures legacy menu_items customer-menu projection has image_url column.
-- Note: SQLite does not support ADD COLUMN IF NOT EXISTS; these are one-shot ALTER TABLE statements.

-- Categories table extensions
ALTER TABLE categories ADD COLUMN image_url TEXT;

-- Products table extensions (canonical master)
ALTER TABLE products ADD COLUMN slug TEXT DEFAULT '';
ALTER TABLE products ADD COLUMN compare_at_price INTEGER;
ALTER TABLE products ADD COLUMN sort_order INTEGER DEFAULT 0;

-- Legacy customer-menu projection extensions
ALTER TABLE menu_items ADD COLUMN image_url TEXT;

-- Supporting Indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);
