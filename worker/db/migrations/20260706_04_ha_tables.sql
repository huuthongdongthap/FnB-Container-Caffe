-- Home Assistant device states cache
CREATE TABLE IF NOT EXISTS ha_device_states (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	entity_id TEXT NOT NULL UNIQUE,
	state TEXT NOT NULL,
	attributes TEXT,
	last_changed TEXT DEFAULT (datetime('now')),
	last_updated TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ha_entity_id ON ha_device_states(entity_id);

-- HA automation execution log
CREATE TABLE IF NOT EXISTS ha_automation_log (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	automation_id TEXT NOT NULL,
	trigger_entity TEXT,
	payload TEXT,
	result TEXT,
	executed_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_ha_automation_time ON ha_automation_log(executed_at);
