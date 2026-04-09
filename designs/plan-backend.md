# PLAN 2: Backend Implementation — AURA SPACE Web App (Cloudflare D1)

> **Mục tiêu:** Triển khai backend hoàn chỉnh cho web app AURA SPACE bằng The Cloudflare Stack.
> **Stack Mới:** Vanilla HTML/CSS/JS (PWA) + Cloudflare D1 (SQLite) + Cloudflare Workers + WebSockets (Realtime) + Cloudflare Pages  
> **Schema ban đầu:** `supabase/schema.sql` (Cần migrate từ PostgreSQL sang SQLite cho D1).

---

## TÌNH TRẠNG HIỆN TẠI

| Hạng mục | Trạng thái | Ghi chú |
|----------|-----------|---------|
| DB Schema | 🔄 Cần convert | `schema.sql` đang là PostgreSQL, cần chuyển sang SQLite cho D1 |
| Cloudflare D1 | 🔄 Chờ init | Cần chạy `wrangler d1 create aura-space-db` |
| API Layer (Workers) | ❌ Chưa có | Tạo Cloudflare Workers endpoints kết nối D1 binding `AURA_DB` |
| Frontend ↔ Backend | ❌ Chưa nối | HTML pages chưa gọi API |
| Realtime (WS) | 🔄 Có sẵn script | `websocket-server.js` hiện có, cần tích hợp với Workers DO/WebSockets |
| Payment Gateway | ❌ Chưa có | Tích hợp theo `config.js` |

---

## CÁC HẠNG MỤC CẦN LÀM

### Phase 1: Nền Tảng (Foundation) - Cloudflare D1 Setup

#### 1.1 Chuyển đổi Schema (PostgreSQL -> SQLite)
- [ ] Refactor `supabase/schema.sql` thành `db/d1_schema.sql`
- [ ] Bỏ các tính năng đặc thù của Postgres (như uuid_generate_v4() -> thay bằng mã sinh từ Worker, gen_random_uuid())
- [ ] Bỏ Row Level Security (RLS) của Supabase

#### 1.2 Khởi tạo D1 Local & Remote
- [ ] Cập nhật `wrangler.toml` nếu cần thiết (đã đổi tên `AURA_DB` và `aura-space-db`).
- [ ] Init local local D1 database: `npx wrangler d1 execute aura-space-db --local --file=./db/d1_schema.sql`
- [ ] Seed data mẫu (Categories, Products, Tables) tương thích SQLite.

---

### Phase 2: API Endpoints (Cloudflare Workers)

#### 2.1 Worker Setup
- [ ] Cấu hình router cho `worker/src/index.js` (có thể dùng Hono hoặc itty-router).
- [ ] Mount D1 database connection vào router context.

#### 2.2 Menu API
```
GET  /api/categories         → Danh sách categories
GET  /api/products            → Tất cả products (kèm filter ?category_id=)
```

#### 2.3 Order API
```
POST /api/orders              → Tạo đơn hàng mới { customer_name, phone, table_id, items[], notes }
GET  /api/orders/:id          → Chi tiết đơn (kèm items)
PATCH /api/orders/:id/status  → Cập nhật trạng thái (cho KDS)
```

#### 2.4 Reservation API
```
GET  /api/tables              → Danh sách bàn (kèm status)
POST /api/reservations        → Đặt bàn { customer, date, time, table_id }
```

---

### Phase 3: Frontend ↔ Backend Integration

#### 3.1 Cập nhật `js/config.js` & API Client
- [ ] Cập nhật `API_CONFIG.BASE` để loop back vào local worker khi dev.
- [ ] Code fetching logic trong `js/api-client.js`.

#### 3.2 Tích hợp UI
- [ ] **Menu (`menu.html`):** Fetch categories + products từ `/api/products`.
- [ ] **Checkout (`checkout.html`):** POST `/api/orders` với cấu trúc JSON phù hợp.
- [ ] **KDS (`kds.html`):** Load danh sách orders và update status (Fetch + WS Realtime).

---

### Phase 4: KDS Realtime & Analytics

- [ ] Cấu hình WebSockets qua Cloudflare Workers hoặc duy trì Node WS server cục bộ cho dev.
- [ ] Admin dashboard: Báo cáo doanh thu và status.

---

## THỨ TỰ TRIỂN KHAI ĐỀ XUẤT

```
Bước 1: SQLite Schema Conversion & D1 Local Init (Worker dispatch)
Bước 2: Cloudflare Worker API Setup (Products, Categories, Orders)
Bước 3: Frontend Integration (Menu, Checkout, Admin calls API)
Bước 4: WebSocket Realtime KDS Integration
Bước 5: Deployment & VietQR Payment.
```
