-- 20260913_01_customer_identity_consent_events_visits.sql
-- M1 Customer + Data foundation (v4 pivot): formalize identity, consent,
-- customer events, and visits on top of the existing zero-based
-- `customers` table + `customer_phone` order key.
--
-- Zero-based policy: these tables are ADDITIVE. No existing behavior
-- (guest checkout, loyalty signup, order creation) is altered. New
-- writes are optional enrichment gated by explicit consent.
--
-- All tables CREATE TABLE IF NOT EXISTS (re-run safe).

-- ─────────────────────────────────────────────────────────────────────
-- 1. customer_identities — one row per verified identifier a customer
--    presents (phone, email, zalo, ...). A customer may hold multiple
--    identifiers over time; the identifier that created the row is the
--    canonical one and stays marked is_primary.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_identities (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,            -- FK customers.id
  identifier_type TEXT NOT NULL,        -- phone | email | zalo | other
  identifier_value TEXT NOT NULL,       -- normalized value
  is_primary INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,                     -- ISO timestamp of last verification
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_customer_identities_customer
  ON customer_identities(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_identities_value
  ON customer_identities(identifier_type, identifier_value);

-- ─────────────────────────────────────────────────────────────────────
-- 2. consents — granular opt-in records. A consent is only valid when
--    the customer explicitly granted it (source = checkout | signup |
--    setting). CRM writes (tier promotion, outreach, data export) MUST
--    check an active consent row before mutating state.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consents (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,            -- FK customers.id
  purpose TEXT NOT NULL,                -- crm | marketing | analytics | erpnext_sync
  granted INTEGER NOT NULL DEFAULT 1,   -- 1 = granted, 0 = revoked
  source TEXT NOT NULL,                 -- checkout | signup | setting | staff
  policy_version TEXT NOT NULL DEFAULT 'v1',
  granted_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_consents_customer
  ON consents(customer_id, purpose, granted);

-- ─────────────────────────────────────────────────────────────────────
-- 3. customer_events — append-only log of identity-lifecycle events.
--    The golden-loop spine (v2 §11) reads from here. Never update or
--    delete a row once written; corrections append a new compensating row.
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,            -- FK customers.id (nullable only for anonymous)
  event_type TEXT NOT NULL,
    -- CustomerIdentified | ConsentGiven | ConsentRevoked |
    -- VisitRecorded | CustomerUpgraded | OrderLinked
  payload TEXT,                         -- JSON event detail
  recorded_at TEXT NOT NULL,            -- ISO event time
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_customer_events_customer
  ON customer_events(customer_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_customer_events_type
  ON customer_events(event_type, recorded_at);

-- ─────────────────────────────────────────────────────────────────────
-- 4. visits — materialized store visits (order presential, check-in,
--    reservation completion). Each row is one visit; used by CRM
--    frequency/value queries (v2 §13 the 6 questions).
-- ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,            -- FK customers.id
  visited_at TEXT NOT NULL,             -- ISO arrival time
  channel TEXT NOT NULL DEFAULT 'in_store',
    -- in_store | qr_table | online_pickup | online_delivery
  order_id TEXT,                        -- nullable (a visit may have no order)
  spent INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE INDEX IF NOT EXISTS idx_visits_customer
  ON visits(customer_id, visited_at);
CREATE INDEX IF NOT EXISTS idx_visits_date
  ON visits(visited_at);
