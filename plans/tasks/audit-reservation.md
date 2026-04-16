# Phase 9: Primary Conversion Flow Audit (Task 9.2)

ĐỌC: `table-reservation.html` và kịch bản submit của nó.

## Nhiệm vụ (Audit & Fix):
1. **Tiêm Shared Layout:** Trong `table-reservation.html`, xoá mã cứng của Navbar/Footer. Thay bằng `<div id="shared-navbar"></div>` và `<div id="shared-footer"></div>`.
2. **Xử lý Submission API:** Trong script xử lý Reservation (dưới cùng của file HTML hoặc file JS riêng), chuẩn bị khối fetch API động `POST /api/reservations` thay cho Alert cứng hiện tại. Comment khối payload này lại.
3. **Fallback UI Mocks:** Cung cấp fallback UI: Giả lập thành công (hiển thị thông báo "✅ Đặt bàn thành công" hoặc chuyển hướng) sau 1.5s để người dùng Local có thể test cảm giác Native. Xử lý form validation cho `guests`, `date`, `time`.

Kết thúc quá trình bằng câu `Done audit-reservation-9.2`.
