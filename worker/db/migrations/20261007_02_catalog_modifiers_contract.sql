-- 20261007_02_catalog_modifiers_contract.sql
-- Catalog Modifier Canonical Contract Migration
-- Canonical hierarchy: modifier_groups -> modifier_choices -> product_modifier_groups
-- Rules:
-- 1. modifier_choices.price_delta = canonical modifier price
-- 2. Client price_delta is never trusted
-- 3. Unknown modifier ID -> deterministic rejection
-- 4. Modifier must belong to selected product
-- 5. Inactive/unavailable modifier/group -> deterministic rejection
-- 6. Preserve existing modifier IDs (TEXT)

CREATE TABLE IF NOT EXISTS modifier_groups (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL DEFAULT 'single',
    required    INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS modifier_choices (
    id           TEXT PRIMARY KEY,
    group_id     TEXT NOT NULL,
    name         TEXT NOT NULL,
    price_delta  INTEGER NOT NULL DEFAULT 0,
    is_default   INTEGER NOT NULL DEFAULT 0,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    is_available INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_modifier_groups (
    product_id  TEXT NOT NULL,
    group_id    TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, group_id)
);

-- Column reconciliations if tables pre-existed from earlier migrations
ALTER TABLE modifier_groups ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE modifier_choices ADD COLUMN is_available INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_mod_choices_group_avail ON modifier_choices(group_id, is_available);
CREATE INDEX IF NOT EXISTS idx_pm_groups_prod_grp ON product_modifier_groups(product_id, group_id);
