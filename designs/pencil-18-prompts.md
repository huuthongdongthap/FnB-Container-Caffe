# Bộ 18 Prompts Cốt Lõi Cho Giao Diện AURA SPACE

> Thiết kế tối ưu cho Pencil.dev sử dụng cấu trúc "100X Max Level UI" & Cyber-Glass. 
> Bấm 📎 (GHIM) tệp `ARCHITECTURE.md` vào chat trước khi copy các lệnh sau vào con bot AI!

---

## 📱 Dòng 1: Các Trang Khách Hàng Cốt Lõi (Customer Core App)

### 1. Trang Chủ Hiện Đại (index.html)
Thiết kế UI cho Trang Chủ. 
- Môi trường: Dark Theme Cyberpunk. Kích thước Desktop.
- Chi tiết: Top App Bar mờ dính (Glassmorphism blur 12px) chứa Logo và Menu. 
- Hero Section: Nền cảnh Neon rực rỡ (night-4k.png làm nền mờ hắt sáng nổi lên giữa 2 khu nhà dân), Headline gradient "AURA SPACE", CTA "Đặt bàn ngay" (Neon Yellow).
- Grid 6 khu vực trải nghiệm (Sân Đỗ Xe Mặt Tiền, Lõi Quầy Bar Container Trệt, Lối Lên Cầu Thang, Rooftop Dưới Canopy, Góc Ngắm Phố, Background Đối Điện Hotel Thảo Trâm).

### 2. Trang Menu Chính (menu.html)
Thiết kế trang Menu Đồ Uống.
- Sidebar cố định bên trái chứa 4 Categories (Coffee, Signature, Food, Combo). 
- Khu vực chính: Grid (lưới) các Product Cards. Mỗi Card có hiệu ứng Glassmorphism, bo góc 12px, Tên font Space Grotesk, Giá font Inter màu Amber Glow, Nút (+) đặt góc phải dưới cùng. Ô tìm kiếm cong mềm mại.

### 3. Trang Thanh Toán (checkout.html)
Thiết kế trang Thanh Toán Đơn Hàng (Checkout Workflow).
- Cột bên trái: Form thông tin cá nhân (Tên, SĐT, Ghi chú) bo tròn M3. Tiếp theo là 3 phương thức thanh toán (Tiền mặt, VietQR, Thẻ) với viền Glow Neon Cyan khi active.
- Cột bên phải: Tóm tắt đơn hàng (Order Summary). Dòng tạm tính, thuế, tổng cộng. CTA "Thanh Toán Ngay" phát sáng cường độ cao.

### 4. Đặt Bàn Trực Tuyến (table-reservation.html)
Thiết kế giao diện Đặt bàn online (Table Reservation).
- Grid 2 cột (split layout). Trái: Form chọn ngày, giờ, số khách. Bảng chọn giờ dạng Chip. Phải: Bản đồ mặt bằng thu nhỏ. Các bàn đang trống màu viền Xanh, bàn đang được user click vào sẽ có hiệu ứng viền chớp nhảy Pulse Glow đỏ nhạt. CTA Xác Nhận.

### 5. Khách Hàng Thân Thiết (loyalty.html)
Thiết kế Màn hình Tích Điểm Thành Viên.
- Header User (Avatar, tên, "Gold Member" với viền gradient kim loại). Một progress bar thanh ngang cho điểm cấp bậc. 
- Danh sách Timeline các lần tích điểm & Mã giảm giá (Reward Cards) hình chữ nhật. Card có icon 3D hộp quà nhấp nháy, viền mảnh. Text sắc nét.

### 6. Theo Dõi Đơn Hàng (track-order.html)
Thiết kế app UI (di động) Theo dõi tiến độ chuẩn bị đơn hàng.
- Nổi bật: Vertical Stepper 4 bước (Bếp tiếp nhận -> Đang pha chế -> Sẵn sàng -> Hoàn thành) nối bằng đường viền dạ quang (Neon glow). 
- Phần trên là thẻ hiển thị số bàn hiện tại, hoặc Map Tracking đối với đơn ship. Nút "Chat với CSKH" kiểu dáng M3 Tonal Button.

---

## 🍽️ Dòng 2: Nội Bộ Quán (In-House & Operations)

### 7. Màn Hình Hiển Thị Nhà Bếp - KDS V1 (kds.html)
Thiết kế Bảng nhà bếp KDS (Landscape Tablet).
- Kích thước: Ngang rộng. Màu chủ đạo: Tối sẫm chống chói (High contrast).
- Giao diện dạng Kanban: Cột "Đơn mới", "Đang làm", "Hoàn tất". Mỗi Card Ticket món ăn có đồng hồ bấm giờ (font Fira Code). Card trễ giờ sẽ nháy viền màu Đỏ Cảnh Báo. Các nút bấm bự để ngón tay dễ chạm trên màn hình.

### 8. Màn Hình Bếp V2 - Tối Cấp (kitchen-display.html)
Thiết kế Màn hình POS - KDS (Terminal Style).
- Giao diện dạng Terminal báo cáo liên tục. Thay vì card rời, hiển thị "Tổng hợp món" (Ví dụ: 10x Cold Brew, 5x Bạc Xỉu cần làm). Cấu trúc bảng ngang, text to màu neon xanh lá mạ trên nền đen sâu. 
- Một dải progress báo tổng lượng đơn hoàn thành hôm nay. Phím tắt hiển thị F1, F2 cho thợ bếp thao tác phím cứng.

