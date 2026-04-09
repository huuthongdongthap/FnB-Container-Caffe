# TASK: Backend Phase 1 — Cloudflare D1 Setup

> **Priority**: HIGH | **Estimated**: 10 min | **Type**: Database Schema Migration

## Context
Project đã được yêu cầu chuyển từ Supabase (PostgreSQL) sang **Cloudflare D1 (SQLite)**. Tên CSDL và binding đã được set trong `worker/wrangler.toml` là `AURA_DB`.
Worker cần chuyển đổi schema từ PostgreSQL sang chuẩn D1 SQLite, bỏ các hàm PostgreSQL specfic, sau đó test khởi tạo local D1.

## INSTRUCTIONS FOR CTO WORKER

### 1. Migrating Schema to SQLite
- Đọc file `supabase/schema.sql` hiện tại.
- Tạo một file mới tại `db/schema.sql` (tạo thư mục `db` nếu chưa có).
- Chuyển syntax sang SQLite:
  - Bảng không nên có `uuid_generate_v4()`. Thay vào đó, dùng `TEXT PRIMARY KEY` cho IDs (khi code Worker chúng ta sẽ generate id như GUID / gen_random_uuid()) HOẶC dùng `INTEGER PRIMARY KEY AUTOINCREMENT`. Tùy thuộc cấu trúc Supabase cũ có ID UUID không, tốt nhất nên đổi thành TEXT cho UUIDs, nhưng bỏ default function, hoặc dùng `INTEGER PRIMARY KEY AUTOINCREMENT` nếu được.
  - Xóa toàn bộ lệnh `ALTER TABLE "..." ENABLE ROW LEVEL SECURITY;`.
  - Xóa toàn bộ `CREATE POLICY` (vì D1 không có RLS).
  - Loại bỏ các index phức tạp nếu SQLite không hỗ trợ.
  - Giữ nguyên các Table: `categories`, `products`, `users`, `tables`, `reservations`, `orders`, `order_items`, `payments`, `rewards`.

### 2. Prepare Seed Data
- Tạo file `db/seed.sql`.
- Chèn dữ liệu mẫu cho `categories` và `products` (với SQLite id) phỏng theo cấu trúc đã xác định trong `designs/plan-backend.md`.
- Chèn khoảng 10 bàn vào tabe `tables` (Ground, Rooftop, Courtyard).

### 3. Verify Local Execution
- Chạy lệnh sau để thử nghiệm schema build vào một db tạm local:
```bash
npx wrangler d1 execute aura-space-db --local --file=./db/schema.sql
npx wrangler d1 execute aura-space-db --local --file=./db/seed.sql
```
(Nếu gặp lỗi thì debug syntax SQLite trong `schema.sql` đến khi chay thành công)

### 4. Báo Cáo
- Hoàn tất và thông báo khi script chạy --local thành công. Mọi file sql được move/tạo trong `db/`
