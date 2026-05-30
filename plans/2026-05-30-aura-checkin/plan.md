# 🎟️ LUỒNG CHECK-IN KHAI TRƯƠNG AURA CAFE 6/6 — Kế Hoạch Triển Khai (FnB Cafe)

> **Mục Tiêu:** Thiết lập và đồng bộ hóa luồng Check-in 2 giai đoạn cho dịp khai trương tháng 6 của Aura Cafe Sa Đéc theo đúng đặc tả của **Hồ sơ Chiến dịch Loyalty v3 (30/5)**. Tạo lan tỏa viral hữu cơ (UGC) và cộng thưởng/giảm giá trực tiếp qua POS.

---

## 1. Cơ Chế Chiến Dịch Check-in (V3 Rules)

Khách hàng quét QR Standee tại quán để dẫn tới trang `/checkin` và thực hiện:
*   Chụp ảnh check-in tại quán và đăng Facebook/Zalo có tag `@aurasadec` + hashtag `#AURACafeSaDec`.
*   **Cap Giới Hạn:** Mỗi khách hàng chỉ được tham gia **1 LẦN DUY NHẤT trong tháng 6/2026** (chọn 1 trong 2 giai đoạn).

| Giai Đoạn | Thời Gian | Quyền Lợi | Cơ Chế Phân Phối |
| :--- | :--- | :--- | :--- |
| **Phase 1: Tuần Khai Trương** | 06/06 – 13/06 | **Cộng 20.000đ** vào ví | Khách đưa ảnh screenshot cho staff duyệt → Staff scan QR Loyalty trên POS → Thực hiện cộng ví ngay lập tức. |
| **Phase 2: Sau Khai Trương** | 14/06 – 30/06 | **Giảm 10% trực tiếp** | Khách đưa ảnh check-in → Staff duyệt trên POS → Trừ thẳng 10% bill đơn hiện tại (không cộng tích lũy ví). |

---

## 2. Các Thành Phần Kỹ Thuật (Components)

### A. Frontend Web Application (`FnB-Container-Caffe/`)
1.  **Trang Check-in mới (`checkin.html` / `/checkin`):** Trang Mobile-first tuyệt đẹp, hiển thị QR/hướng dẫn cách đăng bài, nút upload screenshot và màn hình thành công mờ kính (Glassmorphism).
2.  **Cập nhật POS (`admin/pos.html`):** Thêm nút quét QR/Loyalty Code để thực hiện "Log Check-in" cho khách, kích hoạt API cộng ví 20k hoặc giảm 10% hóa đơn.

### B. Backend API Integration (Cloudflare Workers & D1)
1.  `POST /api/loyalty/checkin`: Validate campaign active, chèn bản ghi check-in, cộng 20k nếu Phase 1, trả về discount 10% nếu Phase 2.
2.  `GET /api/loyalty/checkin/:customer_id/today`: Check trạng thái check-in của khách để giao diện ẩn/hiển thị nút.

---

## 3. Lộ Trình Thực Thi
*   **Bước 1:** Chuẩn bị Schema DB (migration bảng `checkin_logs` với UNIQUE constraint tháng 6).
*   **Bước 2:** Xây dựng backend API xử lý check-in trên Cloudflare Worker.
*   **Bước 3:** Tạo trang frontend `checkin.html` chuẩn Bát tự v5.1 (Pearl-Silver & Navy Theme).
*   **Bước 4:** Tích hợp POS check-in action và kiểm thử E2E 5 kịch bản trước ngày 5/6.
