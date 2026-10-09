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
    id           TEXT PRIMARY KEY,
    phone        TEXT UNIQUE NOT NULL,
    full_name    TEXT,
    tier         TEXT DEFAULT 'Silver',
    total_points INTEGER DEFAULT 0,
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);

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
    payment_method TEXT NOT NULL,  -- cod, momo, vnpay, payos
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES cafe_tables(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table   ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

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
    method TEXT NOT NULL,  -- cod, momo, vnpay, payos
    amount INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending, completed, failed, refunded
    transaction_id TEXT,  -- External payment gateway transaction ID
    payment_url TEXT,  -- Payment redirect URL
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
    created_at     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_promo_active ON promotions(is_active);

-- Seed active discount codes
INSERT OR IGNORE INTO promotions (code, percent, max_discount, starts_at, expires_at, is_active) VALUES
    ('AURA20',  20, 50000, '2026-06-06T00:00:00Z', '2026-06-06T23:59:59Z', 1),
    ('AURA10',  10, 30000, '2026-06-07T00:00:00Z', '2026-06-13T23:59:59Z', 1),
    ('WELCOME', 10, 30000, NULL,                  NULL,                  1);

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
