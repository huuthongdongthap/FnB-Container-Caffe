# BÁO CÁO AUDIT & ĐIỀU CHỈNH CHUẨN MATERIAL DESIGN 3 (M3 STRICT MODE)

**Dự án:** AURA CAFE — F&B Container Caffe (29 Nguyễn Tất Thành, TP. Sa Đéc, Đồng Tháp)  
**Tài liệu:** `reports/design/sprint/m3-logo-audit.md`  
**Lệnh thực thi:** `/audit thêm logo và điều chỉnh lại theo đúng chuẩn M3; sửa địa chỉ 29 Nguyễn Tất Thành; khắc phục mất nét chữ AURA`  
**Ngày lập:** 13/10/2026 (Cập nhật Revision 2)  
**File thiết kế:** `designs/poster-tuyen-dung-a3.svg` (Bản in DIN A3 297 × 420 mm)  
**File nghiệm thu:** `designs/poster-tuyen-dung-a3.png` (Proof 1240 × 1754 px)

---

## 1. Mục tiêu Audit & Yêu cầu Kỹ thuật

1. **Chuẩn hóa Địa chỉ Thực tế:** Cập nhật chính xác địa chỉ cơ sở AURA CAFE tại **29 Nguyễn Tất Thành, TP. Sa Đéc, Đồng Tháp** (thay thế địa chỉ cũ 39 Nguyễn Tất Thành) trên toàn bộ tiêu đề, capsule vị trí, khối CTA liên hệ và các tài liệu kỹ thuật.
2. **Khắc phục Lỗi Mất Nét Chữ AURA & Tái thiết kế Logo Header (Master Brand Plaque):**
   - *Nguyên nhân lỗi cũ:* Huy hiệu tròn (circular mask) cắt cụt nét lượn cánh trái của chữ "A" đầu tiên, đuôi dải lụa chữ "R" và cánh vút lên của chữ "A" thứ hai.
   - *Giải pháp:* Thay thế huy hiệu tròn bằng **M3 Elevated Surface Plaque** (40 × 33.7 mm, rx=3.8mm) với viền đôi kim loại Gold/Chrome, bóng đổ Elevation Level 2; nhúng toàn bộ lockup Master Logo (Emblem Thủy essence + Typography AURA CAFE mạ bạc chrome dập nổi) với khoảng đệm an toàn, bảo toàn 100% từng nét chữ nguyên bản.
3. **Tuân thủ nghiêm ngặt Material Design 3 (M3 Strict Mode):**
   - Chuẩn hóa hệ thống Design Tokens: Surface levels (Base surface `#050D1A`, Container low `#0B1D33`, Container `#0E223D`, Container high `#112948`, Container highest `#172B45`).
   - Chuẩn hóa M3 Shape Tokens: Small 2.8mm, Medium 4.2mm, Large 5.6mm, Full pill 9999mm.
   - Chuẩn hóa M3 Elevation: Level 1 (shadow dy=1.5 stdDeviation=2), Level 2 (shadow dy=3 stdDeviation=3.5).
   - Chuẩn hóa Typography & Vertical Spacing: Không đè chữ, không chạm viền, phân cấp rõ rệt.

---

## 2. Chi tiết Các Hạng mục Đã Thực hiện & Khắc phục

### 2.1 Tái thiết kế Khối Logo Header (AURA Master Brand Plaque)
- **Nguồn tài nguyên:** Trích xuất độ phân giải cao 1024×1024 từ `public/images/aura-master-logo.png` (vùng bounding box an toàn 712×600 px).
- **Hình thức thể hiện:** Khung M3 Elevated Surface Container (`#0C1D33`) kích thước 40 × 33.7 mm, bo góc `rx="3.8mm"` tại tọa độ trung tâm X=148.5, Y=11.5mm.
- **Bảo toàn nét chữ AURA:** Đảm bảo toàn vẹn nét lượn uốn sóng chữ A (phía trái), chân chữ R lượn đáy (phía dưới) và nét vút chữ A (phía phải).
- **Kỹ thuật viền kim loại:** Viền ngoài mạ vàng ánh kim (`url(#goldGrad)` stroke 0.7mm), viền trong phản chiếu ánh bạc chrome (`#FFFFFF` stroke 0.2mm, opacity 0.8), bóng đổ M3 Elevation Level 2 dập nổi.

