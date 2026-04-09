# TASK: Backend Phase 4 — KDS Realtime (KV/WebSocket)

> **Priority**: HIGH | **Estimated**: 15 min | **Type**: Real-time Backend

## Context
Phase 3 đã kết thúc hoàn hảo. Bây giờ chúng ta bước sang Phase 4: **Kitchen Display System (KDS) Realtime**.
Hệ thống KDS (ví dụ `admin/orders.html` hoặc `dashboard/admin.html`) cần phải re-render ngay khi có một đơn hàng mới từ Cloudflare Worker. Ở hệ thống cũ, chúng ta đang dùng một Node.js `websocket-server.js` rời rạc, điều này không tốt cho kiến trúc Serverless Cloudflare.

## INSTRUCTIONS FOR CTO WORKER

### 1. Phân tích hiện trạng
- Đọc file `websocket-server.js` để hiểu logic pub/sub cũ.
- Đọc `admin/orders.html` (hoặc `js/admin.js`, whatever manages the orders list) để xem cách frontend đang nhận realtime updates. 

### 2. Định hướng Thiết kế Cloudflare Native
Vì D1 hiện tại chưa hỗ trợ Realtime subscriptions (giống Supabase), bạn có thể thiết kế theo 1 trong 2 cách sau:

**Lựa chọn A (Khuyên dùng vì dễ triển khai trên CF Worker - Long Polling / Short Polling kết hợp KV):**
- Ở `POST /api/orders`, sau khi ghi D1, update một key trên KV (ví dụ `LATEST_ORDER_ID` = UUID/Timestamp).
- Ở KDS Frontend, thực hiện short-polling (3s/lần) GET `/api/orders?since=...` hoặc check KV flag `/api/orders/latest` để biết khi nào cần reload danh sách orders.

**Lựa chọn B (WebSockets với Cloudflare Workers / Durable Objects):**
- Sử dụng `upgrade` header để tạo WebSocket endpoint `/api/ws` tại `worker/src/index.js`.
- Bất cứ khi nào có `POST /api/orders`, Server broadcast message tới tất cả WS clients đang connect.
- Ở Frontend, thay vì connect port 8080 local, connect tới `wss://127.0.0.1:8787/api/ws`.

### 3. Thực thi
1. Viết lại logic backend `worker/src/` để hỗ trợ Realtime (chọn A hoặc B).
2. Xóa cài đặt cũ (nếu có sử dụng `websocket-server.js`) khỏi frontend client (`js/api-client.js` hoặc `js/admin.js`). Kết nối trực tiếp với backend Cloudflare.
3. Test tạo một order mới ở `checkout.html`, mở tab `admin/orders.html`. Nếu order pop up ngay lập tức (hoặc < 3s), bạn đã thành công.

### 4. Báo Cáo
Gửi báo cáo khi KDS hoàn tất việc nhận đơn tự động qua Cloudflare System (loại bỏ hoàn toàn Node.js websocket rời rạc).
Mọi thao tác thay đổi UI nhớ tự động Bypass (nếu đã kích hoạt `accept edits off`).
