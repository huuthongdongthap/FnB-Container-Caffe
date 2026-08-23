-- 20260820_05_kitchen_stations.sql
-- F&B Gap 2.4 — kitchen station routing.
--
-- Orders are routed to stations (coffee / food / bar / beverage) based on
-- the category of each ordered product. A station's KDS view then shows
-- only the tickets routed to it, with per-item timing and a "start
-- preparing" / "ready" lifecycle.

CREATE TABLE IF NOT EXISTS kitchen_stations (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now')),
    updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS category_stations (
    category_id TEXT NOT NULL,
    station_id  TEXT NOT NULL,
    PRIMARY KEY (category_id, station_id)
);

CREATE TABLE IF NOT EXISTS order_item_stations (
    order_item_id TEXT NOT NULL,
    station_id    TEXT NOT NULL,
    started_at    TEXT,
    ready_at      TEXT,
    PRIMARY KEY (order_item_id, station_id)
);

CREATE INDEX IF NOT EXISTS idx_cat_stations_station ON category_stations(station_id);
CREATE INDEX IF NOT EXISTS idx_ois_station ON order_item_stations(station_id, ready_at);

CREATE TRIGGER IF NOT EXISTS update_kstations_ts
AFTER UPDATE ON kitchen_stations
BEGIN
    UPDATE kitchen_stations SET updated_at = datetime('now') WHERE id = NEW.id;
END;