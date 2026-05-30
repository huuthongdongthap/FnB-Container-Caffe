# Phase 1: Typography, Spelling & Overlap fixes

## Tasks

### 1. Sửa lỗi chính tả `Đặt Bản` thành `Đặt Bàn`
- **Mục tiêu**: Refactor tất cả các tệp HTML và file JS điều phối để thay đổi toàn bộ chữ viết sai chính tả `Đặt Bản` thành `Đặt Bàn`.
- **Tập tin cần sửa**:
  - `index.html`
  - `menu.html`
  - `table-reservation.html`
  - `contact.html`
  - `loyalty.html`
  - `about-us.html`
  - `js/shared-nav.js` (hoặc tệp JS điều phối navbar tương tự)

### 2. Sửa lỗi đè năm EST. 2018 / 2023
- **Mục tiêu**: Điều chỉnh vị trí của `.est-override` và logo container trong CSS `css/hero-v8-bazi.css` để che giấu mốc năm `EST. 2023` in chìm trong ảnh logo gốc, chỉ hiển thị duy nhất nhãn chữ bạc `EST. 2018` cách điệu lơ lửng một cách tinh tế.
- **Tập tin cần sửa**:
  - `css/hero-v8-bazi.css`

### 3. Rà soát `.aura-sr-only`
- **Mục tiêu**: Đảm bảo tiêu đề lớn `h1` luôn bị ẩn thị giác hoàn hảo 100% bằng cách rà soát tất cả các stylesheet và đảm bảo không có thuộc tính nào ghi đè làm hiện tiêu đề này lên giao diện.
- **Tập tin cần sửa**:
  - `css/brand-tokens.css`
  - `css/ui-polish-v5.css`

## Success Criteria
- [ ] Mọi chữ `Đặt Bản` được sửa hoàn thành `Đặt Bàn`.
- [ ] Không còn sự chồng lấn giữa mốc năm 2023 và 2018 trên logo.
- [ ] Thẻ H1 được ẩn trực quan hoàn toàn, không đè đúp lên logo.
