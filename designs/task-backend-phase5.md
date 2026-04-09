# TASK: Backend Phase 5 — Payment Integration (PayOS)

> **Priority**: HIGH | **Estimated**: 25 min | **Type**: Backend API & Frontend Connect

## Context
Chúng ta sừ dụng cổng thanh toán **PayOS** thay vì link ảnh VietQR truyền thống theo yêu cầu của hệ thống (bảo mật qua HMAC-SHA256 và IPN Webhooks).

## INSTRUCTIONS FOR CTO WORKER

### 1. Phân tích hiện trạng
- Xem cấu trúc `db/schema.sql` (bảng logs, table, orders). Đơn hàng ID (chuỗi) cần có 1 mã `order_code` dạng số nguyên (Int64) theo chuẩn PayOS. Nếu chưa có mã số, hãy tạo trường `order_code` kiểu `INTEGER` khi insert order (ví dụ: dùng unix timestamp `Date.now() % 100000000`).

### 2. Triển khai API Thanh toán PayOS bên Worker
- Tạo route xử lý thanh toán `worker/src/routes/payment.js`.
- Cài đặt `POST /api/payment/create-link` để gọi API PayOS: `POST https://api-merchant.payos.vn/v2/payment-requests`.
- Format chữ ký (Signature): Hash HMAC-SHA256 khóa bí mật (`PAYOS_CHECKSUM_KEY`) cho chuỗi: `amount=...&cancelUrl=...&description=...&orderCode=...&returnUrl=...`
- Cung cấp dummy env variables trong Worker nếu bạn không auth được thật: `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`.
- API này return dữ liệu PayOS trả về, bao gồm `checkoutUrl` cho frontend.

### 3. API Webhook Nhận kết toán
- Tạo `POST /api/webhook/payos` để PayOS gọi lại sau khi người dùng quét mã xong (`status: 'PAID'`). 
- Cập nhật trạng thái `orders` thành `San sang` hoặc `Hoan thanh` dựa vào `order_code` từ Webhook này (nhớ verify webhook signature).

### 4. Frontend Integration
- Sửa lại file HTML/JS (chủ yếu là `payment-qr.js` hoặc `checkout.js`).
- Khi user chọn PayOS và Place Order, hãy gọi backend của chúng ta (`/api/payment/create-link`) để tạo request, sau đó gán `checkoutUrl` cho `window.location.href` để redirect thẳng sang cổng PayOS Checkout (không dùng pop-up hay nhúng iframe phức tạp cho an toàn).
- Tạo return URL xử lý sau thanh toán (trỏ về `track-order.html?success=true`).

Bạn hãy tự suy luận logic và thực thi sửa frontend/backend code ngay không cần hỏi xác nhận.
