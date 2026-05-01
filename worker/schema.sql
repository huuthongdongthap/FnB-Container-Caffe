-- F&B Caffe Container - Cloudflare D1 Schema
-- Creates 4 core tables: orders, customers, menu_items, payments

-- Drop existing tables (for development)
DROP TABLE IF EXISTS reservations;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS cafe_tables;

-- =====================================================
-- CATEGORIES TABLE
-- =====================================================
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_slug ON categories(slug);

-- =====================================================
-- PRODUCTS TABLE (normalised menu items for KDS/POS)
-- =====================================================
CREATE TABLE products (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    description TEXT,
    image_url TEXT,
    tags TEXT,          -- JSON array
    badge TEXT,
    is_available BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES categories(id)
);

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_available ON products(is_available);

-- =====================================================
-- CAFE_TABLES TABLE
-- =====================================================
CREATE TABLE cafe_tables (
    id           TEXT PRIMARY KEY,
    table_number TEXT UNIQUE NOT NULL,
    capacity     INTEGER NOT NULL,
    zone         TEXT NOT NULL,
    status       TEXT DEFAULT 'Available',
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tables_zone ON cafe_tables(zone);
CREATE INDEX idx_tables_status ON cafe_tables(status);

-- =====================================================
-- MENU_ITEMS TABLE
-- =====================================================
CREATE TABLE menu_items (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL,
    description TEXT,
    tags TEXT,  -- JSON array: ["Hot/Cold", "300ml"]
    badge TEXT,
    available BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for category filtering
CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_menu_items_available ON menu_items(available);

-- =====================================================
-- CUSTOMERS TABLE
-- =====================================================
CREATE TABLE customers (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    phone TEXT,
    loyalty_points INTEGER DEFAULT 0,
    loyalty_tier TEXT DEFAULT 'bronze',  -- bronze, silver, gold, platinum
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for email lookup
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_loyalty_tier ON customers(loyalty_tier);

-- =====================================================
-- ORDERS TABLE
-- =====================================================
CREATE TABLE orders (
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES cafe_tables(id)
);

-- Index for status filtering and customer lookup
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_payment_status ON orders(payment_status);

-- =====================================================
-- PAYMENTS TABLE
-- =====================================================
CREATE TABLE payments (
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

-- Index for order lookup
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- =====================================================
-- RESERVATIONS TABLE
-- =====================================================
CREATE TABLE reservations (
    id TEXT PRIMARY KEY,
    table_id TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    guest_count INTEGER NOT NULL DEFAULT 2,
    date TEXT NOT NULL,           -- YYYY-MM-DD
    time TEXT NOT NULL,           -- HH:MM
    zone TEXT NOT NULL,           -- Indoor, Outdoor, VIP
    status TEXT DEFAULT 'confirmed',  -- confirmed, cancelled, completed
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (table_id) REFERENCES cafe_tables(id)
);

CREATE INDEX idx_reservations_date ON reservations(date);
CREATE INDEX idx_reservations_table ON reservations(table_id);
CREATE INDEX idx_reservations_status ON reservations(status);

CREATE TRIGGER update_reservations_timestamp
AFTER UPDATE ON reservations
BEGIN
    UPDATE reservations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =====================================================
-- ORDER_ITEMS TABLE (normalised line items for KDS)
-- =====================================================
CREATE TABLE order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal INTEGER NOT NULL,
    modifiers TEXT,      -- JSON: {"size":"L","ice":"less"}
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- =====================================================
-- TRIGGERS FOR updated_at
-- =====================================================
CREATE TRIGGER update_menu_items_timestamp
AFTER UPDATE ON menu_items
BEGIN
    UPDATE menu_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_customers_timestamp
AFTER UPDATE ON customers
BEGIN
    UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_orders_timestamp
AFTER UPDATE ON orders
BEGIN
    UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER update_payments_timestamp
AFTER UPDATE ON payments
BEGIN
    UPDATE payments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- =====================================================
-- CONTACT MESSAGES TABLE
-- =====================================================
CREATE TABLE contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    category TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'unread',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- REVIEWS TABLE
-- =====================================================
CREATE TABLE reviews (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    status TEXT DEFAULT 'published',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- LOYALTY TABLES
-- =====================================================
CREATE TABLE loyalty_members (
    id TEXT PRIMARY KEY,
    phone TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    tier TEXT DEFAULT 'bronze',
    points_balance INTEGER DEFAULT 0,
    total_points_earned INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loyalty_transactions (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    type TEXT NOT NULL,
    points INTEGER NOT NULL,
    reference_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loyalty_tiers (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    min_points INTEGER NOT NULL,
    cashback_percent REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE loyalty_rewards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    points_cost INTEGER NOT NULL,
    status TEXT DEFAULT 'active'
);
