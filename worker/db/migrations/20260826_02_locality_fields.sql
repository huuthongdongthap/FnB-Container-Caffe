-- 20260826_02_locality_fields.sql
-- Locality context for the Sa Đéc single-store deployment: order locale,
-- per-table bilingual display names, and local-specialty menu tagging.
-- Backs Phase 5 localization (menu/zone copy) — no code reads these yet;
-- serving queries stay SELECT * so the columns are additive only.
--
-- One-shot: SQLite has no ADD COLUMN IF NOT EXISTS — apply exactly once
-- (re-running raises "duplicate column name"). schema.sql on or after
-- 2026-08-26 already declares these columns; this file is for databases
-- created before that date.

ALTER TABLE orders ADD COLUMN locale TEXT DEFAULT 'vi-VN';
ALTER TABLE orders ADD COLUMN location_id TEXT DEFAULT 'sa-dec-main';

ALTER TABLE categories ADD COLUMN display_name_vi TEXT;
ALTER TABLE categories ADD COLUMN display_name_en TEXT;

ALTER TABLE menu_items ADD COLUMN is_local_specialty INTEGER DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN ingredient_source TEXT; -- 'local', 'imported', 'mixed'