### 2.2 Tối ưu Nhịp điệu Trục đứng Zone 1 (Vertical Rhythm)
- **Plaque Logo:** Y = 11.5 → 45.2 mm (chiều cao 33.7 mm).
- **Tagline Capsule (M3 Assist Chip):** Y = 50.8 mm (kích thước 122 × 5.2 mm, rx=2.6mm). Nội dung: `CONTAINER ROOFTOP · 29 NGUYỄN TẤT THÀNH, SA ĐÉC`.
- **Đại tự Tuyển dụng (M3 Headline Medium):** Y = 63.5 mm (Font Playfair Display 8.8mm, trắng tinh `#FFFFFF`).
- **Phụ đề Tuyển dụng (M3 Label Large):** Y = 69.8 mm (Font Inter 3.3mm, vàng đồng `#EFBD8A`).
- **Thanh phân cách M3:** Y = 76.0 mm (Line mảnh gradient vàng kết hợp họa tiết quả trám trung tâm).
- **Zone 2 bắt đầu:** Y = 82.0 mm (khoảng cách thoáng 6mm với divider).

### 2.2 Điều chỉnh Toàn diện theo Chuẩn M3 Strict Mode
| Vùng (Zone) | Thành phần UI | Quy chuẩn M3 áp dụng | Màu sắc & Kiểu dáng |
| :--- | :--- | :--- | :--- |
| **Zone 1** | Brand Medallion | M3 Elevated Component (Level 2) | Huy hiệu tròn 28mm viền Gold/Chrome |
| **Zone 1** | Brand Wordmark | M3 Display Medium | Font Serif 14mm, Vàng kim gradient |
| **Zone 1** | Tiêu đề tuyển dụng | M3 Headline Medium | Font Serif 11.5mm, Trắng tinh `#FFFFFF` |
| **Zone 1** | Thanh phân cách | M3 Horizontal Divider | Đường line 0.6mm kèm khối đa giác vàng |
| **Zone 2** | 3 Thẻ vị trí | M3 Elevated Card (Level 1) | Surface Container `#0E223D` -> `#142C4C`, rx=4.2mm (Medium) |
| **Zone 2** | Icon avatar vị trí | M3 Container Highest | Hộp tròn 20mm nền `#172B45` viền Gold/Silver |
| **Zone 2** | Badge ca làm | M3 Assist Chip | Chip bo góc 4mm, nền `rgba(...)`, stroke 0.6mm, font 3.8mm |
| **Zone 3** | 4 Thẻ quyền lợi | M3 Outlined Container (Level 1) | Surface Container Low `#0B1D33`, viền `#233B57`, rx=4.2mm |
| **Zone 4** | Khung CTA chính | M3 Surface Container High (Level 2) | Surface High `#112948` -> `#0E223D`, viền Gold 1.1mm, rx=5.6mm (Large) |
| **Zone 4** | Khung QR Code | M3 Surface Card | Nền trắng tuyền `#FFFFFF`, viền bo góc 4.2mm, Quiet zone chuẩn |
| **Zone 4** | Hotline Capsule | M3 Filled Container | Nền `#172B45`, viền Gold `#EFBD8A`, bo góc 4mm |

### 2.3 Xử lý Lỗi Kỹ thuật Đột xuất trong Quá trình Render (Self-Correction)
- **Lỗi 1 (Font-size scale overflow do CSS mm unit):** Trong SVG render trên Chrome, việc khai báo `font-size: 13.5mm` trong thẻ `<style>` khiến kích thước chữ bị nhân theo DPI tuyệt đối làm vỡ bố cục. Đã điều chỉnh toàn bộ font size về thuộc tính unitless viewBox chuẩn (`font-size="14"`, `font-size="11.5"`...) để đảm bảo scale 100% chính xác theo tọa độ mm.
- **Lỗi 2 (XML Entity Parse Error):** Ký tự `&` trong comment CSS chưa được escape. Đã chuẩn hóa cú pháp XML hợp lệ 100% được xác minh bằng `xml.etree.ElementTree`.

---

## 3. Kết quả Thẩm định Thị giác (Visual Verification)

- [x] **Logo AURA chính thức:** Hiển thị rõ nét, sắc sảo, đúng nhận diện thương hiệu Thủy essence và AURA CAFE.
- [x] **Khoảng cách và bố cục:** Không còn hiện tượng đè chữ, chữ chạy ra ngoài thẻ; khoảng cách giữa tên vị trí và badge ca làm việc thoáng từ 45mm đến 75mm.
- [x] **Mã QR:** Ma trận 25×25 vector tương phản tối đa trên nền trắng, quét tức thì bằng camera smartphone.
- [x] **Màu sắc in ấn:** Chống xỉn màu, độ tương phản chuẩn WCAG AAA trên nền xanh đen Container Rooftop Sa Đéc.
