# PENCIL NODE-BASED PROMPT (AURA SPACE)
*(Lỗi bản trước: Prompt cũ mang tính chất vẽ tranh như Midjourney/AI Images nên Pencil không hiểu hình học. Lần này, Prompt đã được ép khuôn dạng cấu trúc Node, Text, Frame, Fill của UI Design, đảm bảo ra đúng chữ AURA SPACE đàng hoàng).*

Copy từng cụm này ném cho Pencil AI:

---

### **Prompt 1: Khởi tạo Board & Text AURA SPACE**
"Pencil, hãy vẽ một Bảng Brand Guideline bằng các Node giao diện cho thương hiệu cà phê AURA SPACE.
1. Tạo 1 Frame gốc lớn: `width: 1440, layout: "vertical", gap: 60, padding: 80, fill: "#0A0A0A" (Nền Đen Sâu)`.
2. Đầu trang, tạo một Text Node nội dung đúng từng chữ: **'AURA SPACE'**. Cài đặt font: 'Cormorant Garamond', kích thước 120, màu Vàng Gold (`#C9A200`), in hoa.
3. Bên dưới tạo Text Node phụ nội dung: **'BRAND IDENTITY & GUIDELINE'**, font: 'Space Grotesk', kích thước 32, màu Trắng (`#F5F5F5`)."

---

### **Prompt 2: Layout Bảng Màu Công Nghiệp**
"Tiếp tục thêm vào Frame hệ thống Bảng Nhận Diện Màu Sắc:
1. Tạo một Frame nằm ngang (layout horizontal, gap 40).
2. Tạo 4 hình vuông con (Frame kích thước 120x120), bo góc 4px.
3. Lần lượt đổ màu Fill cho 4 hình vuông này là: `#0A0A0A` (Midnight), `#1A1A1A` (Steel), `#C9A200` (Gold), `#FFD700` (Electric Neon).
4. Bên dưới mỗi ô vuông, gắn kèm các Text Node kích thước 16, màu Xám nhạt (`#9E9E9E`), ghi rõ text mã màu trên. Cấu trúc đóng thành AutoLayout dọc để chúng thẳng hàng với nhau."

---

### **Prompt 3: Xây dựng Logo Bằng Giao Diện Hình Học**
"Bây giờ hãy vẽ bộ 3 Layout Logo cho AURA SPACE bằng các UI Node nguyên thủy:
1. **Container Logo:** Tạo một Rectangular Frame ngang (kích thước khoảng 600x200), **KHÔNG có fill**, chỉ có `stroke` viền màu Vàng dày 4px. Bên trong căn giữa một Text Node chữ **'AURA SPACE'** to, rõ ràng, màu Vàng.
2. **Neon Layout:** Tạo Text Node chữ **'AURA SPACE'** font Space Grotesk. Thêm thiết lập `drop shadow` hoặc glow filter rực rỡ với màu Neon Amber (`#FFB300`) để nó phát sáng xuyên màn hình. Chèn một vòng elip bên ngoài nét rỗng, phát sáng tương tự.
3. **Biển Hiệu:** Tạo Frame nền xám khói `#1A1A1A`. Đặt dòng chữ **'AURA SPACE'** màu Vàng sáng, bên dưới bổ sung dòng Text Node mỏng chữ **'ROOFTOP'**."
