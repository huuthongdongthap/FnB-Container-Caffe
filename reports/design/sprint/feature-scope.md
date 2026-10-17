# FEATURE & CONTENT SCOPE SPECIFICATION — BẢN IN A3 TUYỂN DỤNG AURACAFE

**Dự án:** AURA CAFE — F&B Container Caffe (29 Nguyễn Tất Thành, TP. Sa Đéc, Đồng Tháp)  
**Tài liệu:** `reports/design/sprint/feature-scope.md`  
**Giai đoạn:** Design Sprint — Phase 2: Create (Feature Scope Revision 3)  
**Ngày cập nhật:** 14/10/2026  

---

## 1. Mục tiêu Nội dung & Phạm vi Thông tin (Scope Definition)

Bản in A3 Tuyển dụng AURACAFE được chuẩn hóa thông tin cô đọng, loại bỏ hoàn toàn các đoạn văn thừa, tuân thủ nguyên tắc "Scanning in 5 Seconds" của thiết kế quảng cáo ngoài trời và tại điểm bán (POSM) theo chuẩn Material Design 3 (M3 Strict Mode).

---

## 2. Chi tiết 4 Phân vùng Nội dung (4 Visual Zones)

### ZONE 1: BRAND HEADER & CALL-OUT (Tầm nhìn từ xa 3m)
- **Master Brand Plaque AURA:** Khung Elevated Surface Container viền đôi kim loại Gold/Chrome, nhúng toàn bộ lockup Master Logo (Emblem Thủy essence + Typography AURA CAFE dập nổi mạ bạc, bảo toàn 100% nét chữ uốn lượn).
- **Tagline Capsule:** `CONTAINER ROOFTOP · 29 NGUYỄN TẤT THÀNH, SA ĐÉC`.
- **Đại tự Tiêu đề:** `THÔNG BÁO TUYỂN DỤNG` (M3 Headline Medium).
- **Phụ đề:** `JOIN OUR TEAM · WE ARE HIRING` (M3 Label Large).

### ZONE 2: CÁC VỊ TRÍ ỨNG TUYỂN (Tầm nhìn 1.5m)
Bố trí 2 thẻ vị trí M3 Elevated Card (chiều cao 58mm mỗi thẻ) thoáng đãng, cân đối thị giác:

1. **Thẻ 01: BARISTA (PHA CHẾ)**
   - *Hình thức:* Full-time · Part-time
   - *Mô tả:* Pha chế cà phê máy espresso, trà signature, kiểm soát định lượng đồ uống.
   - *Yêu cầu:* Đam mê pha chế, sạch sẽ, vui vẻ · Chưa có kinh nghiệm được đào tạo bài bản từ đầu.
   - *Mức thu nhập:* **15.000đ - 20.000đ/giờ (15k - 20k/h)** + Thưởng ca + Tips.

2. **Thẻ 02: THU NGÂN & PHỤC VỤ**
   - *Hình thức:* Xoay ca linh hoạt
   - *Mô tả:* Chào đón khách hàng, nhận order qua máy POS/Tablet, phục vụ bàn & giữ gìn không gian.
   - *Yêu cầu:* Nhanh nhẹn, nụ cười thân thiện, trung thực, tinh thần đồng đội tốt · Ca sáng / chiều / tối.
   - *Mức thu nhập:* **15.000đ - 20.000đ/giờ (15k - 20k/h)** + Thưởng ca + Tips.

*(Đã tinh giản vị trí số 3 - Trưởng ca theo quyết định tối ưu hóa vận hành).*

### ZONE 3: QUYỀN LỢI & VĂN HÓA LÀM VIỆC (Perks & Culture)
Thể hiện dạng 4 ô biểu tượng (M3 Outlined Container) tương phản cao:
- 🕒 **Ca làm linh hoạt:** Ca 1 (6h-14h) · Ca 2 (14h-22h) · Ca 3 linh hoạt (Part-time / xoay ca theo lịch học & tuần).
- 💰 **Đãi ngộ xứng đáng:** Lương trả đúng hẹn · Tiền tip chia đều hàng tuần.
- ☕ **AURA VIP Privilege:** Ưu đãi menu cho nhân viên & bạn bè · Ưu tiên trải nghiệm menu đồ uống mới.
- 🚀 **Đào tạo & Phát triển:** Đào tạo nghề Barista & kỹ năng dịch vụ · Lộ trình thăng tiến rõ ràng lên Quản lý quán.

### ZONE 4: KÊU GỌI HÀNH ĐỘNG & THÔNG TIN LIÊN HỆ (Call-To-Action)
- **Cụm QR Code Vector:** Mã ma trận vector chính xác 29×29 dẫn đến trang tuyển dụng `https://auraspace.cafe/tuyen-dung` (Điền form 60s, không cần CV giấy).
- **Hotline / Zalo Tuyển dụng:** **0986.470.981** (Hỗ trợ 24/7).
- **Địa chỉ làm việc:** **29 Nguyễn Tất Thành, TP. Sa Đéc, Đồng Tháp** (Đối diện Khách sạn Thảo Trâm 2).
- **Kênh thông tin:** Website: `auraspace.cafe` · Fanpage: `fb.com/auracafesadec`.

---

## 3. Ma trận Quyết định Kỹ thuật (Technical Constraints)

| Thuộc tính | Giới hạn kỹ thuật | Giải pháp triển khai |
| :--- | :--- | :--- |
| **Kích thước file** | A3 (297 × 420 mm) | Tỉ lệ chuẩn DIN 476, viewBox="0 0 297 420" (unitless coordinates) |
| **Định dạng file** | Vector SVG & Proof PNG | 100% Vector paths, text render chính xác, không vỡ hạt |
| **Font chữ bản in** | Tránh lỗi font tiếng Việt khi in ấn | Font hệ thống & Web-safe Unicode (Playfair Display, Inter, Arial, sans-serif) |
| **Màu sắc in ấn** | Chống xỉn màu khi in trên decal/formex | Hệ màu M3 Dark Surface (`#050D1A`, `#0E223D`, `#172B45`) kết hợp Gold Metallic (`#FFD700`, `#EFBD8A`) |
| **QR Code Link** | Kết nối trực tiếp hệ thống tuyển dụng | Trực tiếp dẫn về `https://auraspace.cafe/tuyen-dung` |
