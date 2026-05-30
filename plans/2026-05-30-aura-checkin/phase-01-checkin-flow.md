# Phase 01: Thiết Kế Cơ Sở Dữ Liệu & Phát Triển API Check-In

Chi tiết triển khai kỹ thuật cho luồng Check-in Loyalty v3 của Aura Cafe.

---

## 1. Cơ Sở Dữ Liệu (Database Migration)

Bảng `checkin_logs` cần kiểm soát chặt chẽ giới hạn 1 lần/thành viên/tháng bằng khóa UNIQUE:

```sql
-- Migration file: db/migrations/0041_add_checkin_logs.sql
CREATE TABLE IF NOT EXISTS checkin_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    campaign_code TEXT NOT NULL, -- 'CHECKIN_WEEK_6_6' hoặc 'CHECKIN_DISCOUNT_THANG_6'
    checkin_month TEXT NOT NULL,  -- Định dạng 'YYYY-MM' (ví dụ: '2026-06') để làm khoá UNIQUE
    screenshot_url TEXT,
    staff_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(customer_id) REFERENCES customers(id),
    UNIQUE(customer_id, checkin_month) -- Khách hàng chỉ được check-in tối đa 1 lần mỗi tháng
);
```

---

## 2. Thiết Kế Router & API Backend

### A. Endpoint `POST /api/loyalty/checkin`
*   **Logic Xử Lý:**
    1.  Nhận payload: `{ customer_id, campaign_code, staff_id, screenshot_url? }`
    2.  Xác định tháng hiện tại dạng `YYYY-MM`.
    3.  Chèn vào bảng `checkin_logs`. Nếu phát sinh lỗi `UNIQUE constraint failed`, bắt lỗi và trả về mã phản hồi `400` với thông báo "Khách hàng đã tham gia check-in trong tháng này rồi."
    4.  **Nếu `campaign_code` là `CHECKIN_WEEK_6_6` (Phase 1):**
        *   Tạo giao dịch `cashback_transactions` với giá trị `+20000`.
        *   Cập nhật số dư trong ví cashback của khách hàng.
    5.  **Nếu `campaign_code` là `CHECKIN_DISCOUNT_THANG_6` (Phase 2):**
        *   Trả về mã thành công kèm thuộc tính `discount_pct = 10` để POS tự động áp giảm giá trên hóa đơn.

### B. Endpoint `GET /api/loyalty/checkin/:customer_id/status`
*   **Mục đích:** Trả về trạng thái check-in của khách hàng trong tháng 6 để giao diện POS hiển thị huy hiệu hoặc vô hiệu hóa nút bấm.
*   **Response:** `{ checked_in: true/false, checkin_month: "2026-06", campaign_code: "..." }`

---

## 3. Giao Diện & Điều Hướng (Frontend / POS)

### A. Trang Quét QR cho Khách (`checkin.html`)
*   **Layout:** Glassmorphism mờ nhẹ trên nền hải quân sâu thẳm (`#060E1A`).
*   **Nhiệm vụ:** Hướng dẫn khách hàng thực hiện chụp ảnh thực tế tại quán, đăng bài lên FB/Zalo kèm hashtag `#AURACafeSaDec`. Khách chụp ảnh màn hình và click "Tôi đã đăng xong" để chuyển tới màn hình quét mã Loyalty.

### B. Màn hình POS Nhân Viên (`admin/pos.html`)
*   Bổ sung nút bấm **"Duyệt Check-in"** bên cạnh trường thông tin hội viên.
*   Nhân viên nhìn ảnh chụp màn hình khách đưa → click "Duyệt" → Hệ thống gọi API `POST /api/loyalty/checkin` để tự động cộng tiền hoặc giảm giá hóa đơn hiện tại.
