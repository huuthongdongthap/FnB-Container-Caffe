# Phase 8: Loyalty Flow Audit & API Sync (Task 8.2)

ĐỌC: `loyalty.html` (phần `<div id="pointsHistory">`) VÀ `js/loyalty.js`.

## Nhiệm vụ (Audit & Fix):
1. **Loại bỏ Hardcode HTLM:** Xoá tất cả các `<div class="hist-item">...</div>` đang bị fix cứng trong `<div id="pointsHistory">` của trang `loyalty.html`. Giữ lại thẻ container trống `<div id="pointsHistory"></div>`. Tương tự đối với mảng `#cbHistory` và `#cbAmount`.
2. **Cập nhật JS Fetch Logic:** Tại  `js/loyalty.js`, viết hàm render động danh sách giao dịch điểm. Chuẩn bị sẵn khối `fetch(API_BASE + '/api/loyalty/history')` và comment lại (với logic render html element như format cũ). 
3. **Fallback UI Mocks:** Để không làm gãy UI local, sử dụng mảng tĩnh fallback (hoặc fallback timeout) mô phỏng fetch về để render ra trang (sử dụng random point values hoặc dữ liệu dummy)

Kết thúc bằng `Done audit-loyalty-8.2`.
