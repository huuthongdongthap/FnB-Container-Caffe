# TASK: Backend Phase 2 — Cloudflare Worker API Setup

> **Priority**: HIGH | **Estimated**: 15 min | **Type**: Backend API Implementation

## Context
Phase 1 đã hoàn tất với việc tạo Cloudflare D1 local database thành công (9 tables).
Bây giờ chúng ta cần xây dựng REST API bằng **Cloudflare Workers**. Chúng ta sẽ sử dụng framework **Hono.js** vì sự nhẹ nhàng và native support cho Cloudflare Workers.

## INSTRUCTIONS FOR CTO WORKER

### 1. Cài đặt Hono
- Di chuyển vào thư mục `worker/`: `cd /Users/mac/mekong-cli/FnB-Container-Caffe/worker`
- Chạy lệnh cài đặt Hono: `npm install hono`

### 2. Khởi tạo Router (worker/src/index.js)
Tạo hoặc ghi đè file `worker/src/index.js` với Hono router:
```javascript
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// Kích hoạt CORS cho tất cả routes
app.use('/api/*', cors())

// Basic health check
app.get('/api/health', (c) => c.json({ status: 'ok', service: 'AURA SPACE API' }))

// Export worker
export default app
```

Chú ý: Binding DB được định nghĩa trong `wrangler.toml` là `AURA_DB`. Bạn có thể truy cập nó qua `c.env.AURA_DB` trong Hono handler.

### 3. Xây dựng các Endpoints Cơ Bản
Tạo các routes trả về JSON data, read trực tiếp từ D1 (`c.env.AURA_DB.prepare( query ).all()`):

Thêm các endpoint sau vào trước `export default app`:
1. `GET /api/categories`: Lấy toàn bộ từ table `categories`.
2. `GET /api/products`: Lấy toàn bộ từ table `products`.
3. `GET /api/tables`: Lấy toàn bộ từ table `cafe_tables`.

### 4. Xây dựng Endpoint phức tạp (Orders)
1. `POST /api/orders`:
   - Lấy JSON body (customer_name, phone, table_id, items: [{product_id, quantity, price, notes}]).
   - Generate một ID ngẫu nhiên (ví dụ `crypto.randomUUID()`) cho `orders.id`
   - INSERT vào table `orders`, sau đó duyệt mảng `items` để INSERT vào `order_items`.
   - Lưu ý SQLite không có transaction tự động như Postgres `BEGIN...COMMIT`, nhưng có thể dùng db.batch() nếu cần, hoặc đơn giản là await từng câu lệnh insert. Nên parse/validate nhẹ nhàng.
2. `GET /api/orders`: Lấy danh sách orders (join với `cafe_tables` nếu cần) để phục vụ cho KDS dashboard.

### 5. Verify Local
- Khởi động local server bằng lệnh: `npm run start` (hoặc `npx wrangler dev`). Lệnh này sẽ chạy dev server.
- Test endpoint: Gọi một curl tới `http://127.0.0.1:8787/api/health` và `http://127.0.0.1:8787/api/categories`.
- Đảm bảo api trả về kết quả JSON từ DB.

### 6. Báo Cáo
Gửi báo cáo khi bạn đã hoàn thành thiết lập API và chạy dev server thành công.
