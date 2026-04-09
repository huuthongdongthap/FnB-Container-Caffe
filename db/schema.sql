-- AURA SPACE — Cloudflare D1 (SQLite) Schema
-- Version 2.0.0 — D1/SQLite compatible
-- FK relationships enforced at application layer (Worker code)

-- ─────────────────────────────────────────────
-- 1. CATEGORIES & PRODUCTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
    id           TEXT PRIMARY KEY,
    category_id  TEXT,
    name         TEXT NOT NULL,
    price        REAL NOT NULL,
    image_url    TEXT,
    description  TEXT,
    is_available INTEGER DEFAULT 1,
    created_at   TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_category  ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_available ON products(is_available);

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
    id            TEXT PRIMARY KEY,
    customer_name TEXT,
    phone         TEXT,
    table_id      TEXT,
    subtotal      REAL NOT NULL,
    tax           REAL DEFAULT 0.00,
    total_amount  REAL NOT NULL,
    status        TEXT DEFAULT 'Bep tiep nhan',
    notes         TEXT,
    created_at    TEXT DEFAULT (datetime('now')),
    updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_orders_status  ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_table   ON orders(table_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS order_items (
    id         TEXT PRIMARY KEY,
    order_id   TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity   INTEGER NOT NULL DEFAULT 1,
    subtotal   REAL NOT NULL,
    modifiers  TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payments (
    id             TEXT PRIMARY KEY,
    order_id       TEXT NOT NULL,
    gateway        TEXT NOT NULL,
    transaction_id TEXT,
    status         TEXT DEFAULT 'Pending',
    amount         REAL NOT NULL,
    created_at     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_payments_order  ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
