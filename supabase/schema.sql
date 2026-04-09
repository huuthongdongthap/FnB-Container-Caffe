-- AURA SPACE / Supabase PostgreSQL Schema
-- Version 1.0.0

-- 1. CATEGORIES & PRODUCTS
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    image_url TEXT,
    description TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USERS & LOYALTY (CRM)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- Or map to auth.users if using Supabase Auth
    phone TEXT UNIQUE NOT NULL,
    full_name TEXT,
    tier TEXT DEFAULT 'Silver',
    total_points INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    discount_type TEXT NOT NULL, -- e.g., 'PERCENTAGE', 'FIXED_AMOUNT'
    discount_value DECIMAL(10,2) NOT NULL,
    point_cost INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLES & RESERVATIONS
CREATE TABLE tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number TEXT UNIQUE NOT NULL,
    capacity INTEGER NOT NULL,
    zone TEXT NOT NULL, -- 'Ground', 'Rooftop', 'Courtyard'
    status TEXT DEFAULT 'Available', -- 'Available', 'Occupied', 'Reserved', 'Overdue'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    pax INTEGER NOT NULL,
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ORDERS & CHECKOUT (KDS)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_name TEXT,
    phone TEXT,
    table_id UUID REFERENCES tables(id) ON DELETE SET NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'Bếp tiếp nhận', -- 'Bếp tiếp nhận', 'Đang pha chế', 'Sẵn sàng', 'Hoàn thành'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal DECIMAL(10,2) NOT NULL,
    modifiers JSONB, -- Store JSON like {"ice": "50%", "sugar": "30%"}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    gateway TEXT NOT NULL, -- 'VietQR', 'Cash', 'Card'
    transaction_id TEXT,
    status TEXT DEFAULT 'Pending', -- 'Pending', 'Paid', 'Failed'
    amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Supabase Real-time for KDS and Table Dashboard
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE tables;
