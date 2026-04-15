# API Audit Report (Phase 3)

## Worker Routes Hiện Có
*(Đã đăng ký trong `worker/src/index.js`)*

| Route File | Endpoints | Method | D1 Tables Used |
|-----------|-----------|--------|----------------|
| `menu.js` | `/api/menu`, `/api/menu/:id` | GET | `menu`, `categories` |
| `orders.js` | `/api/orders`, `/api/orders/:id`, `/api/admin/orders`, `/api/stats` | POST, GET, PATCH | `orders`, `order_items` |
| `auth.js` | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` | POST, GET | `users` |
| `payment.js` | `/api/payment/create-link` | POST | `payments`, `orders` |
| `webhooks.js`| `/api/webhook/payos` | POST | `payments`, `orders` |

*Lưu ý: D1 binding name được dùng trong `wrangler.toml` là `AURA_DB`.*

## Frontend API Calls
*(Được xư lý trong thư mục `js/`)*

| JS File | Endpoint Called | Method | Worker Route Exists? |
|---------|---------------|--------|---------------------|
| `api-client.js` | `/api/categories` | GET | ❌ Worker có file `categories.js` nhưng CHƯA import vào `index.js` |
| `api-client.js` | `/api/products`, `/api/products/:id` | GET | ❌ Worker có file `products.js` nhưng CHƯA import vào `index.js` |
| `api-client.js` | `/api/tables`, `/api/tables/:id/status` | GET, PATCH | ❌ Worker có file `tables.js` nhưng CHƯA import vào `index.js` |
| `api-client.js` | `/api/orders`, `/api/orders/:id`, `/api/orders/:id/status` | GET, POST, PATCH | ✅ `orders.js` |
| `api-client.js` | `/api/health` | GET | ❌ Chưa có trong Worker |
| `auth.js` | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout`, `/api/auth/me` | GET, POST | ✅ `auth.js` |
| `kds-poll.js` | `/api/orders/latest` | GET | ❌ Chưa có trong Worker `index.js` |
| `checkout.js` | `/cart`, `/checkout` | GET, POST | ❌ Checkout đang gọi URL legacy, không phải `/api/orders` |

## Gap Analysis

### Frontend gọi nhưng Worker chưa có ⚠️
- `/api/categories`
- `/api/products` và `/api/products/:id`
- `/api/tables` và `/api/tables/:id/status`
- `/api/health`
- `/api/orders/latest` (Dành cho tính năng KDS poll)
- `/cart` và `/checkout` (JS client gọi legacy prefix thay vì `/api/orders`)

### Worker có nhưng Frontend chưa dùng 📦
- `/api/menu` (Frontend đang dùng mock data hoặc chưa dùng)
- `/api/payment/create-link` (Chưa tích hợp vào Checkout flow của frontend)

### Endpoints mới cần tạo 🆕
1. Import các router `categories.js`, `products.js`, `tables.js` vào `worker/src/index.js`
2. Tạo endpoint `/api/orders/latest` (hoặc sửa đổi Hono router `orders-hono.js`)
3. Tạo endpoint `/api/health`
4. Cập nhật `js/checkout.js` và `js/cart.js` để trỏ vào hệ thống API mới (`/api/orders` thay vì legacy urls). Mở rộng PayOS call.
