BƯỚC 1: Đọc `worker/src/index.js` — ghi nhận framework, cách khai báo route, cách trả response. Đọc `worker/src/routes/menu.js` — ghi nhận pattern. Đọc `worker/wrangler.toml` — D1 binding name.

BƯỚC 2: CẬP NHẬT `worker/schema.sql` — THÊM (nếu chưa có):

CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    category TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'unread',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    status TEXT DEFAULT 'published',
    created_at TEXT DEFAULT (datetime('now'))
);

KHÔNG đụng tables existing.
