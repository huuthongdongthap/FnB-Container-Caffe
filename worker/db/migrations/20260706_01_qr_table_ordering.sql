-- QR Table Ordering — Phase 1 migration

-- Maps each table to a short slug for QR code URLs
CREATE TABLE IF NOT EXISTS table_qr_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL UNIQUE REFERENCES cafe_tables(id),
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_table_qr_codes_slug ON table_qr_codes(slug);