### 9. Quản Trị Hệ Thống (admin)
Thiết kế trang Admin Dashboard (Desktop).
- Left Sidebar menu. Content Area gồm 4 Dashboard Stats Cards (Doanh thu hôm nay, Đơn đang chế biến, Bàn có khách). Đồ thị sóng (Area chart) tăng dần, dùng viền gradient Cyan->Magenta. Một bảng dánh sách Order Data có status tag M3 (Done, Pending).

### 10. Dashboard Vận Hành (dashboard)
Thiết kế Operational POS Dashboard (Layout nhà hàng).
- Trọng tâm là Bản vẽ Map View sàn 2D từ trên xuống. Các Bàn đại diện bằng hình tròn/vuông nổi M3 có viền Glow. Xanh = Bàn Trống, Cam = Bàn lỗi giờ, Đỏ = Bàn có khách. Bảng Sidebar bên phải rút gọn để thu ngân bấm bill thanh toán nhanh. Layout sát không gian tối.

---

## 🏢 Dòng 3: Trải Nghiệm & Thông Báo Phụ

### 11. Giới Thiệu Chi Tiết (about-us.html)
Thiết kế Landing Page About Us.
- Khối 1: Header to, chia cột 50 Ảnh mặt tiền Container - 50 Chữ (lịch sử quán).
- Khối 2: Stats bar (~183m² diện tích, sức chứa 50 người, view hoàng hôn ruộng lúa). 
- Text kiểu "Large Display", viền bo mượt, không dùng nền rắc chói. Dark Bold aesthetic.

### 12. Liên Hệ & Đóng Góp (contact.html)
Thiết kế trang Liên hệ (Contact).
- Một Form Glassmorphism lớn nằm chính giữa trang mờ. Input (Tên, Email), Thả bóp (Góp ý/Khiếu nại). 
- Cạnh bên phải form là Info box (39 Nguyễn Tất Thành) & Social Icons có nút bấm bo tròn 16px. Có icon Phone phát sáng nhạt để highlight Hotline.

### 13. Thanh Toán Thành Công (success.html)
Thiết kế trang Cập nhật trạng thái 'Thanh toán Thành Công'.
- Đơn giản, Minimalist. Chính giữa là 1 nút Checkmark khổng lồ viền neon Green phát sáng rực rỡ. Phông chữ chúc mừng "Thank you - Đơn hàng của bạn đã chốt". Nút CTA quay lại trang chủ, đường nét mảnh.

### 14. Thanh Toán Thất Bại (failure.html)
Thiết kế trang Lỗi Thanh Toán (Failure).
- Minimalist. Box nổi bật ở giữa màn hình bằng màu Neon Đỏ mờ ảo (Warning glow layer). Text thông báo xin lỗi giao dịch thất bại chân thành. Có 2 nút: "Thử lại ngay" (Solid viền đỏ) và "Về Trang Chủ" (Outline).

### 15. In Biên Lai (receipt-template.html)
Thiết kế Layout Mô phỏng Hóa đơn In Nhiệt 80mm.
- Màu sắc duy nhất: Trắng / Đen nhánh mờ. Phông chữ Fira Code (Courier giả lập). Text căn lề dạng máy đánh chữ. 
- Header Logo dạng ASCII Art hoặc khung chữ mỏng. List chi tiết món, giá, tổng cộng. Bo 2 viền mép trên mép dưới bằng đường zigzag cắt giấy đứt.

---

## 🏗️ Dòng 4: Visuals & Báo Cáo Kỹ Thuật

### 16. Sơ Đồ 2D (layout-2d-4k.html)
Vẽ lại giao diện Toolbar điều khiển Layout 2D (Blueprint Control UI).
- Nền dark blue (blueprint). Thanh công cụ (Toolbar) bo tròn Glassmorphism nổi nằm sát mặt trên gồm: Nút "Cấu trúc, Nội Thất, Điện". 
- Không gian mô phỏng sa bàn 8.3x22m kẹp giữa 2 vách nhà dân, gồm: bãi đậu xe mặt tiền, sân trống ngắm cảnh bên trái (vách tôn), chuỗi Cont 40ft sát tường phải (tường gạch), cầu thang giữa, nối tiếp Cont 20ft quầy bar bên phải, và thẻ Cont 20ft phụ trợ bên trái. Cụm Rooftop bao quanh nóc Cont phải. Chú thích Legend dọc lề trái. 

### 17. Sa Bàn 3D (layout-3d.html)
Thiết kế Giao diện Điều Khiển Panorama 3D (VR Tour UI).
- Bản đồ chiếm trọn khung (mờ nhạt đi), thanh Progress loading vắt chéo cực mượt. Hàng Thumbnail tròn hiển thị (View Sân Trước Không Gian Mở, View Lõi Bar Trệt, View Rooftop ngắm đường Nguyễn Tất Thành & Hotel Thảo Trâm) xếp hàng ngang dưới đáy. Con trỏ (Reticle point) nằm giữa màn hình để nhận lệnh xoay góc quay góc chết 2 bên nhà tường gạch.

### 18. Chiến Lược Thi Công (binh-phap-thi-cong.html)
Thiết kế Bảng Báo Cáo Timeline Dự Án Cấp Cao (Project Phase Dashboard).
- Khung UI vuông vức kiên cố, chuẩn Terminal HUD viễn tưởng. Liệt kê 3 Phase. Tiến độ Giai đoạn 1 (Đỏ), Giai đoạn 2 (Cam), Giai đoạn 3 (Xanh lá). Liệt kê bảng Task List kỹ thuật bằng phông Font Monospace. Nút Gate/Milestone Check đính kèm. 
