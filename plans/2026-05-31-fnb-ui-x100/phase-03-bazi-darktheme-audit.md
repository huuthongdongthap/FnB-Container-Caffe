# Phase 3: Bazi v5.1 Darktheme Harmonization Sweep

## Tasks

### 1. Quét sạch 100% rò rỉ mã màu ấm cũ (đỏ, cam, tím, vàng đất)
- **Mục tiêu**: Rà soát kỹ lưỡng toàn bộ 11 trang con và các trang quản trị `/admin/*` để loại bỏ triệt để các mã màu ấm cấm kỵ, thay thế bằng Navy trầm tĩnh và Platinum/Silver Chrome lộng lẫy.
- **Tập tin cần sửa**:
  - `checkout.html`, `loyalty.html`, `success.html`, `failure.html`
  - `admin/dashboard.html`, `admin/loyalty-dashboard.html`, `admin/reservations.html`, v.v.

### 2. Đồng bộ hóa màu nền về `--aura-noir-void` (#050D1A) và `--aura-noir-deep` (#0A1A2E)
- **Mục tiêu**: Thay thế các mã màu nền tối cứng cũ (`#0A0A0A`, `#1A1F35`) thành các biến màu chuẩn Bát tự để đảm bảo tính đồng bộ hoàn hảo của giao diện hybrid.
- **Tập tin cần sửa**:
  - `css/brand-tokens.css`
  - Tất cả các trang HTML có inline style ghi đè nền tối.

## Success Criteria
- [ ] 100% trang dark mode đồng bộ màu nền trầm tĩnh chuẩn v5.1.
- [ ] Không còn bất kỳ rò rỉ mã màu Hỏa/Thổ nào trên giao diện subpages hay admin.
