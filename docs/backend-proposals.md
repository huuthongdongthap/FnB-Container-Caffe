# Báo Cáo Phân Tích Hiện Trạng Backend & Đề Xuất (Backend Proposals)

## Đã có ✅ (Features Backend đang hoạt động)
1. **Authentication:** Đăng nhập, đăng ký, đăng xuất qua JWT/D1 (`auth.js`).
2. **Menu & Product Catalog:** Quản lý thực đơn, tìm kiếm, liệt kê sản phẩm (`menu.js`, `products.js`, `categories.js`).
3. **Cart & Orders:** Lifecycle của đơn hàng từ Giỏ hàng -> Checkout -> DB (`orders.js`).
4. **Payments:** Tích hợp cổng thanh toán PayOS tạo QR code (`payment.js`) và IPN Webhook tự động cập nhật trạng thái (`webhooks.js`).
5. **Customer Interactions:** Rating & Reviews (`reviews.js`), Form liên hệ (`contact.js`).
6. **Loyalty System (Points/Cashback):** Hệ thống tích luỹ, hoàn tiền, đổi thưởng theo nhiều rank thành viên (`loyalty.js`).
7. **KDS Tương Tác:** Bắn thông tin đơn hàng xuống máy tính bếp/thùng KDS thông qua polling (`kds-poll.js`).

## Đang thiếu & Cần thiết 🔴 (Frontend UI ĐÃ CÓ nhưng backend chưa support flow chuẩn / E2E)
1. **Table Status Sync 🔴(P0)**
   - UI Reservation có rỗng nhưng API thiêú trigger báo trạng thái bàn real-time tới máy KDS và Caffe POS.
2. **KDS Real-time Integration 🔴(P0)**
   - Cần chèn logic phát WS trực tiếp từ `orders.js` trong Cloudflare Worker để `js/kds-app.js` nhận thay vì dựa hoàn toàn vào interval polling.
3. **Auto-Cashback Triggering 🔴(P1)**
   - Khi thanh toán thành công (Webhook return SUCCESS) cần gọi tự động `process-cashback` tính điểm cho `member_id` trên `loyalty.js`.
4. **Order Status WebSocket Notification 🔴(P1)**
   - API Order Status Updates thiếu push notification qua `websocket-server.js` tới URL `track-order.html`. 

## Đề xuất mới 🆕 (Chưa có cả FE lẫn BE)
1. **Analytics Aggregation (P2):** Chạy background Cron Job tự động tính doanh số, đơn hàng và các category phổ biến lên một Admin Analytics Dashboard.
2. **Inventory Tracking (P2):** Map số lượng sản phẩm từ Menu xuống nguyên liệu trong Kho (Mỗi sản phẩm tốn bao nhiêu sữa/đường).
3. **QR Code Ordering tại Bàn (P2):** QR code in sẵn cho phép User scan, mở Web App với `table_id` tự động gắn vào session. Không cần ra quầy.
4. **Export & Report Tools (P2):** Excel export tool lấy dữ liệu order, giao dịch thanh toán từ DB để kết toán.

## Roadmap ưu tiên triển khai
- **P0 (Ngay Lập Tức):** Fix End-to-End Order Flow, KDS Real-Time và Table Sync.
- **P1 (Bước Kế Tiếp):** Webhook Auto-Cashback và Order Status WS Notification.
- **P2 (Dài hạn - Tạm Thời Đề Xuất):** Analytics, Inventory, QR Code, Export Data.
