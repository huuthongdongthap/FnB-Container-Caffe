# Phase 2: FnB Premium conversion features

## Tasks

### 1. Tích hợp hệ thống tag món ăn độc quyền Bát tự (🌿 Mộc Zone, 💎 Specialty, 🔥 Cay nồng)
- **Mục tiêu**: Tối ưu hóa chuyển đổi thực đơn `menu.html` bằng cách hiển thị các nhãn tag bắt mắt, tinh tế cho từng món ăn.
- **Tập tin cần sửa**:
  - `menu.html`
  - `css/ui-polish-v5.css` (hoặc styles.css để bổ sung class badge)

### 2. Nâng cấp hiệu ứng hover zoom 60fps trên các card thực đơn
- **Mục tiêu**: Bổ sung hiệu ứng specular shine (quét bóng bạc sáng) và backdrop-filter mượt mà cho giỏ hàng nổi `.cart-panel` và các card thực đơn.
- **Tập tin cần sửa**:
  - `css/ui-polish-v5.css`

### 3. Thiết kế sơ đồ bàn Interactive Glassmorphic Seat Grid
- **Mục tiêu**: Sơ đồ chọn bàn tương tác cao cấp trong `table-reservation.html` với màu Jade Green (`var(--aura-moc-light)`) cho bàn trống và Chrome-Silver (`var(--aura-chrome-mid)`) cho bàn đã đặt. Loại bỏ triệt để các mã màu vàng/cam đất cấm kỵ.
- **Tập tin cần sửa**:
  - `table-reservation.html`
  - `css/ui-polish-v5.css`

## Success Criteria
- [ ] Các tag món ăn hiển thị tinh tế trên thực đơn.
- [ ] Card hover zoom mượt mà 60fps kèm hiệu ứng sáng bạc.
- [ ] Seat Grid kính mờ hiển thị lộng lẫy theo đúng tone màu Bát tự Kim-Thủy.
