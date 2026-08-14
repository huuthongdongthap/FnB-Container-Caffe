-- SaaS Pricing — Phase 4
CREATE TABLE IF NOT EXISTS saas_pricing (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_vi TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_vi TEXT,
  description_en TEXT,
  price_vnd INTEGER NOT NULL,
  price_usd REAL,
  currency TEXT NOT NULL DEFAULT 'VND',
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_recommended INTEGER NOT NULL DEFAULT 0,
  features_vi TEXT NOT NULL DEFAULT '[]',
  features_en TEXT NOT NULL DEFAULT '[]',
  cta_text_vi TEXT NOT NULL DEFAULT 'Bắt đầu',
  cta_text_en TEXT NOT NULL DEFAULT 'Get Started',
  cta_link TEXT NOT NULL DEFAULT '/register',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_saas_pricing_slug ON saas_pricing(slug);
CREATE INDEX IF NOT EXISTS idx_saas_pricing_active_sort ON saas_pricing(active, sort_order);

CREATE TRIGGER IF NOT EXISTS update_saas_pricing_timestamp
  AFTER UPDATE ON saas_pricing
  FOR EACH ROW BEGIN
    UPDATE saas_pricing SET updated_at = datetime('now') WHERE id = NEW.id;
  END;
