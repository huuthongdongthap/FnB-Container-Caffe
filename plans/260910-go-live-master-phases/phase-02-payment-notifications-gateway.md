# Phase 2: Payment Gateway & Communications Handshake

## Objective
Xác minh hoạt động thực tế của cổng thanh toán PayOS (Live Mode) và luồng nhận Webhook tự động cập nhật đơn hàng sang KDS/POS trong thời gian thực.

## Mekong CLI Commands
- `mekong ci:run-ci` — Chạy CI pipeline kiểm tra tích hợp toàn diện.
- `mekong ci-debugger` — Chẩn đoán kết nối webhook và xử lý sự cố mạng.
- `mekong qa-e2e` — Kiểm thử E2E luồng đặt hàng và thanh toán.
- `mekong ci:deploy` — Triển khai bản cập nhật backend Worker lên môi trường production.

## Tasks
- [ ] Thiết lập Webhook URL trên portal `my.payos.vn`:
  - URL: `https://aura-space-worker.sadec-marketing-hub.workers.dev/api/webhooks/payos`
- [ ] Thực hiện giao dịch thử nghiệm tiền thật (10.000đ):
  - Tạo đơn hàng trên điện thoại -> Chọn PayOS -> Sinh mã VietQR.
  - Chuyển khoản từ app ngân hàng -> Kiểm tra nhận Webhook và xác thực signature.
  - Xác nhận đơn tự động chuyển trạng thái `paid` -> Hiện thẻ đơn màu xanh trên KDS `/kds.html` có âm báo.
- [ ] Kiểm tra cơ chế idempotency của Webhook (chống xử lý trùng lặp khi PayOS gửi retry).
- [ ] Xác minh luồng thông báo Zalo ZNS / SMS khi khách đăng ký thành viên hoặc được cộng hoàn tiền.
