-- 20260820_04_menu_modifiers.sql
-- F&B Gap 2.2/2.3 — item modifiers (sugar/ice/size), add-ons (toppings),
-- and happy-hour pricing windows.
--
-- Modifiers are per-product option groups (e.g. "Đường" with choices
-- "ít/medium/đường đặc"), each choice carries an optional price delta.
-- Order items snapshot the chosen modifiers so a historical order is
-- self-describing even after the modifier group is edited.

CREATE TABLE IF NOT EXISTS modifier_groups (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,            -- e.g. "Đường", "Kích thước", "Lạnh"
    type        TEXT NOT NULL DEFAULT 'single',  -- single | multiple
    required    INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS modifier_choices (
    id          TEXT PRIMARY KEY,
    group_id    TEXT NOT NULL,
    name        TEXT NOT NULL,            -- e.g. "Ít đường", "Đá xay"
    price_delta INTEGER NOT NULL DEFAULT 0, -- VND delta vs base price
    is_default  INTEGER NOT NULL DEFAULT 0,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (group_id) REFERENCES modifier_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_modifier_groups (
    product_id  TEXT NOT NULL,
    group_id    TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (product_id, group_id)
);

-- Happy-hour pricing windows. Overlapping windows are resolved at
-- evaluation time by picking the one with the largest discount_rate.
CREATE TABLE IF NOT EXISTS happy_hour_windows (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    day_of_week     INTEGER NOT NULL,        -- 0=Sun .. 6=Sat
    start_time      TEXT NOT NULL,            -- "HH:MM" 24h
    end_time        TEXT NOT NULL,            -- "HH:MM" 24h
    discount_rate   REAL NOT NULL DEFAULT 0,  -- 0..1 multiplier off base price
    apply_to        TEXT NOT NULL DEFAULT 'all',  -- all | category_id | product_id
    apply_ids       TEXT,                    -- JSON array of category/product ids
    priority        INTEGER NOT NULL DEFAULT 0,
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mod_choices_group ON modifier_choices(group_id);
CREATE INDEX IF NOT EXISTS idx_pm_groups_product ON product_modifier_groups(product_id);
CREATE INDEX IF NOT EXISTS idx_hh_day ON happy_hour_windows(day_of_week, active);

CREATE TRIGGER IF NOT EXISTS update_mod_groups_ts
AFTER UPDATE ON modifier_groups
BEGIN
    UPDATE modifier_groups SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_hh_ts
AFTER UPDATE ON happy_hour_windows
BEGIN
    UPDATE happy_hour_windows SET updated_at = datetime('now') WHERE id = NEW.id;
END;