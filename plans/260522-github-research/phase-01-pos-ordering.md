# 💳 Phase 1: Hệ Thống POS & Đặt Hàng Online (Ordering)

Trụ cột cốt lõi của AURA CAFE cần sự bền bỉ (chạy được Offline khi mất mạng) và tối ưu hóa quy trình order tại bàn hoặc online.

---

## 1. Hệ Thống POS (Bán Hàng Tại Quầy)

### 🥇 Top 1: [Odoo POS (Community Edition)](https://github.com/odoo/odoo)
*   **Đánh giá (Stars):** ~35k+ stars
*   **Giấy phép:** LGPL v3 (Mở hoàn toàn cho bản Community)
*   **Điểm phù hợp:** **9.5/10**
*   **Lý do chọn:** 
    *   Tích hợp sẵn hệ thống Inventory (Kho) và Accounting (Kế toán).
    *   **Offline-first:** Trình duyệt lưu trữ transaction bằng IndexedDB, tự động đồng bộ khi có mạng lại. Rất phù hợp cho mô hình quán container ngoài trời tại Sa Đéc thường gặp sự cố mạng di động.
    *   Có cộng đồng lập trình viên Việt Nam rất lớn để hỗ trợ xử lý hóa đơn điện tử (thông tư 78/nghị định 123).

### 🥈 Top 2: [opensourcepos/opensourcepos](https://github.com/opensourcepos/opensourcepos)
*   **Đánh giá (Stars):** ~4.2k stars
*   **Giấy phép:** MIT
*   **Điểm phù hợp:** **8.0/10**
*   **Lý do chọn:** Cực kỳ gọn nhẹ, viết bằng PHP/CodeIgniter, chạy mượt trên các máy tính cấu hình thấp hoặc máy tính bảng cũ tại quầy bar.

---

## 2. Hệ Thống Đặt Món Online (Online Ordering)

### 🥇 Top 1: [TastyIgniter/TastyIgniter](https://github.com/tastyigniter/TastyIgniter)
*   **Đánh giá (Stars):** ~1.5k stars
*   **Giấy phép:** MIT
*   **Điểm phù hợp:** **9.0/10**
*   **Lý do chọn:** 
    *   Được thiết kế chuyên biệt cho F&B (không như WooCommerce chung chung).
    *   Có sẵn quản lý Delivery Zones (Vùng giao hàng) giúp vẽ bản đồ ship quanh khu vực TP. Sa Đéc không mất % hoa hồng cho bên thứ ba.
    *   Giao diện responsive sang trọng, dễ dàng tùy biến sang tông màu Industrial-Luxury của quán.

---

## 3. Cổng Thanh Toán Không Tiền Mặt (Vietnamese Payments)

### 🥇 Top 1: [payOSHQ (Official payOS SDKs)](https://github.com/payOSHQ)
*   **Giấy phép:** MIT
*   **Điểm phù hợp:** **9.8/10**
*   **Lý do chọn:** 
    *   Giải pháp tối ưu nhất hiện nay tại VN để làm **Auto-Reconciliation** (tự động nhận diện tiền chuyển khoản qua VietQR động và xác nhận đơn hàng trên web).
    *   SDK Node.js (`payos-lib-node`) và PHP cực kỳ sạch đẹp, tài liệu rõ ràng. Giúp quán tiết kiệm hàng triệu đồng phí cổng thanh toán so với các cổng truyền thống.

---

## 📊 Bảng So Sánh Lựa Chọn POS & Ordering

| Giải pháp | GitHub Stars | Giấy phép | Điểm mạnh tại Sa Đéc |
| :--- | :---: | :---: | :--- |
| **Odoo POS** | **35k+** | LGPL v3 | All-in-one, chạy offline, tương thích hóa đơn điện tử VN |
| **TastyIgniter** | **1.5k** | MIT | Quản lý zone giao hàng riêng, giao diện F&B chuyên nghiệp |
| **payOS SDK** | **Official** | MIT | VietQR động tự động duyệt đơn hàng trong 3 giây |
