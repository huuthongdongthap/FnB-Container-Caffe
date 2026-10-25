-- 20261026_01_menu_modifiers_projection.sql
-- Read projection for the customer menu: modifier choices are denormalized here
-- so GET /api/menu can serve a product's options in one query instead of
-- joining modifier_choices -> product_modifier_groups per item.
--
-- Columns must stay in sync with the shape written by the catalog projection
-- policy; renaming a column here silently drops writes there.
CREATE TABLE IF NOT EXISTS menu_modifiers (
    id           TEXT PRIMARY KEY,
    group_id     TEXT NOT NULL,
    option_name  TEXT NOT NULL,
    price_delta  INTEGER NOT NULL DEFAULT 0,
    available    INTEGER NOT NULL DEFAULT 1,
    updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_menu_modifiers_group
    ON menu_modifiers(group_id, available);
