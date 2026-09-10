# Phase 3: Hardware, Table QR & Staff Operations Pilot

## Objective
Hoàn tất các trang bị vật lý tại quán AURA CAFE (39 Nguyễn Tất Thành), kết nối thiết bị quầy bar, in mã QR bàn và tổ chức diễn tập quy trình vận hành cho nhân sự.

## Mekong CLI Commands
- `mekong tasks-todo` — Quản lý danh sách việc cần làm cho quầy và sảnh.
- `mekong cook` — Chạy script tạo hàng loạt file QR code và mẫu in bill.
- `mekong van-hanh-vn` — Áp dụng cẩm nang vận hành F&B chuẩn Việt Nam.
- `mekong raas-sprint` — Quản lý sprint chuẩn bị vận hành quán.

## Tasks
- [ ] **Mã QR bàn:**
  - Tạo bộ mã QR chất lượng cao cho 12 bàn: `https://auraspace.cafe/menu.html?table=1` ... `12`.
  - In ấn tem decal chống thấm dán tại từng vị trí bàn (Trong nhà, Sân vườn, VIP).
- [ ] **Máy in hóa đơn tại quầy:**
  - Kiểm tra kết nối máy in hóa đơn nhiệt 58mm/80mm từ trình duyệt máy tính bảng POS `/admin/pos.html`.
  - Đảm bảo bill in rõ ràng: Tên quán, số bàn, danh sách món, tổng tiền, mã tích điểm / cashback của khách.
- [ ] **Diễn tập nghiệp vụ nhân viên (Staff Drill):**
  - Ca sáng (Khánh/Cường): Đăng nhập POS, chấm công vào ca (`POST /api/shifts/clock-in`), kiểm tra két tiền thối (200.000đ).
  - Quầy Barista (Cường/Thư): Mở màn hình KDS `/kds.html` trên tablet quầy pha chế, nhận đơn -> làm món -> bấm hoàn tất.
  - Ca tối: Đếm két tiền mặt 2 lần, đối soát tiền mặt & chuyển khoản trên POS, kiểm kê 10 nguyên liệu chính, chấm công ra ca.
