# TASK: Backend Phase 3 — Frontend ↔ Backend Integration

> **Priority**: HIGH | **Estimated**: 15 min | **Type**: Frontend API Integration

## Context
Phase 1 và Phase 2 đã hoàn thành: Cloudflare D1 database và Worker Hono API đã sẵn sàng ở `http://127.0.0.1:8787/api`. Lúc này, giao diện frontend vẫn đang sử dụng mock data (`data/menu-data.json`) hoặc các code cũ của Supabase. Chúng ta cần cập nhật frontend để gọi Data thực từ API mới.

## INSTRUCTIONS FOR CTO WORKER

### 1. Cập nhật cấu hình API (js/config.js)
Trong `js/config.js`, hãy trỏ Endpoint chính thức về local Cloudflare Worker. Tìm hằng `API_CONFIG`, và thêm/sửa `BASE_URL`:
```javascript
export const API_CONFIG = {
  // Thay thế SUPABASE bằng Cloudflare Worker Endpoint
  WORKER_BASE_URL: 'http://127.0.0.1:8787',
  // ...giữ nguyên các cấu hình PayOS/VNPay
};
```

### 2. Cập nhật API Client (js/api-client.js)
Viết lại hoàn toàn file `js/api-client.js` để nó gỡ bỏ Supabase dependencies, thay vào đó gọi `fetch` tới Cloudflare Worker.
Tạo các classes hoặc exported functions như sau:
- `ApiService.getCategories()` -> `fetch(API_CONFIG.WORKER_BASE_URL + '/api/categories')`
- `ApiService.getProducts()` -> `fetch(API_CONFIG.WORKER_BASE_URL + '/api/products')`
- `ApiService.getTables()` -> `fetch(API_CONFIG.WORKER_BASE_URL + '/api/tables')`
- `ApiService.createOrder(orderData)` -> `fetch(API_CONFIG.WORKER_BASE_URL + '/api/orders', { method: 'POST', body: JSON.stringify(orderData) })`

Lưu ý xử lý lỗi (catch err và trả về fallback null hoặc error messages).

### 3. Cập nhật Logic ở Menu (js/menu.js hoặc files liên quan)
- Đảm bảo màn hình `menu.html` hoặc logic nạp danh sách đồ uống đọc từ `ApiService` thay vì `fetch('/data/menu-data.json')`.
- Loại bỏ hoàn toàn các file hoặc tham chiếu cũ tới Supabase client JS (như script tag CDN supabase). Gõ `grep -rn "supabase" .` để rà soát.

### 4. Khởi động Dev Server & Verify
- Đảm bảo Worker API đang chạy ở background (`npm run dev` trong thư mục `worker/`).
- Mở Server Live hoặc npx http-server ở Frontend.
- Mở browser console và check tab Network để đảm bảo request tới `/api/categories` trả về 200 OK. Lấy dữ liệu D1 lên UI.

### 5. Báo Cáo
Gửi báo cáo khi Frontend của bạn đã hoàn toàn loại bỏ Supabase và gọi thành công dữ liệu từ Cloudflare Hono API.
