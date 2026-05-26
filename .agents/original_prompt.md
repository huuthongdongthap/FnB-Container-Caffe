## 2026-05-26T13:01:09Z

# Teamwork Project Prompt — Bazi-aligned Aura Cafe UI Overhaul

Deep check, cải tiến và đồng bộ hóa toàn bộ giao diện (UI/UX) của hệ thống Aura Cafe bám sát theo Bát tự (Bazi) của Nhật chủ Nguyễn Hữu Còn (Nhật chủ 壬 Thủy Dương, hỗ trợ bởi 庚/辛 Kim và 乙 Mộc, cấm kỵ tuyệt đối các tông màu Hỏa & Thổ) nhưng vẫn đảm bảo tính thẩm mỹ cao, hiện đại và thu hút khách hàng tối đa.

Working directory: /Users/mac/mekong-cli/FnB-Container-Caffe
Integrity mode: development

## Requirements

### R1. UI Audit & Banned Elements Elimination
- Tiến hành rà soát chuyên sâu toàn bộ 11 trang HTML của dự án (bao gồm index.html, menu.html, checkout.html, success.html, failure.html, loyalty.html, track-order.html, kds.html, table-reservation.html, about-us.html, contact.html, brand-guideline.html).
- Loại bỏ hoàn toàn tất cả các màu thuộc tông Hỏa & Thổ bị cấm:
  - Tông Gold/Thổ: #FFD700, #D4AF37, #B8860B, #FFE970
  - Tông Cam đỏ/Hỏa: #FF6B35, #FF1744
  - Tông Nâu đất/Thổ: #8B4513, #C9A200, #C9A962
- Đảm bảo không sử dụng các font chữ không bám Bát tự spec như Playfair Display, Cinzel, Manrope, Inter.

### R2. Apply Bazi-aligned Color Tokens & Typography (Brand v5)
- Đồng bộ hóa file CSS chính css/brand-tokens.css lên phiên bản v5.0 BAZI-CORRECT:
  - Nhật chủ 壬 Thủy (Chủ đạo): Sử dụng các gam màu tối/sâu sang trọng như Đêm Biển (#0A1A2E), Đại Dương (#1A2A4E), Vực Thẳm (#050D1A).
  - Accent 庚/辛 Kim (Kim sinh Thủy): Sử dụng gam màu Bạc Kim (#C9D6DF), Chrome (#6B9FB8), Steel Blue (#3A6B80).
  - Zoning 乙 Mộc (Cân bằng & Hóa giải): Sử dụng gam màu Rừng Sâu (#1A2D1F), Forest (#2D5A3D), Jade (#4A7C59), Sương Mai (#A8C5A0).
- Áp dụng Typography chuẩn:
  - Font Heading: 'Cormorant Garamond', serif (Thanh thoát, sang trọng).
  - Font Body: 'Space Grotesk', sans-serif (Hiện đại, tối giản).
  - Font Tech/Prices: 'JetBrains Mono', monospace.

### R3. Premium UI & Glassmorphism Overhaul
- Cải tiến giao diện của các trang chính (index.html, menu.html, checkout.html, loyalty.html, table-reservation.html) đạt chuẩn thiết kế premium:
  - Áp dụng hiệu ứng Glassmorphism subtle (nền mờ nhẹ, border mỏng tinh tế).
  - Khoảng cách (spacing) và lưới (grid/flex) cân đối, tối ưu hóa giao diện di động.
  - Sử dụng các hiệu ứng hover mượt mà và micro-animations nâng tầm trải nghiệm thị giác.
- Đảm bảo decoupling hoàn toàn thông tin liên quan đến bạn Minh Tú (không còn tham gia), chuyển vai trò Mộc Zone thành giải pháp tự nhiên cân bằng phong thủy cho quán container.

### R4. Water Ripple Hero Animation v8 Bazi Chrome
- Thiết kế/nâng cấp hiệu ứng gợn sóng nước (Water Ripple) tại Hero Section của index.html xoay quanh chữ A và logo Aura Cafe:
  - Chuyển đổi toàn bộ từ Gold sang Chrome-Silver gradient (#E8EEF3 -> #C9D6DF -> #6B9FB8).
  - Ripples mịn, mượt mà, phản chiếu ánh sáng dịu nhẹ cool blue undertone.
  - Specular sweep và hiệu ứng phát sáng logo sang trọng.

## Acceptance Criteria

### 1. Bazi Color & Typography Compliance (Automated Checks)
- [ ] Không còn bất kỳ mã màu Gold, Đỏ, Cam, Nâu đất (Hỏa & Thổ) nào tồn tại trong các file CSS hoặc HTML.
- [ ] Mọi trang HTML đều liên kết thành công css/brand-tokens.css v5.0 và hiển thị đúng font chữ Cormorant Garamond & Space Grotesk.
- [ ] Rationale phong thủy trong brand-guideline.html được cập nhật chính xác theo Bát tự của anh Còn.

### 2. UI Aesthetics & Responsive Layout
- [ ] Giao diện các trang hiển thị hoàn hảo trên Mobile (không bị overflow-x, text không bị đè, các button dễ thao tác).
- [ ] Các thành phần thẻ (cards), nút (buttons), thanh điều hướng (nav) áp dụng đồng bộ ngôn ngữ thiết kế mới (Navy, Chrome-Silver, Mộc Zone).
- [ ] Hiệu ứng gợn sóng nước trên trang chủ hoạt động ổn định ở tốc độ 60fps, không gây giật lag trên thiết bị di động.
