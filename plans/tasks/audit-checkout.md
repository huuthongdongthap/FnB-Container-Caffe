# Phase 8: Checkout Flow Audit & Cart Sync (Task 8.1)

ĐỌC: `checkout.html` (đoạn section `<div class="summary-card">` và script `btnPay`) VÀ `js/checkout.js`.

## Nhiệm vụ (Audit & Fix):
1. **Loại bỏ Hardcode:** Trong `checkout.html`, danh sách các món (`item-name`, `item-qty`, `item-price`) và tổng tiền đang bị fix cứng.
2. **Cập nhật JS Fetch Logic:** Viết lại javascript script update `summary-card` dùng data lấy từ `localStorage.getItem('aura_cart_v1')`. Nếu cart rỗng thì hiện "Giỏ hàng trống" và disable nút Thanh toán.
3. **API Payload Checkout:** Trong hàm xử lý nút `btnPay` (hiện tại đang `Math.random() < 0.7` giả lập), hãy chuẩn bị comment lại/chuẩn bị form json payload gọi API `POST API_BASE + /payment/create` nhưng chưa cần viết fetch hoàn chỉnh (để Frontend logic không bị broken).

Report cấu trúc sẽ sửa và tạo file hướng dẫn chi tiết HOẶC patch file `checkout.html` với nội dung Dynamic Cart JS. 

Kết thúc bằng `Done audit-checkout-8.1`.
