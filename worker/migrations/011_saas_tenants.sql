-- SaaS Tenants — Phase 5
CREATE TABLE IF NOT EXISTS saas_tenants (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT,
    tier TEXT NOT NULL DEFAULT 'BASIC',
    status TEXT NOT NULL DEFAULT 'trial',
    owner_user_id TEXT,
    trial_ends_at TEXT,
    current_period_end TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_saas_tenants_owner ON saas_tenants(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_saas_tenants_slug ON saas_tenants(slug);

CREATE TRIGGER IF NOT EXISTS update_saas_tenants_timestamp
AFTER UPDATE ON saas_tenants
FOR EACH ROW BEGIN
    UPDATE saas_tenants SET updated_at = datetime('now') WHERE id = NEW.id;
END;
