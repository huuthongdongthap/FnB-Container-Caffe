# 🌡️ Phase 3: IoT Smart Cafe, Menu Board & AI CCTV

Ứng dụng công nghệ phần cứng nguồn mở điều khiển thông minh giúp biến AURA CAFE thành một container hiện đại, an toàn và tối ưu điện năng.

---

## 1. IoT & Điều Khiển Thiết Bị Thông Minh

### 🥇 Top 1: [home-assistant/core](https://github.com/home-assistant/core)
*   **Đánh giá (Stars):** ~70k+ stars
*   **Giấy phép:** Apache 2.0
*   **Điểm phù hợp:** **10/10**
*   **Lý do chọn:**
    *   Hệ thống Smart Building nguồn mở phổ biến và mạnh mẽ nhất thế giới.
    *   **Tối ưu hóa HVAC (Máy lạnh):** Máy lạnh là chi phí điện lớn nhất của quán cafe container (do container hấp thụ nhiệt cao). Home Assistant kết hợp cảm biến nhiệt độ tự điều chỉnh nhiệt độ máy lạnh theo mật độ khách thực tế, giúp **tiết kiệm >20% tiền điện hằng tháng**.
    *   Tự động tắt toàn bộ đèn, bảng hiệu LED ngoài trời vào lúc 23:00 và bật đèn an ninh tự động.

---

## 2. AI CCTV & An Ninh Thông Minh (Smart Security)

### 🥇 Top 1: [blakeblackshear/frigate](https://github.com/blakeblackshear/frigate)
*   **Đánh giá (Stars):** ~15k+ stars
*   **Giấy phép:** MIT
*   **Điểm phù hợp:** **9.8/10**
*   **Lý do chọn:**
    *   Tự động nhận diện người và phương tiện (xe máy, ô tô của khách đến quán) theo thời gian thực mà không cần gửi dữ liệu lên cloud (bảo mật tuyệt đối, không tốn băng thông internet).
    *   **Bản đồ nhiệt mật độ khách (Heatmap):** Giúp chủ quán biết khu vực bàn nào trong container được khách ưa chuộng nhất để sắp xếp không gian decor tối ưu.
    *   Tích hợp trực tiếp vào Home Assistant để gửi cảnh báo đột nhập trực tiếp vào Telegram của chủ quán sau giờ đóng cửa.

---

## 3. Màn Hình Menu Điện Tử (Digital Signage Board)

### 🥇 Top 1: [xibosignage/xibo-cms](https://github.com/xibosignage/xibo-cms)
*   **Đánh giá (Stars):** ~1.1k stars
*   **Giấy phép:** AGPL v3
*   **Điểm phù hợp:** **9.0/10**
*   **Lý do chọn:**
    *   Quản lý toàn bộ các màn hình hiển thị menu nước tại quầy bar và ngoài trời.
    *   Cho phép lên lịch đổi menu tự động theo khung giờ (ví dụ: Menu sáng hiển thị các gói combo cà phê + bánh mì, Menu tối hiển thị các loại trà trái cây đặc sắc).

---

## 📊 Bảng Đánh Giá Đầu Tư Phần Cứng Nguồn Mở

| Hệ thống | Thiết bị cần thiết | Lợi ích kinh tế | Khả năng thu hồi vốn |
| :--- | :--- | :--- | :---: |
| **Home Assistant** | Raspberry Pi 4 + Cảm biến Zigbee | Tiết kiệm 20% chi phí điện container | **Nhanh** (Dưới 3 tháng) |
| **Frigate CCTV** | Camera IP sẵn có + Google Coral USB | Không tốn phí cloud an ninh, phân tích heatmap | **Dài hạn** (Bảo vệ tài sản) |
| **Xibo Signage** | Tivi cũ + Android Box giá rẻ | Tiết kiệm chi phí in ấn menu giấy khi thay đổi món | **Nhanh** |
