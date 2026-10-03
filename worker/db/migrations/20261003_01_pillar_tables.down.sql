-- Rollback 12 Pillars Ecosystem Integration Tables

DROP INDEX IF EXISTS idx_wifi_status;
DROP INDEX IF EXISTS idx_wifi_mac;
DROP TABLE IF EXISTS wifi_sessions;

DROP INDEX IF EXISTS idx_frigate_label;
DROP INDEX IF EXISTS idx_frigate_camera_time;
DROP TABLE IF EXISTS frigate_events;

DROP INDEX IF EXISTS idx_ti_menu_active;
DROP INDEX IF EXISTS idx_ti_menu_sku;
DROP TABLE IF EXISTS ti_menu_cache;

DROP INDEX IF EXISTS idx_ti_bridge_status;
DROP INDEX IF EXISTS idx_ti_bridge_ti;
DROP INDEX IF EXISTS idx_ti_bridge_local;
DROP TABLE IF EXISTS ti_order_bridge;
