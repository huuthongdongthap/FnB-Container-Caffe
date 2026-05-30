# 🔍 ARCHITECTURE, SECURITY & PERFORMANCE REVIEW: AURA CHECK-IN

> **Đối Tượng Review:** Kế hoạch triển khai luồng check-in khai trương Aura Cafe 6/6 (`plan.md` & `phase-01-checkin-flow.md`).
> **Mục Tiêu:** Đảm bảo luồng check-in bảo mật tuyệt đối, chống gian lận, tối ưu hiệu năng chạy trên Cloudflare Workers & D1 trong ngày khai trương.

---

## 1. Đánh Giá Kiến Trúc (Architecture Review)

### Điểm Tốt (Strengths):
*   **Decoupling:** Việc tách biệt trang `/checkin` cho khách hàng và POS `/admin/pos.html` cho nhân viên là chuẩn xác. Tránh phơi bày API cộng tiền trực tiếp ra ngoài.
*   **Enforce qua DB:** Sử dụng cột `checkin_month` và khoá `UNIQUE(customer_id, checkin_month)` đảm bảo mức độ bảo vệ dữ liệu cao nhất ở tầng cơ sở dữ liệu.

### Khuyến Nghị Kiến Trúc (Recommendations):
*   **Hạn chế State Drift:** Trên POS, khi lookup thông tin hội viên, cần lưu cache trạng thái check-in của họ trong phiên làm việc hiện tại để tránh gọi API `/status` liên tục mỗi khi thay đổi giỏ hàng.
*   **Tách Biệt Campaign:** Đảm bảo `campaign_code` được cấu hình động hoặc định nghĩa rõ ràng trong database để POS và Worker có thể tái sử dụng luồng này cho các chiến dịch tương lai (ví dụ: sinh nhật quán, lễ Tết).

---

## 2. Lỗ Hổng Bảo Mật & Phòng Chống Gian Lận (Security & Anti-Fraud)

### 🔴 Lỗ hổng P0: Khách hàng tự gọi API cộng ví 20k
*   **Nguy cơ:** Nếu khách hàng phát hiện URL API `POST /api/loyalty/checkin`, họ có thể dùng Postman/Curl để tự gửi yêu cầu cộng tiền 20.000đ liên tục mà không cần nhân viên duyệt.
*   **Giải pháp:** **Bắt buộc** API `POST /api/loyalty/checkin` chỉ chấp nhận chữ ký xác thực JWT của tài khoản nhân viên (Staff/Owner JWT) truyền trong Header `Authorization`. Khách hàng KHÔNG được phép trực tiếp gọi API này.

### 🟡 Lỗ hổng P1: Gian lận đăng ký nhiều tài khoản ảo
*   **Nguy cơ:** Một khách hàng sử dụng 10 SIM rác khác nhau để đăng ký thành viên và check-in nhận quà 20k tại bàn.
*   **Giải pháp:**
    1.  Enforce OTP xác thực SĐT khi đăng ký (nếu có chi phí SMS), hoặc thiết lập **Rate Limit 5 registrations/IP/15 minutes** trên Cloudflare.
    2.  Nhân viên đối chiếu thực tế: Chỉ duyệt check-in khi khách hàng xuất trình đúng bài đăng chính chủ trên trang cá nhân trùng khớp với họ tên đăng ký.

### 🟢 Lỗ hổng P2: Lộ mã passcode bí mật
*   **Nguy cơ:** Mã passcode static `AURA66` bị chia sẻ ra ngoài nhóm chat Sa Đéc, người ở nhà cũng có thể tự check-in.
*   **Giải pháp:** POS sẽ sinh mã passcode động 6 số (Dynamic OTP) thay đổi mỗi 5 phút hiển thị trên màn hình phụ của quầy thu ngân. Khách hàng bắt buộc phải nhập đúng mã đang hiển thị tại quầy để hoàn tất.

---

## 3. Hiệu Năng & Tải Hệ Thống (Performance Review)

*   **D1 Database Connection:** Ngày khai trương dự kiến có 500+ lượt check-in dồn dập. Cloudflare D1 hỗ trợ tốt nhưng cần đảm bảo các truy vấn truy xuất thông tin khách hàng được đánh INDEX chuẩn xác:
    ```sql
    CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
    CREATE INDEX IF NOT EXISTS idx_checkin_logs_month ON checkin_logs(customer_id, checkin_month);
    ```
*   **Asset Caching:** File `checkin.html` và các file CSS/JS liên quan phải được cấu hình cache tĩnh dài hạn trên CDN Cloudflare để giảm thiểu thời gian tải trang dưới kết nối 4G yếu tại quán.

---

## 4. Kết Luận & Hành Động Tiếp Theo (Action Items)

1.  **Duyệt Thiết Kế:** Kế hoạch đạt yêu cầu kiến trúc v3, sẵn sàng đưa vào phát triển.
2.  **Hành động P0:** Bổ sung kiểm tra Staff/Owner JWT Token tại API `POST /api/loyalty/checkin`.
3.  **Tối ưu DB:** Thêm script migration index database cùng với bảng `checkin_logs`.
