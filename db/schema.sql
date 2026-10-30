-- AURA SPACE — Cloudflare D1 (SQLite) Schema
-- Version 2.0.0 — D1/SQLite compatible
-- FK relationships enforced at application layer (Worker code)

-- ─────────────────────────────────────────────
-- 1. CATEGORIES & PRODUCTS (Canonical Catalog Master)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT UNIQUE NOT NULL,
    description     TEXT,
    sort_order      INTEGER DEFAULT 0,
    image_url       TEXT,
    display_name_vi TEXT,
    display_name_en TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_categories_slug       ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order  ON categories(sort_order);

CREATE TABLE IF NOT EXISTS products (
    id               TEXT PRIMARY KEY,
    category_id      TEXT NOT NULL,
    name             TEXT NOT NULL,
    slug             TEXT DEFAULT '',
    price            INTEGER NOT NULL,
    compare_at_price INTEGER,
    image_url        TEXT,
    description      TEXT,
    tags             TEXT,
    badge            TEXT,
    is_available     INTEGER DEFAULT 1,
    sort_order       INTEGER DEFAULT 0,
    created_at       TEXT DEFAULT (datetime('now')),
    updated_at       TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX IF NOT EXISTS idx_products_category   ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_available  ON products(is_available);
CREATE INDEX IF NOT EXISTS idx_products_slug       ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(sort_order);

-- Legacy customer-menu projection (read compatibility)
CREATE TABLE IF NOT EXISTS menu_items (
    id                 TEXT PRIMARY KEY,
    category           TEXT NOT NULL,
    name               TEXT NOT NULL,
    price              INTEGER NOT NULL,
    description        TEXT,
    image_url          TEXT,
    tags               TEXT,
    badge              TEXT,
    available          INTEGER DEFAULT 1,
    is_local_specialty INTEGER DEFAULT 0,
    ingredient_source  TEXT,
    created_at         TEXT DEFAULT (datetime('now')),
    updated_at         TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_menu_items_category  ON menu_items(category);
CREATE INDEX IF NOT EXISTS idx_menu_items_available ON menu_items(available);

-- ─────────────────────────────────────────────
-- 2. USERS & LOYALTY (CRM)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id                  TEXT PRIMARY KEY,
    email               TEXT UNIQUE,
    username            TEXT UNIQUE,
    password_hash       TEXT,
    name                TEXT,
    full_name           TEXT,
    phone               TEXT UNIQUE,
    role                TEXT NOT NULL DEFAULT 'staff',
    tenant_id           TEXT NOT NULL DEFAULT 'default',
    is_active           INTEGER NOT NULL DEFAULT 1,
    auth_version        INTEGER NOT NULL DEFAULT 1,
    password_changed_at TEXT,
    tier                TEXT DEFAULT 'Silver',
    total_points        INTEGER DEFAULT 0,
    created_at          TEXT DEFAULT (datetime('now')),
    updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

CREATE TABLE IF NOT EXISTS staff_devices (
    id            TEXT PRIMARY KEY,
    staff_id      TEXT NOT NULL REFERENCES users(id),
    device_name   TEXT,
    device_token  TEXT NOT NULL UNIQUE,
    pin_hash      TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'staff',
    last_login_at TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS staff_login_identities (
    email      TEXT PRIMARY KEY,
    staff_id   TEXT NOT NULL UNIQUE REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customers (
    id                TEXT PRIMARY KEY,
    tenant_id         TEXT NOT NULL DEFAULT 'default',
    phone             TEXT UNIQUE,
    email             TEXT UNIQUE,
    name              TEXT,
    tier              TEXT NOT NULL DEFAULT 'bronze',
    loyalty_tier      TEXT NOT NULL DEFAULT 'bronze',
    loyalty_points    INTEGER NOT NULL DEFAULT 0,
    lifetime_points   INTEGER NOT NULL DEFAULT 0,
    total_spent       REAL NOT NULL DEFAULT 0,
    total_orders      INTEGER NOT NULL DEFAULT 0,
    date_of_birth     TEXT,
    birthday          TEXT,
    notes             TEXT,
    zalo              TEXT,
    source            TEXT,
    capture_source    TEXT,
    marketing_consent INTEGER NOT NULL DEFAULT 0,
    consent_marketing INTEGER NOT NULL DEFAULT 0,
    consent_analytics INTEGER NOT NULL DEFAULT 0,
    consent_timestamp TEXT,
    verified_at       TEXT,
    first_visit_at    TEXT,
    last_visit_at     TEXT,
    referral_code     TEXT,
    referred_by       TEXT,
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rewards (
    id             TEXT PRIMARY KEY,
    title          TEXT NOT NULL,
    discount_type  TEXT NOT NULL,
    discount_value REAL NOT NULL,
    point_cost     INTEGER NOT NULL,
    created_at     TEXT DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────────
-- 3. TABLES & RESERVATIONS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cafe_tables (
    id           TEXT PRIMARY KEY,
    table_number TEXT UNIQUE NOT NULL,
    capacity     INTEGER NOT NULL,
    zone         TEXT NOT NULL,
    status       TEXT DEFAULT 'Available',
    tenant_id    TEXT NOT NULL DEFAULT 'default',
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cafe_tables_zone   ON cafe_tables(zone);
CREATE INDEX IF NOT EXISTS idx_cafe_tables_status ON cafe_tables(status);

CREATE TABLE IF NOT EXISTS reservations (
    id               TEXT PRIMARY KEY,
    customer_name    TEXT NOT NULL,
    phone            TEXT NOT NULL,
    reservation_date TEXT NOT NULL,
    reservation_time TEXT NOT NULL,
    pax              INTEGER NOT NULL,
    table_id         TEXT,
    status           TEXT DEFAULT 'Pending',
    created_at       TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reservations_date  ON reservations(reservation_date);
CREATE INDEX IF NOT EXISTS idx_reservations_table ON reservations(table_id);

-- ─────────────────────────────────────────────
-- 4. ORDERS & CHECKOUT (KDS)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    items TEXT NOT NULL,  -- JSON array of order items
    total INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, confirmed, preparing, ready, delivered, cancelled
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_email TEXT,
    customer_address TEXT,
    payment_method TEXT NOT NULL,  -- new orders: cod, payos; legacy values remain readable
    payment_status TEXT DEFAULT 'unpaid',  -- unpaid, paid, refunded
    shipping_fee INTEGER DEFAULT 0,
    discount INTEGER DEFAULT 0,
    notes TEXT,
    delivery_time TEXT,  -- 'now' or scheduled time
    table_id TEXT,       -- FK to cafe_tables (nullable, for dine-in)
    subtotal INTEGER,
    tax INTEGER DEFAULT 0,
    total_amount INTEGER,
    cashback_used INTEGER DEFAULT 0,
    cashback_earned INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    locale TEXT DEFAULT 'vi-VN',
    location_id TEXT DEFAULT 'sa-dec-main',
    order_type TEXT DEFAULT 'dine_in',
    tip_amount INTEGER DEFAULT 0,
    service_fee INTEGER DEFAULT 0,
    updated_by TEXT,
    customer_id TEXT,
    tenant_id TEXT NOT NULL DEFAULT 'default',
    cod_paid_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES cafe_tables(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table   ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

CREATE TABLE IF NOT EXISTS order_creation_requests (
    scope_key TEXT PRIMARY KEY,
    fingerprint TEXT NOT NULL,
    order_id TEXT NOT NULL,
    response_body TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal INTEGER NOT NULL,
    modifiers TEXT,  -- JSON array of selected modifiers: [{group_id, choice_id, name, price_delta}]
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    method TEXT NOT NULL,  -- new payments: cod, payos; legacy values remain readable
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, completed, failed, refunded
    transaction_id TEXT,  -- External payment gateway transaction ID
    payment_url TEXT,  -- Payment redirect URL
    refund_status TEXT,
    refund_amount INTEGER DEFAULT 0,
    refund_reason TEXT,
    refunded_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payments_order          ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status         ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);

-- ─────────────────────────────────────────────
-- 8. PROMOTIONS (Discount Codes)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promotions (
    code           TEXT PRIMARY KEY,
    percent        INTEGER NOT NULL,          -- e.g. 10, 20
    max_discount   INTEGER DEFAULT 0,          -- VND cap; 0 = no cap
    min_order      INTEGER DEFAULT 0,          -- VND minimum order
    usage_limit    INTEGER DEFAULT 0,          -- 0 = unlimited
    usage_count    INTEGER DEFAULT 0,
    starts_at      TEXT,
    expires_at     TEXT,
    is_active      INTEGER DEFAULT 1,
    tenant_id      TEXT NOT NULL DEFAULT 'default',
    created_at     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_promo_active ON promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_promo_tenant ON promotions(tenant_id, is_active);

CREATE TABLE IF NOT EXISTS promotion_redemptions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    promotion_id    TEXT,
    code            TEXT NOT NULL,
    order_id        TEXT UNIQUE NOT NULL,
    customer_id     TEXT,
    customer_phone  TEXT,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    order_total     INTEGER NOT NULL DEFAULT 0,
    tenant_id       TEXT NOT NULL DEFAULT 'default',
    redeemed_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_order ON promotion_redemptions(order_id);
CREATE INDEX IF NOT EXISTS idx_promotion_redemptions_code  ON promotion_redemptions(code, tenant_id);

CREATE TABLE IF NOT EXISTS promotion_usages (
    id              TEXT PRIMARY KEY,
    promotion_id    TEXT NOT NULL,
    customer_id     TEXT,
    order_id        TEXT UNIQUE,
    discount_amount REAL NOT NULL DEFAULT 0,
    tenant_id       TEXT NOT NULL DEFAULT 'default',
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Seed active discount codes
INSERT OR IGNORE INTO promotions (code, percent, max_discount, starts_at, expires_at, is_active, tenant_id) VALUES
    ('AURA20',  20, 50000, '2026-06-06T00:00:00Z', '2026-06-06T23:59:59Z', 1, 'default'),
    ('AURA10',  10, 30000, '2026-06-07T00:00:00Z', '2026-06-13T23:59:59Z', 1, 'default'),
    ('WELCOME', 10, 30000, NULL,                  NULL,                  1, 'default');

-- ─────────────────────────────────────────────
-- 9. STAFF SHIFTS (Chấm công)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_shifts (
    id           TEXT PRIMARY KEY,
    staff_email  TEXT NOT NULL,
    clock_in     TEXT NOT NULL,
    clock_out    TEXT,
    shift_type   TEXT,                         -- 'morning' | 'afternoon' | 'evening'
    notes        TEXT,
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_shifts_staff ON staff_shifts(staff_email);
CREATE INDEX IF NOT EXISTS idx_shifts_open  ON staff_shifts(clock_out);

-- ─────────────────────────────────────────────
-- 10. CATALOG MODIFIERS (Tuỳ chọn món)
-- ─────────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_mod_choices_group_avail ON modifier_choices(group_id, is_available);
CREATE INDEX IF NOT EXISTS idx_pm_groups_prod_grp ON product_modifier_groups(product_id, group_id);

-- ─────────────────────────────────────────────
-- 11. PAYMENT RECONCILIATION JOBS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_reconciliation_jobs (
    payment_id      TEXT PRIMARY KEY,
    next_attempt_at TEXT NOT NULL,
    lease_until     TEXT,
    lease_owner     TEXT,
    last_checked_at TEXT,
    last_outcome    TEXT,
    attempts        INTEGER NOT NULL DEFAULT 0,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_payment_reconcile_due
    ON payment_reconciliation_jobs(next_attempt_at, lease_until);


-- ─────────────────────────────────────────────
-- 12. CANONICAL PRODUCTION D1 PARITY TABLES & COLUMNS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS _alerts ( id INTEGER PRIMARY KEY AUTOINCREMENT, alert_key TEXT NOT NULL, message TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'warning', dispatched INTEGER NOT NULL DEFAULT 0, dispatched_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')) , value REAL, threshold REAL, resolved_at TEXT);
CREATE TABLE IF NOT EXISTS _metrics ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, value REAL NOT NULL DEFAULT 1, tags TEXT DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS ai_barista_interactions ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', customer_id TEXT, customer_phone TEXT, query_prompt TEXT, preferences_json TEXT, recommended_product_id TEXT NOT NULL, recommended_product_name TEXT NOT NULL, engine_used TEXT NOT NULL DEFAULT 'deterministic', feedback TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS ai_product_affinities ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', item_a TEXT NOT NULL, item_b TEXT NOT NULL, co_occurrence_count INTEGER NOT NULL DEFAULT 1, affinity_score REAL NOT NULL DEFAULT 0.0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS audit_logs ( id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT, actor_id TEXT, actor_name TEXT, user_id TEXT, action TEXT NOT NULL, resource TEXT, resource_type TEXT, resource_id TEXT, entity_type TEXT, entity_id TEXT, details TEXT, metadata TEXT, ip TEXT, ip_address TEXT, operating_unit_id TEXT, tenant_id TEXT DEFAULT 'default', status TEXT DEFAULT 'success', correlation_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS birthday_redemptions ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, discount_percent INTEGER NOT NULL DEFAULT 15, order_id TEXT, redeemed_at TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY (customer_id) REFERENCES customers(id) );
CREATE TABLE IF NOT EXISTS bonus_campaigns ( id TEXT PRIMARY KEY, code TEXT UNIQUE, name TEXT NOT NULL, description TEXT, type TEXT NOT NULL DEFAULT 'grand_opening', signup_bonus_vnd INTEGER NOT NULL DEFAULT 50000, signup_bonus_cap INTEGER NOT NULL DEFAULT 100, signup_bonus_claimed INTEGER NOT NULL DEFAULT 0, refer_bonus_vnd INTEGER NOT NULL DEFAULT 10000, max_cap_per_customer_vnd INTEGER NOT NULL DEFAULT 50000, cashback_multiplier REAL NOT NULL DEFAULT 1, min_order_for_bonus INTEGER NOT NULL DEFAULT 0, start_date TEXT, end_date TEXT, starts_at TEXT, ends_at TEXT, active INTEGER NOT NULL DEFAULT 1, is_active INTEGER NOT NULL DEFAULT 1, tenant_id TEXT NOT NULL DEFAULT 'default', created_at TEXT NOT NULL DEFAULT (datetime('now')) , auto_upgrade_tier TEXT, auto_upgrade_min_spend INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS campaign_configs ( trigger TEXT PRIMARY KEY, is_active INTEGER NOT NULL DEFAULT 1, channels TEXT NOT NULL DEFAULT '["sms"]', timing TEXT, updated_at DATETIME );
CREATE TABLE IF NOT EXISTS campaign_enrollments ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, campaign_type TEXT NOT NULL, campaign_id TEXT NOT NULL, mautic_contact_id TEXT, status TEXT NOT NULL DEFAULT 'enrolled', enrolled_at TEXT NOT NULL DEFAULT (datetime('now')), created_at TEXT NOT NULL DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS campaign_logs ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, trigger TEXT NOT NULL, trigger_type TEXT, channel TEXT NOT NULL, sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, created_at TEXT DEFAULT (datetime('now')), status TEXT NOT NULL DEFAULT 'sent', error TEXT, error_message TEXT );
CREATE TABLE IF NOT EXISTS cash_payouts ( id TEXT PRIMARY KEY, shift_id TEXT NOT NULL DEFAULT '', amount REAL NOT NULL DEFAULT 0, reason TEXT, status TEXT NOT NULL DEFAULT 'completed', created_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS cashback_transactions ( id TEXT PRIMARY KEY, wallet_id TEXT NOT NULL, customer_id TEXT, order_id TEXT, type TEXT NOT NULL, amount INTEGER NOT NULL, balance_after INTEGER NOT NULL, multiplier_applied REAL DEFAULT 1.0, description TEXT, campaign_id TEXT, expires_at TEXT, tenant_id TEXT NOT NULL DEFAULT 'default', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (wallet_id) REFERENCES cashback_wallets(id) );
CREATE TABLE IF NOT EXISTS cashback_wallets ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL UNIQUE, balance INTEGER DEFAULT 0, total_earned INTEGER DEFAULT 0, total_spent INTEGER DEFAULT 0, lifetime_earned INTEGER DEFAULT 0, lifetime_spent INTEGER DEFAULT 0, tier TEXT DEFAULT 'Member', tenant_id TEXT NOT NULL DEFAULT 'default', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES customers(id) );
CREATE TABLE IF NOT EXISTS category_stations (category_id TEXT NOT NULL, station_id TEXT NOT NULL, PRIMARY KEY (category_id, station_id));
CREATE TABLE IF NOT EXISTS checkins ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, customer_name TEXT, checkin_date TEXT NOT NULL, checkin_time TEXT NOT NULL, reward_amount INTEGER NOT NULL DEFAULT 5000, status TEXT NOT NULL DEFAULT 'pending', staff_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, streak INTEGER DEFAULT 1, points_earned INTEGER DEFAULT 10, tenant_id TEXT DEFAULT 'default', FOREIGN KEY (customer_id) REFERENCES customers(id) );
CREATE TABLE IF NOT EXISTS client_errors ( id TEXT PRIMARY KEY, route TEXT, message TEXT, stack TEXT, href TEXT, user_agent TEXT, ts TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS consents ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, purpose TEXT NOT NULL, granted INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL, policy_version TEXT NOT NULL DEFAULT 'v1', granted_at TEXT NOT NULL, revoked_at TEXT, updated_at TEXT, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES customers(id) );
CREATE TABLE IF NOT EXISTS contact_messages ( id TEXT PRIMARY KEY, tenant_id TEXT, classification TEXT CHECK (classification IN ('contact', 'chat')), name TEXT NOT NULL, phone TEXT, email TEXT, category TEXT, content TEXT NOT NULL, status TEXT DEFAULT 'unread', created_at DATETIME DEFAULT CURRENT_TIMESTAMP );
CREATE TABLE IF NOT EXISTS container_telemetry_logs ( id TEXT PRIMARY KEY, container_id TEXT NOT NULL, tenant_id TEXT NOT NULL DEFAULT 'default', power_source TEXT NOT NULL, battery_percentage REAL, ambient_temp_celsius REAL NOT NULL, kds_online INTEGER NOT NULL DEFAULT 1, network_ping_ms INTEGER DEFAULT 20, alert_status TEXT NOT NULL DEFAULT 'NORMAL', alert_message TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS cron_jobs ( id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, cron_expression TEXT NOT NULL, handler TEXT NOT NULL, payload TEXT, timeout_seconds INTEGER DEFAULT 300, max_retries INTEGER DEFAULT 3, retry_delay_seconds INTEGER DEFAULT 60, is_active INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'pending', location_id TEXT, last_run_at TEXT, next_run_at TEXT, success_count INTEGER DEFAULT 0, failure_count INTEGER DEFAULT 0, last_status TEXT, last_error TEXT, created_by TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS cron_runs ( id TEXT PRIMARY KEY, job_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'running', payload TEXT, started_at TEXT NOT NULL, completed_at TEXT, duration_ms INTEGER DEFAULT 0, attempt INTEGER DEFAULT 1, output TEXT, error TEXT, triggered_by TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS customer_events ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, event_type TEXT NOT NULL, payload TEXT, recorded_at TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES customers(id) );
CREATE TABLE IF NOT EXISTS customer_identities ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, identifier_type TEXT NOT NULL, identifier_value TEXT NOT NULL, type TEXT, value TEXT, is_primary INTEGER NOT NULL DEFAULT 0, verified_at TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES customers(id) );
CREATE TABLE IF NOT EXISTS customer_support_interactions ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', channel TEXT NOT NULL DEFAULT 'web', customer_phone TEXT, user_query TEXT NOT NULL, detected_intent TEXT NOT NULL, bot_response TEXT NOT NULL, engine_used TEXT NOT NULL DEFAULT 'deterministic', created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS dindin_cart ( session_id TEXT PRIMARY KEY, raw TEXT NOT NULL DEFAULT '{"items":[],"total":0}', cart TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS dindin_config ( id INTEGER PRIMARY KEY, config TEXT NOT NULL DEFAULT '{"menu":{"sections":[]},"settings":{}}', updated_at TEXT NOT NULL DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS dynamic_pricing_rules ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', name TEXT NOT NULL, rule_type TEXT NOT NULL, discount_percent REAL NOT NULL, target_category TEXT, target_product_id TEXT, min_margin_percent REAL NOT NULL DEFAULT 30.0, days_of_week TEXT NOT NULL DEFAULT '1,2,3,4,5', start_time TEXT NOT NULL, end_time TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS email_verifications ( id TEXT, user_id TEXT, email TEXT PRIMARY KEY, code TEXT NOT NULL, token TEXT, type TEXT DEFAULT 'verify', expires_at TEXT NOT NULL, verified INTEGER DEFAULT 0, used INTEGER DEFAULT 0, verified_at TEXT, attempts INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS erpnext_mappings ( id TEXT PRIMARY KEY, local_type TEXT NOT NULL, local_id TEXT NOT NULL, erpnext_id TEXT, erpnext_model TEXT, sync_status TEXT DEFAULT 'pending', attempts INTEGER DEFAULT 0, last_synced_at TEXT, created_at TEXT DEFAULT (datetime('now')) , error_message TEXT, updated_at TEXT, aura_order_id TEXT, erpnext_invoice_id TEXT);
CREATE TABLE IF NOT EXISTS erpnext_product_sync (product_id TEXT PRIMARY KEY, erpnext_product_id INTEGER NOT NULL, last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, erpnext_write_date TEXT, cached_stock INTEGER, cached_price REAL, erpnext_item_code TEXT, erpnext_modified TEXT);
CREATE TABLE IF NOT EXISTS erpnext_sync_log ( id TEXT PRIMARY KEY, method TEXT NOT NULL DEFAULT 'POST', endpoint TEXT NOT NULL, request_body TEXT, response_body TEXT, error TEXT, status TEXT NOT NULL DEFAULT 'pending', retry_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS erpnext_sync_logs ( id TEXT PRIMARY KEY, method TEXT NOT NULL DEFAULT 'POST', endpoint TEXT NOT NULL, request_body TEXT, response_body TEXT, error TEXT, latency_ms INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', retry_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT (datetime('now')) , mapping_id INTEGER, attempt INTEGER, error_message TEXT);
CREATE TABLE IF NOT EXISTS erpnext_sync_queue ( id INTEGER PRIMARY KEY AUTOINCREMENT, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, erpnext_id TEXT, action TEXT NOT NULL, payload TEXT NOT NULL, status TEXT DEFAULT 'pending', error_message TEXT, attempts INTEGER DEFAULT 0, next_retry_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS erpnext_webhook_log ( id INTEGER PRIMARY KEY AUTOINCREMENT, doctype TEXT NOT NULL, docname TEXT NOT NULL, action TEXT NOT NULL, payload TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS expenses ( id TEXT PRIMARY KEY, amount REAL NOT NULL DEFAULT 0, category TEXT NOT NULL, date TEXT NOT NULL, description TEXT, erpnext_id TEXT, sync_status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS franchise_locations ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, address TEXT, city TEXT DEFAULT 'Sa Đéc', phone TEXT, royalty_percentage REAL DEFAULT 5.0, status TEXT DEFAULT 'active', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS frigate_events ( id TEXT PRIMARY KEY, camera TEXT NOT NULL, label TEXT NOT NULL, start_time REAL NOT NULL, end_time REAL, score REAL, payload TEXT, received_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS ha_automation_log ( id INTEGER PRIMARY KEY AUTOINCREMENT, automation_id TEXT NOT NULL, trigger_entity TEXT, payload TEXT, result TEXT, executed_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS ha_device_states ( id INTEGER PRIMARY KEY AUTOINCREMENT, entity_id TEXT NOT NULL UNIQUE, state TEXT NOT NULL, attributes TEXT, last_changed TEXT DEFAULT (datetime('now')), last_updated TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS happy_hour_windows (id TEXT PRIMARY KEY, name TEXT NOT NULL, day_of_week INTEGER NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, discount_rate REAL NOT NULL DEFAULT 0, apply_to TEXT NOT NULL DEFAULT 'all', apply_ids TEXT, priority INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS ingredients ( id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT UNIQUE NOT NULL, category TEXT NOT NULL DEFAULT 'raw_materials', unit TEXT NOT NULL DEFAULT 'pcs', cost_per_unit REAL DEFAULT 0, current_stock REAL NOT NULL DEFAULT 0, min_stock REAL NOT NULL DEFAULT 0, max_stock REAL NOT NULL DEFAULT 1000, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) , supplier_id TEXT, last_restocked_at TEXT);
CREATE TABLE IF NOT EXISTS inventory_forecast_snapshots ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', item_sku TEXT NOT NULL, item_name TEXT NOT NULL, daily_run_rate REAL NOT NULL DEFAULT 0, current_stock REAL NOT NULL DEFAULT 0, days_of_supply REAL NOT NULL DEFAULT 0, risk_level TEXT NOT NULL DEFAULT 'healthy', suggested_reorder_qty REAL NOT NULL DEFAULT 0, lead_time_days INTEGER NOT NULL DEFAULT 2, snapshot_date TEXT DEFAULT (date('now')), ai_summary TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS inventory_items ( id TEXT PRIMARY KEY, sku TEXT UNIQUE NOT NULL, tenant_id TEXT NOT NULL DEFAULT 'default', name TEXT NOT NULL, name_en TEXT, category TEXT NOT NULL DEFAULT 'raw_materials', unit TEXT NOT NULL DEFAULT 'pcs', current_stock REAL NOT NULL DEFAULT 0, min_stock REAL NOT NULL DEFAULT 0, max_stock REAL NOT NULL DEFAULT 1000, cost_per_unit REAL DEFAULT 0, supplier TEXT, active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) , reorder_point REAL DEFAULT 10, location TEXT DEFAULT 'main', expiry_date TEXT, supplier_id TEXT, unit_cost REAL DEFAULT 0, is_active INTEGER DEFAULT 1, last_restocked_at TEXT);
CREATE TABLE IF NOT EXISTS inventory_snapshots ( id TEXT PRIMARY KEY, item_id TEXT NOT NULL, date TEXT NOT NULL DEFAULT (date('now')), opening_stock REAL NOT NULL, closing_stock REAL NOT NULL, created_at TEXT, FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS inventory_transactions ( id TEXT PRIMARY KEY, item_id TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('in', 'out', 'adjust', 'waste', 'reserve', 'release')), quantity REAL NOT NULL, reference_id TEXT, reference_type TEXT CHECK(reference_type IN ('order', 'purchase', 'adjustment', 'waste_report', 'sync')), notes TEXT, created_at TEXT DEFAULT (datetime('now')), previous_stock REAL DEFAULT 0, new_stock REAL DEFAULT 0, unit_cost REAL DEFAULT 0, reason TEXT, performed_by TEXT, inventory_item_id TEXT, staff_id TEXT, FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS kds_stations (id TEXT PRIMARY KEY, name TEXT NOT NULL, categories TEXT NOT NULL DEFAULT '[]', is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS kitchen_stations (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS loyalty_accounts ( id TEXT PRIMARY KEY, customer_id TEXT UNIQUE NOT NULL, current_points INTEGER NOT NULL DEFAULT 0, points_balance INTEGER DEFAULT 0, lifetime_points INTEGER DEFAULT 0, tier TEXT DEFAULT 'bronze', tier_expires_at TEXT, streak_days INTEGER DEFAULT 0, last_checkin_date TEXT, order_count INTEGER DEFAULT 0, total_spent REAL DEFAULT 0, total_orders INTEGER DEFAULT 0, referral_code TEXT, referred_by TEXT, last_activity_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS loyalty_audit_log ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, staff_id TEXT, action TEXT, event_type TEXT NOT NULL DEFAULT 'audit', amount_vnd INTEGER NOT NULL DEFAULT 0, metadata TEXT, points_delta INTEGER NOT NULL DEFAULT 0, points_after INTEGER NOT NULL DEFAULT 0, cashback_delta INTEGER NOT NULL DEFAULT 0, cashback_after INTEGER NOT NULL DEFAULT 0, tier_before TEXT, tier_after TEXT, order_id TEXT, campaign_id TEXT, note TEXT, actor TEXT, tenant_id TEXT NOT NULL DEFAULT 'default', created_at TEXT NOT NULL DEFAULT (datetime('now')) , ip_address TEXT, user_agent TEXT);
CREATE TABLE IF NOT EXISTS loyalty_point_logs ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, order_id TEXT, points_change INTEGER NOT NULL, points INTEGER DEFAULT 0, reason TEXT, balance_after INTEGER NOT NULL, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES customers(id) );
CREATE TABLE IF NOT EXISTS loyalty_redemptions ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, reward_id TEXT NOT NULL, code TEXT, points_spent INTEGER NOT NULL DEFAULT 0, order_id TEXT, status TEXT DEFAULT 'active', voucher_code TEXT, expires_at TEXT, redeemed_at TEXT DEFAULT (datetime('now')), used_at TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS loyalty_rewards ( id TEXT PRIMARY KEY, name TEXT NOT NULL, name_en TEXT, description TEXT, points_cost INTEGER NOT NULL DEFAULT 100, points_required INTEGER NOT NULL DEFAULT 100, type TEXT NOT NULL DEFAULT 'voucher', reward_type TEXT NOT NULL DEFAULT 'voucher', value REAL DEFAULT 0, reward_value TEXT DEFAULT '0', menu_item_id TEXT, min_tier TEXT DEFAULT 'bronze', max_redemptions INTEGER, stock INTEGER, current_redemptions INTEGER DEFAULT 0, redeemed_count INTEGER DEFAULT 0, valid_from TEXT, valid_to TEXT, valid_until TEXT, image_url TEXT, terms TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS loyalty_tier_configs ( tier TEXT PRIMARY KEY, name TEXT NOT NULL, min_points INTEGER NOT NULL DEFAULT 0, max_points INTEGER, point_multiplier REAL NOT NULL DEFAULT 1.0, points_multiplier REAL NOT NULL DEFAULT 1.0, discount_percent REAL DEFAULT 0, birthday_bonus INTEGER DEFAULT 500, free_shipping INTEGER DEFAULT 0, priority_support INTEGER DEFAULT 0, benefits TEXT DEFAULT '[]', color TEXT, icon TEXT, updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS loyalty_tiers ( tier_name TEXT PRIMARY KEY, min_points INTEGER NOT NULL, cashback_rate REAL NOT NULL DEFAULT 0.02, point_multiplier REAL NOT NULL DEFAULT 1.0, birthday_discount INTEGER DEFAULT 0, display_name_vi TEXT, min_spent_vnd INTEGER DEFAULT 0, max_spent_vnd INTEGER, expiry_days INTEGER, sort_order INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')) , points_multiplier REAL DEFAULT 1.0, perks TEXT DEFAULT '[]', color TEXT DEFAULT '#CD7F32', updated_at TEXT);
CREATE TABLE IF NOT EXISTS loyalty_transactions ( id TEXT PRIMARY KEY, account_id TEXT, customer_id TEXT, type TEXT NOT NULL, points INTEGER NOT NULL DEFAULT 0, balance_after INTEGER NOT NULL DEFAULT 0, order_id TEXT, reward_id TEXT, description TEXT, reason TEXT, idempotency_key TEXT, created_by TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS menu_modifiers (id TEXT PRIMARY KEY, group_id TEXT NOT NULL, option_name TEXT NOT NULL, price_delta INTEGER NOT NULL DEFAULT 0, available INTEGER NOT NULL DEFAULT 1, updated_at TEXT DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS mixpost_posts ( id INTEGER PRIMARY KEY AUTOINCREMENT, content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', platforms TEXT DEFAULT '[]', media_urls TEXT DEFAULT '[]', source TEXT DEFAULT 'manual', scheduled_at TEXT, published_at TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS mixpost_templates ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, content_template TEXT NOT NULL, accounts TEXT DEFAULT '[]', schedule_cron TEXT NOT NULL DEFAULT '* *', is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS mrr_snapshots ( id TEXT PRIMARY KEY, snapshot_date TEXT NOT NULL UNIQUE, mrr_vnd INTEGER NOT NULL DEFAULT 0, arr_vnd INTEGER NOT NULL DEFAULT 0, active_subscriptions INTEGER NOT NULL DEFAULT 0, new_subscriptions_month INTEGER NOT NULL DEFAULT 0, churned_subscriptions_month INTEGER NOT NULL DEFAULT 0, expansion_mrr_vnd INTEGER DEFAULT 0, contraction_mrr_vnd INTEGER DEFAULT 0, churn_rate_pct REAL DEFAULT 0, avg_contract_value_vnd INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')) , by_zone TEXT DEFAULT '{}', by_plan TEXT DEFAULT '{}');
CREATE TABLE IF NOT EXISTS notification_audit_log ( id TEXT PRIMARY KEY, order_id TEXT, customer_id TEXT, channel TEXT NOT NULL, recipient TEXT, phone TEXT, template TEXT, template_id TEXT, template_key TEXT, message_type TEXT, data TEXT, payload TEXT, response TEXT, provider_response TEXT, error TEXT, error_message TEXT, retry_count INTEGER DEFAULT 0, event_id TEXT, idempotency_key TEXT, correlation_id TEXT, provider TEXT, latency_ms INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'pending', sent_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS notifications ( id TEXT PRIMARY KEY, user_id TEXT NOT NULL, type TEXT DEFAULT 'info', title_vi TEXT NOT NULL, title_en TEXT NOT NULL, body_vi TEXT, body_en TEXT, data TEXT DEFAULT '{}', read_at TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS order_item_stations (order_item_id TEXT NOT NULL, station_id TEXT NOT NULL, started_at TEXT, ready_at TEXT, PRIMARY KEY (order_item_id, station_id));
CREATE TABLE IF NOT EXISTS payment_transactions ( id TEXT PRIMARY KEY, payment_id TEXT, order_id TEXT NOT NULL, provider TEXT NOT NULL DEFAULT 'cash', method TEXT DEFAULT 'payos', amount REAL NOT NULL DEFAULT 0, currency TEXT DEFAULT 'VND', status TEXT NOT NULL DEFAULT 'pending', transaction_id TEXT, transaction_ref TEXT, gateway_response TEXT, raw_payload TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS pretix_webhook_log ( id INTEGER PRIMARY KEY AUTOINCREMENT, notification_id INTEGER, organizer TEXT NOT NULL DEFAULT '', event TEXT NOT NULL DEFAULT '', code TEXT NOT NULL, action TEXT NOT NULL, payload TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS purchase_order_items ( id TEXT PRIMARY KEY, purchase_order_id TEXT NOT NULL, ingredient_id TEXT NOT NULL, quantity REAL NOT NULL, unit_price REAL NOT NULL, total_price REAL NOT NULL, received_quantity REAL DEFAULT 0, unit TEXT DEFAULT 'g', po_id TEXT, unit_cost REAL DEFAULT 0, created_at TEXT, FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE, FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT );
CREATE TABLE IF NOT EXISTS purchase_orders ( id TEXT PRIMARY KEY, po_number TEXT UNIQUE NOT NULL, supplier_id TEXT NOT NULL, order_date TEXT NOT NULL, expected_delivery_date TEXT, status TEXT NOT NULL DEFAULT 'draft', subtotal REAL NOT NULL DEFAULT 0, tax REAL NOT NULL DEFAULT 0, shipping REAL NOT NULL DEFAULT 0, total REAL NOT NULL DEFAULT 0, notes TEXT, created_by TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')), expected_date TEXT, total_amount REAL DEFAULT 0, received_date TEXT, total_cost REAL DEFAULT 0, expected_delivery TEXT, received_at TEXT, approved_by TEXT, received_by TEXT, FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE RESTRICT );
CREATE TABLE IF NOT EXISTS push_subscriptions ( id TEXT PRIMARY KEY, customer_id TEXT, endpoint TEXT NOT NULL UNIQUE, auth_key TEXT NOT NULL, p256dh_key TEXT NOT NULL, user_agent TEXT, role TEXT NOT NULL DEFAULT 'customer', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) , last_used_at TEXT, device_id TEXT, user_id TEXT);
CREATE TABLE IF NOT EXISTS recipe_ingredients ( id TEXT PRIMARY KEY, recipe_id TEXT NOT NULL, product_id TEXT, ingredient_id TEXT NOT NULL, item_id TEXT, quantity REAL NOT NULL DEFAULT 0, unit TEXT DEFAULT 'g', waste_percentage REAL DEFAULT 0, notes TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS recipe_items ( id TEXT PRIMARY KEY, recipe_id TEXT NOT NULL, ingredient_id TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL DEFAULT 'g', FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE, FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE RESTRICT );
CREATE TABLE IF NOT EXISTS recipes ( id TEXT PRIMARY KEY, product_id TEXT NOT NULL, item_id TEXT, ingredient_id TEXT, quantity REAL DEFAULT 0, name TEXT, instructions TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) , is_active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS recruitment_applications ( id TEXT PRIMARY KEY, tenant_id TEXT, full_name TEXT NOT NULL, phone TEXT NOT NULL, birth_year TEXT, position TEXT NOT NULL DEFAULT 'barista', shifts TEXT NOT NULL DEFAULT '[]', experience TEXT DEFAULT 'none', note TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP );
CREATE TABLE IF NOT EXISTS referral_codes ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL UNIQUE, code TEXT NOT NULL UNIQUE, times_used INTEGER DEFAULT 0, uses_count INTEGER DEFAULT 0, max_uses INTEGER DEFAULT 50, total_points_earned INTEGER DEFAULT 0, total_cashback_earned_vnd INTEGER DEFAULT 0, tenant_id TEXT NOT NULL DEFAULT 'default', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (customer_id) REFERENCES customers(id) );
CREATE TABLE IF NOT EXISTS referrals ( id TEXT PRIMARY KEY, referrer_id TEXT NOT NULL, referred_customer_id TEXT, referee_id TEXT, referral_code TEXT NOT NULL, points_awarded INTEGER DEFAULT 200, cashback_awarded_vnd INTEGER DEFAULT 0, referrer_reward INTEGER DEFAULT 10000, referee_reward INTEGER DEFAULT 5000, first_order_id TEXT, first_order_amount REAL, bonus_type TEXT DEFAULT 'cashback', reward_paid_at TEXT, rewarded_at TEXT, status TEXT DEFAULT 'pending', tenant_id TEXT NOT NULL DEFAULT 'default', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, referrer_customer_id TEXT, referee_customer_id TEXT, referrer_bonus_vnd INTEGER DEFAULT 0, referee_bonus_vnd INTEGER DEFAULT 0, FOREIGN KEY (referrer_id) REFERENCES customers(id), FOREIGN KEY (referred_customer_id) REFERENCES customers(id) );
CREATE TABLE IF NOT EXISTS resource_creation_requests ( scope_key TEXT PRIMARY KEY, request_hash TEXT NOT NULL, resource_id TEXT NOT NULL, resource_type TEXT NOT NULL CHECK(resource_type IN ('customer', 'recruitment')), tenant_id TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS reviews ( id TEXT PRIMARY KEY, order_id TEXT, customer_id TEXT, customer_name TEXT NOT NULL, rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), comment TEXT DEFAULT '', content TEXT NOT NULL DEFAULT '', tags TEXT DEFAULT '[]', status TEXT DEFAULT 'published', is_approved INTEGER DEFAULT 1, is_visible INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP );
CREATE TABLE IF NOT EXISTS saas_pricing ( id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name_vi TEXT NOT NULL, name_en TEXT NOT NULL, description_vi TEXT, description_en TEXT, price_vnd INTEGER NOT NULL, price_usd REAL, currency TEXT NOT NULL DEFAULT 'VND', billing_period TEXT NOT NULL DEFAULT 'monthly', sort_order INTEGER NOT NULL DEFAULT 0, is_recommended INTEGER NOT NULL DEFAULT 0, features_vi TEXT NOT NULL DEFAULT '[]', features_en TEXT NOT NULL DEFAULT '[]', cta_text_vi TEXT NOT NULL DEFAULT 'Bắt đầu', cta_text_en TEXT NOT NULL DEFAULT 'Get Started', cta_link TEXT NOT NULL DEFAULT '/register', active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS saas_tenants ( id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT, tier TEXT NOT NULL DEFAULT 'BASIC', status TEXT NOT NULL DEFAULT 'trial', owner_user_id TEXT, trial_ends_at TEXT, current_period_end TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS sessions ( id TEXT PRIMARY KEY, user_id TEXT NOT NULL, token_hash TEXT NOT NULL DEFAULT '', refresh_token_hash TEXT NOT NULL DEFAULT '', access_token TEXT, refresh_token TEXT, is_trusted_device INTEGER NOT NULL DEFAULT 0, device_fingerprint TEXT, device_name TEXT, device_info TEXT, ip_address TEXT, expires_at TEXT NOT NULL, last_used_at TEXT, last_active_at TEXT DEFAULT (datetime('now')), created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS shift_reconciliations ( id TEXT PRIMARY KEY, shift_id TEXT NOT NULL, staff_id TEXT NOT NULL DEFAULT '', opening_float REAL NOT NULL DEFAULT 0, opening_cash REAL NOT NULL DEFAULT 0, cash_sales REAL NOT NULL DEFAULT 0, cash_refunds REAL NOT NULL DEFAULT 0, paid_outs REAL NOT NULL DEFAULT 0, expected_cash REAL NOT NULL DEFAULT 0, actual_cash REAL NOT NULL DEFAULT 0, variance REAL NOT NULL DEFAULT 0, variance_amount REAL NOT NULL DEFAULT 0, variance_pct REAL NOT NULL DEFAULT 0, variance_status TEXT NOT NULL DEFAULT 'balanced', status TEXT NOT NULL DEFAULT 'balanced', denominations TEXT NOT NULL DEFAULT '{}', cash_payment_total REAL NOT NULL DEFAULT 0, cash_payout_total REAL NOT NULL DEFAULT 0, notes TEXT, reconciled_by TEXT DEFAULT '', approved_by TEXT, reconciled_at TEXT NOT NULL DEFAULT (datetime('now')), created_at TEXT NOT NULL DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS signup_bonus_log ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, campaign_id TEXT NOT NULL, bonus_vnd INTEGER NOT NULL DEFAULT 0, amount_vnd INTEGER NOT NULL DEFAULT 0, wallet_tx_id TEXT, phone TEXT, ip_hint TEXT, tenant_id TEXT NOT NULL DEFAULT 'default', granted_at TEXT NOT NULL DEFAULT (datetime('now')), UNIQUE(customer_id, campaign_id) );
CREATE TABLE IF NOT EXISTS sop_reminders ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', template_id TEXT NOT NULL, kind TEXT NOT NULL, day_key TEXT NOT NULL, run_id TEXT, staff_id TEXT, staff_name TEXT, sent_at TEXT NOT NULL, acknowledged_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS sop_run_items ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', run_id TEXT NOT NULL, template_item_id TEXT NOT NULL, is_checked INTEGER NOT NULL DEFAULT 0, checked_at TEXT, checked_by TEXT, note TEXT, value REAL, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS sop_runs ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', template_id TEXT NOT NULL, template_version INTEGER NOT NULL, shift_id TEXT, staff_id TEXT NOT NULL, staff_name TEXT, shift_type TEXT NOT NULL DEFAULT 'any', status TEXT NOT NULL DEFAULT 'in_progress', scheduled_date TEXT, started_at TEXT NOT NULL, completed_at TEXT, abandoned_reason TEXT, reminder_sent_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS sop_template_items ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', template_id TEXT NOT NULL, label TEXT NOT NULL, description TEXT, order_index INTEGER NOT NULL DEFAULT 0, is_critical INTEGER NOT NULL DEFAULT 0, requires_note INTEGER NOT NULL DEFAULT 0, requires_value INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS sop_templates ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', code TEXT NOT NULL, title TEXT NOT NULL, description TEXT, source TEXT NOT NULL DEFAULT 'SOP01', shift_type TEXT NOT NULL DEFAULT 'any', applicable_roles TEXT NOT NULL DEFAULT 'owner,manager,staff', version INTEGER NOT NULL DEFAULT 1, is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS sop_violations ( id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL DEFAULT 'default', staff_id TEXT NOT NULL, staff_name TEXT, category TEXT NOT NULL, is_serious INTEGER NOT NULL DEFAULT 0, description TEXT, occurred_at TEXT, recorded_by TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'recorded', discipline_step TEXT, confirmed_by TEXT, confirmed_at TEXT, applied_by TEXT, applied_at TEXT, appeal_explanation TEXT, audit_log_id TEXT, closed_at TEXT, sanction_note TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS stock_movements ( id TEXT PRIMARY KEY, ingredient_id TEXT NOT NULL, type TEXT NOT NULL, quantity REAL NOT NULL, reference_id TEXT, reference_type TEXT, notes TEXT, created_by TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS subscription_invoices ( id TEXT PRIMARY KEY, subscription_id TEXT NOT NULL REFERENCES subscriptions(id), amount_vnd INTEGER NOT NULL, currency TEXT NOT NULL DEFAULT 'VND', status TEXT NOT NULL DEFAULT 'pending', period_start TEXT NOT NULL, period_end TEXT NOT NULL, invoice_number TEXT UNIQUE, paid_at TEXT, payment_method TEXT, payment_ref TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS subscription_plans ( id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT DEFAULT '', container_size TEXT NOT NULL DEFAULT 'standard', monthly_price_vnd INTEGER NOT NULL, deposit_vnd INTEGER DEFAULT 0, features TEXT DEFAULT '[]', max_occupants INTEGER DEFAULT 1, is_popular INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS subscriptions ( id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES subscription_plans(id), customer_id TEXT, customer_name TEXT NOT NULL, customer_email TEXT NOT NULL, customer_phone TEXT NOT NULL, container_number TEXT, zone TEXT NOT NULL DEFAULT 'indoor', status TEXT NOT NULL DEFAULT 'active', billing_cycle TEXT DEFAULT 'monthly', current_period_start TEXT NOT NULL, current_period_end TEXT NOT NULL, next_billing_date TEXT NOT NULL, amount_vnd INTEGER NOT NULL, deposit_paid INTEGER DEFAULT 0, deposit_vnd INTEGER DEFAULT 0, notes TEXT DEFAULT '', cancelled_at TEXT, cancellation_reason TEXT, paused_at TEXT, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS suppliers ( id TEXT PRIMARY KEY, name TEXT NOT NULL, contact_person TEXT, email TEXT, phone TEXT, address TEXT, tax_id TEXT, payment_terms TEXT, is_active INTEGER NOT NULL DEFAULT 1, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) , notes TEXT);
CREATE TABLE IF NOT EXISTS table_qr_codes ( id INTEGER PRIMARY KEY AUTOINCREMENT, table_id INTEGER NOT NULL UNIQUE, slug TEXT NOT NULL UNIQUE, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS table_sessions (id TEXT PRIMARY KEY, table_id TEXT NOT NULL, customer_id TEXT, customer_name TEXT, customer_phone TEXT, status TEXT NOT NULL DEFAULT 'active', opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, closed_at DATETIME, order_count INTEGER NOT NULL DEFAULT 0, total_amount INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, order_id TEXT, current_order_id TEXT, started_at TEXT, ended_at TEXT);
CREATE TABLE IF NOT EXISTS table_zones ( id TEXT PRIMARY KEY, slug TEXT NOT NULL, name TEXT NOT NULL, description TEXT, sort_order INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1, location_id TEXT DEFAULT 'default', tenant_id TEXT DEFAULT 'default', metadata TEXT DEFAULT '{}', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS ti_menu_cache ( id TEXT PRIMARY KEY, name TEXT NOT NULL, sku TEXT, price REAL DEFAULT 0, active INTEGER DEFAULT 1, cached_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS ti_order_bridge ( id TEXT PRIMARY KEY, local_order_id TEXT NOT NULL, ti_order_id TEXT, status TEXT NOT NULL, error TEXT, synced_at TEXT, created_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS tier_configs ( tier TEXT PRIMARY KEY, tier_name TEXT, min_points INTEGER NOT NULL DEFAULT 0, cashback_rate REAL NOT NULL DEFAULT 0.02, multiplier REAL NOT NULL DEFAULT 1.0, point_multiplier REAL NOT NULL DEFAULT 1.0, points_multiplier REAL NOT NULL DEFAULT 1.0, birthday_discount INTEGER DEFAULT 0, benefits TEXT DEFAULT '[]', perks TEXT DEFAULT '[]', color TEXT DEFAULT '#CD7F32', display_name_vi TEXT, min_spent_vnd INTEGER NOT NULL DEFAULT 0, max_spent_vnd INTEGER, expiry_days INTEGER DEFAULT 90, sort_order INTEGER NOT NULL DEFAULT 0, created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')) );
CREATE TABLE IF NOT EXISTS trusted_devices ( id TEXT PRIMARY KEY, user_id TEXT NOT NULL, device_id TEXT, device_name TEXT, fingerprint TEXT, name TEXT, platform TEXT, browser TEXT, ip TEXT, is_trusted INTEGER NOT NULL DEFAULT 1, trusted_at TEXT DEFAULT (datetime('now')), last_used_at TEXT DEFAULT (datetime('now')), created_at TEXT DEFAULT (datetime('now')), expires_at TEXT, UNIQUE(user_id, device_id) );
CREATE TABLE IF NOT EXISTS user_rewards ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, reward_id TEXT NOT NULL, code TEXT NOT NULL, status TEXT DEFAULT 'active', expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, redeemed_at TEXT, FOREIGN KEY (customer_id) REFERENCES customers(id), FOREIGN KEY (reward_id) REFERENCES rewards(id) );
CREATE TABLE IF NOT EXISTS visits ( id TEXT PRIMARY KEY, customer_id TEXT NOT NULL, visited_at TEXT NOT NULL, channel TEXT NOT NULL DEFAULT 'in_store', order_id TEXT, spent INTEGER, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, table_id TEXT, amount REAL DEFAULT 0, points_earned INTEGER DEFAULT 0, FOREIGN KEY (customer_id) REFERENCES customers(id) );
CREATE TABLE IF NOT EXISTS waste_log ( id TEXT PRIMARY KEY, ingredient_id TEXT NOT NULL, quantity REAL NOT NULL, unit TEXT NOT NULL, reason TEXT NOT NULL, recorded_by TEXT, notes TEXT, created_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE );
CREATE TABLE IF NOT EXISTS wifi_sessions ( id TEXT PRIMARY KEY, client_mac TEXT NOT NULL, ip_address TEXT, phone TEXT, customer_id TEXT, status TEXT NOT NULL, session_timeout INTEGER DEFAULT 3600, authorized_at TEXT DEFAULT (datetime('now')), expires_at TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now')) );
ALTER TABLE cafe_tables ADD COLUMN code TEXT;
ALTER TABLE cafe_tables ADD COLUMN name TEXT;
ALTER TABLE cafe_tables ADD COLUMN min_capacity INTEGER DEFAULT 1;
ALTER TABLE cafe_tables ADD COLUMN zone_id TEXT;
ALTER TABLE cafe_tables ADD COLUMN shape TEXT DEFAULT 'square';
ALTER TABLE cafe_tables ADD COLUMN position_x REAL DEFAULT 0;
ALTER TABLE cafe_tables ADD COLUMN position_y REAL DEFAULT 0;
ALTER TABLE cafe_tables ADD COLUMN width REAL DEFAULT 80;
ALTER TABLE cafe_tables ADD COLUMN height REAL DEFAULT 80;
ALTER TABLE cafe_tables ADD COLUMN rotation REAL DEFAULT 0;
ALTER TABLE cafe_tables ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE cafe_tables ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE cafe_tables ADD COLUMN location_id TEXT DEFAULT 'default';
ALTER TABLE cafe_tables ADD COLUMN current_session_id TEXT;
ALTER TABLE cafe_tables ADD COLUMN qr_code TEXT;
ALTER TABLE cafe_tables ADD COLUMN metadata TEXT DEFAULT '{}';
ALTER TABLE cafe_tables ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE cafe_tables ADD COLUMN seats INTEGER DEFAULT 4;
ALTER TABLE cafe_tables ADD COLUMN notes TEXT;
ALTER TABLE cafe_tables ADD COLUMN current_order_id TEXT;
ALTER TABLE categories ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE categories ADD COLUMN location_id TEXT;
ALTER TABLE customers ADD COLUMN signup_bonus_claimed INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN last_expiry_warning_at TEXT;
ALTER TABLE customers ADD COLUMN cashback_balance REAL DEFAULT 0;
ALTER TABLE customers ADD COLUMN visit_count INTEGER DEFAULT 0;
ALTER TABLE customers ADD COLUMN last_ip TEXT;
ALTER TABLE customers ADD COLUMN tax_id TEXT;
ALTER TABLE customers ADD COLUMN erpnext_id TEXT;
ALTER TABLE customers ADD COLUMN sync_status TEXT DEFAULT 'pending';
ALTER TABLE customers ADD COLUMN erpnext_last_synced TEXT;
ALTER TABLE menu_items ADD COLUMN name_en TEXT;
ALTER TABLE menu_items ADD COLUMN sort_order INTEGER DEFAULT 0;
ALTER TABLE order_items ADD COLUMN status TEXT DEFAULT 'pending';
ALTER TABLE order_items ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE orders ADD COLUMN order_number TEXT;
ALTER TABLE orders ADD COLUMN total_cents INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN tax_amount REAL DEFAULT 0;
ALTER TABLE orders ADD COLUMN happy_hour_applied INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN channel TEXT DEFAULT 'dine_in';
ALTER TABLE orders ADD COLUMN source TEXT DEFAULT 'pos';
ALTER TABLE orders ADD COLUMN placed_at TEXT;
ALTER TABLE orders ADD COLUMN served_at TEXT;
ALTER TABLE orders ADD COLUMN completed_at TEXT;
ALTER TABLE orders ADD COLUMN cancelled_at TEXT;
ALTER TABLE orders ADD COLUMN reward_code_used TEXT;
ALTER TABLE orders ADD COLUMN staff_id TEXT;
ALTER TABLE orders ADD COLUMN table_number INTEGER;
ALTER TABLE orders ADD COLUMN is_cod INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN fulfillment_type TEXT DEFAULT 'dine_in';
ALTER TABLE orders ADD COLUMN delivery_address TEXT;
ALTER TABLE orders ADD COLUMN promo_code TEXT;
ALTER TABLE orders ADD COLUMN promotion_code TEXT;
ALTER TABLE orders ADD COLUMN discount_amount INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN loyalty_points_awarded INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN loyalty_reversal_at TEXT;
ALTER TABLE payments ADD COLUMN payment_method TEXT;
ALTER TABLE products ADD COLUMN available BOOLEAN DEFAULT 1;
ALTER TABLE products ADD COLUMN category TEXT;
ALTER TABLE promotion_redemptions ADD COLUMN created_at TEXT DEFAULT (datetime('now'));
ALTER TABLE promotion_usages ADD COLUMN idempotency_key TEXT;
ALTER TABLE promotion_usages ADD COLUMN used_at TEXT;
ALTER TABLE promotions ADD COLUMN id TEXT;
ALTER TABLE promotions ADD COLUMN name TEXT;
ALTER TABLE promotions ADD COLUMN type TEXT DEFAULT 'percent';
ALTER TABLE promotions ADD COLUMN value REAL;
ALTER TABLE promotions ADD COLUMN applicable_items TEXT;
ALTER TABLE promotions ADD COLUMN applicable_tiers TEXT;
ALTER TABLE promotions ADD COLUMN description TEXT;
ALTER TABLE promotions ADD COLUMN discount_value REAL DEFAULT 0;
ALTER TABLE promotions ADD COLUMN discount_type TEXT DEFAULT 'percentage';
ALTER TABLE promotions ADD COLUMN max_uses INTEGER;
ALTER TABLE promotions ADD COLUMN current_uses INTEGER DEFAULT 0;
ALTER TABLE promotions ADD COLUMN used_count INTEGER DEFAULT 0;
ALTER TABLE promotions ADD COLUMN min_order_value REAL DEFAULT 0;
ALTER TABLE promotions ADD COLUMN max_discount_value REAL;
ALTER TABLE promotions ADD COLUMN valid_from TEXT;
ALTER TABLE promotions ADD COLUMN valid_to TEXT;
ALTER TABLE promotions ADD COLUMN excluded_items TEXT;
ALTER TABLE promotions ADD COLUMN updated_at TEXT;
ALTER TABLE promotions ADD COLUMN start_date TEXT;
ALTER TABLE promotions ADD COLUMN end_date TEXT;
ALTER TABLE reservations ADD COLUMN customer_phone TEXT;
ALTER TABLE reservations ADD COLUMN guest_count INTEGER DEFAULT 2;
ALTER TABLE reservations ADD COLUMN date TEXT;
ALTER TABLE reservations ADD COLUMN time TEXT;
ALTER TABLE reservations ADD COLUMN zone TEXT;
ALTER TABLE reservations ADD COLUMN notes TEXT;
ALTER TABLE reservations ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE reservations ADD COLUMN tenant_id TEXT DEFAULT 'default';
ALTER TABLE reservations ADD COLUMN cal_booking_uid TEXT;
ALTER TABLE reservations ADD COLUMN customer_email TEXT;
ALTER TABLE reservations ADD COLUMN special_requests TEXT;
ALTER TABLE rewards ADD COLUMN description TEXT;
ALTER TABLE rewards ADD COLUMN min_order INTEGER DEFAULT 0;
ALTER TABLE rewards ADD COLUMN image_url TEXT;
ALTER TABLE rewards ADD COLUMN stock INTEGER DEFAULT -1;
ALTER TABLE rewards ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE rewards ADD COLUMN name TEXT;
ALTER TABLE rewards ADD COLUMN points_cost INTEGER DEFAULT 100;
ALTER TABLE rewards ADD COLUMN type TEXT DEFAULT 'fixed';
ALTER TABLE rewards ADD COLUMN value REAL DEFAULT 0;
ALTER TABLE rewards ADD COLUMN reward_type TEXT DEFAULT 'fixed';
ALTER TABLE rewards ADD COLUMN reward_value REAL DEFAULT 0;
ALTER TABLE rewards ADD COLUMN min_tier TEXT DEFAULT 'bronze';
ALTER TABLE rewards ADD COLUMN updated_at TEXT;
ALTER TABLE staff_devices ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE staff_shifts ADD COLUMN tenant_id TEXT;
ALTER TABLE staff_shifts ADD COLUMN staff_id TEXT;
ALTER TABLE staff_shifts ADD COLUMN operating_unit_id TEXT DEFAULT 'main_store';
ALTER TABLE staff_shifts ADD COLUMN hours_worked REAL;
ALTER TABLE staff_shifts ADD COLUMN attendance_state TEXT;
ALTER TABLE staff_shifts ADD COLUMN start_time TEXT;
ALTER TABLE staff_shifts ADD COLUMN end_time TEXT;
ALTER TABLE staff_shifts ADD COLUMN staff_name TEXT;
ALTER TABLE staff_shifts ADD COLUMN role TEXT DEFAULT 'staff';
ALTER TABLE staff_shifts ADD COLUMN date TEXT;
ALTER TABLE staff_shifts ADD COLUMN shift TEXT;
ALTER TABLE staff_shifts ADD COLUMN status TEXT DEFAULT 'open';
ALTER TABLE staff_shifts ADD COLUMN opening_cash REAL DEFAULT 0;
ALTER TABLE staff_shifts ADD COLUMN expected_cash REAL;
ALTER TABLE staff_shifts ADD COLUMN actual_cash REAL;
ALTER TABLE staff_shifts ADD COLUMN cash_variance REAL;
ALTER TABLE staff_shifts ADD COLUMN total_sales REAL DEFAULT 0;
ALTER TABLE staff_shifts ADD COLUMN cash_sales REAL DEFAULT 0;
ALTER TABLE staff_shifts ADD COLUMN online_sales REAL DEFAULT 0;
ALTER TABLE staff_shifts ADD COLUMN order_count INTEGER DEFAULT 0;
ALTER TABLE staff_shifts ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE staff_shifts ADD COLUMN updated_at TEXT DEFAULT (datetime('now'));
ALTER TABLE users ADD COLUMN locale TEXT DEFAULT 'vi';
ALTER TABLE users ADD COLUMN loyalty_tier TEXT DEFAULT 'bronze';
ALTER TABLE users ADD COLUMN loyalty_points INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN hire_date TEXT;
