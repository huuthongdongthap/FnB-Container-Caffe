# DESIGN AUDIT & COMPETITOR BENCHMARK — BẢN IN A3 TUYỂN DỤNG F&B

**Dự án:** AURA CAFE — F&B Container Caffe  
**Tài liệu:** `reports/design/sprint/design-audit.md`  
**Giai đoạn:** Design Sprint — Phase 1: Understand (Competitor & In-Store Print Audit)  
**Ngày lập:** 13/10/2026  

---

## 1. Khảo sát Hiện trạng & Đối thủ (Benchmarking)

| Tiêu chí | Quán truyền thống / Local cafe | Chuỗi F&B lớn (The Coffee House, Cheese Coffee) | Chuẩn đề xuất cho AURA CAFE (A3 Print) |
| :--- | :--- | :--- | :--- |
| **Hình thức in ấn** | Giấy A4 in trắng đen dán cửa kính hoặc bạt Hiflex chữ đỏ nền vàng | Standee A1/A2, Poster in Decal bồi Formex, thiết kế chuyên nghiệp | **Bản in A3 (297×420 mm) decal bồi Formex 5mm hoặc Mica kẹp quầy thu ngân & khung gỗ rooftop** |
| **Bản sắc thị giác** | Không có hệ thống nhận diện, dùng font mặc định Arial/Times | Theo Brand guideline khắt khe, tone màu nhận diện đồng nhất | **Industrial Luxury (Deep Navy `#050D1A`, Bạc Chrome `#C9D6DF`, Warm Bronze `#EFBD8A`)** |
| **Bố cục thông tin** | Liệt kê dày đặc yêu cầu tuyển dụng, chữ nhỏ | Tập trung vào hình ảnh con người & văn hóa làm việc | **Cấu trúc 4 tầng rõ ràng: Header -> 3 Vị trí -> 4 Quyền lợi -> QR Scan & Hotline** |
| **Phương thức nộp hồ sơ** | "Nộp hồ sơ trực tiếp tại quầy gặp chủ quán" | Cổng tuyển dụng website rườm rà 5 bước | **Mã QR trực tiếp (Zalo/Form ứng tuyển 60s) + Hotline gọi/nhắn Zalo** |
| **Kích thước mã QR** | Không có hoặc in méo mó nhỏ hơn 1.5 cm | QR tiêu chuẩn 2.5 - 3 cm | **QR Code lớn 35×35 mm, có viền tương phản cao, quét được từ 1.5m** |

---

## 2. Các lỗi chí mạng cần tránh (Critical Anti-Patterns)

1. **Text Clutter (Bội thực thông tin):**
   - *Lỗi:* Viết dài dòng "Mô tả công việc: lau dọn bàn ghế, quét nhà, rửa ly chén, kiểm tra hạn sử dụng nguyên vật liệu...".
   - *Khắc phục:* Thay thế bằng 2 gạch đầu dòng cô đọng cho từng vị trí. Chi tiết công việc sẽ trao đổi khi phỏng vấn.
2. **Kém tương phản trong môi trường quán cà phê:**
   - *Lỗi:* Dùng chữ xám trên nền đen hoặc chữ vàng nhạt trên nền trắng khiến ánh sáng vàng của đèn quán làm mờ mắt.
   - *Khắc phục:* Độ tương phản chuẩn WCAG AAA trên bản in: Chữ bạc trắng `#F0F4F8` và vàng kim `#FFD700` trên nền xanh đen tuyền `#050D1A`.
3. **Mã QR không quét được:**
   - *Lỗi:* Để mã QR quá gần đáy poster hoặc góc khuất; dùng mã QR màu tối dán trên nền tối thiếu quiet zone (vùng đệm trắng).
   - *Khắc phục:* Khung QR nền trắng viền bo góc, đặt ở độ cao tầm mắt/ngực người đứng (tầng 4 của poster), kèm icon hướng dẫn trực quan 📱.

---

## 3. Tiêu chuẩn Kỹ thuật In ấn Khổ A3 (Print Specs)

- **Kích thước chuẩn:** 297 mm (ngang) × 420 mm (cao) (Tỉ lệ căn bậc 2: 1 : √2).
- **Vùng an toàn (Safe Margin):** Cách mép cắt tối thiểu 12 mm để không bị che khuất bởi khung nẹp hoặc chân standee.
- **Vùng xén (Bleed):** 3 mm bao quanh biên.
- **Độ phân giải:** Vector 100% SVG (vô hạn độ phân giải), chuyển đổi xuất file in TIFF/PDF 300 - 600 DPI không bể hạt.
- **Hệ màu:** Chuyển đổi mã Hex chuẩn sang không gian CMYK cho xưởng in:
  - Deep Navy `#050D1A` -> C:90 M:80 Y:60 K:85 (Đen tuyền có ánh xanh sâu).
  - Chrome Silver `#C9D6DF` -> C:15 M:10 Y:10 K:0.
  - Warm Bronze / Gold `#EFBD8A` / `#FFD700` -> C:5 M:30 Y:85 K:0.
- **Vật liệu gia công đề xuất:**
  - Decal PP mờ (Matte) cán màng chống chói bồi Formex 5mm (cho quầy order và kệ chữ A).
  - Hoặc Giấy Couche 300gsm cán màng mờ lồng khung nhôm viền đen treo tường.
