# ⚔️ AURA SPACE — UI Architecture & FnB Conversion Plan

> **Date:** 2026-05-28 | **Target Repo:** `~/mekong-cli/FnB-Container-Caffe`
> **Workflow:** Standard Mode (/plan + /ui-design-component)
> **Goal:** Deep audit and upgrade the entire UI architecture across all customer pages to align with the Bazi v5.1 Hybrid Theme (Day/Night) and optimize for FnB conversion rate.

---

## 🏛️ Hướng Tiếp Cận Kiến Trúc (Architecture Audit)

Chúng tôi sẽ đồng bộ hóa toàn bộ các trang con (`menu.html`, `checkout.html`, `table-reservation.html`, `loyalty.html`, `contact.html`, `about-us.html`, `dang-ky-thanh-vien.html`, `track-order.html`) khớp với kiến trúc **Bát tự v5.1 (Metallic Platinum & Jade Garden)** và chế độ **Theme Hybrid tự động theo thời gian thực (Day/Night)**.

### 1. Đồng Bộ Hóa Theme Hệ Thống (Cross-page Hybrid Theme Sync)
* **Vấn đề hiện tại**: Trong khi trang chủ (`index.html`) đã chuyển đổi mượt mà giữa Pearl-Silver Light Mode (Ngày) và Obsidian Navy Dark Mode (Đêm), các trang con như `menu.html`, `checkout.html`, và `loyalty.html` vẫn sử dụng các biến màu tĩnh hoặc mã màu tối cứng (`#1A1F35` hoặc `#060E1A`). Điều này gây ra hiện tượng đứt gãy trải nghiệm khi người dùng nhấn chuyển trang vào ban ngày.
* **Giải pháp**: 
  * Thay thế toàn bộ mã màu cứng hoặc biến tĩnh cục bộ trong khối `<style>` của các trang con bằng các biến dùng chung định nghĩa trong `css/brand-tokens.css` (như `var(--bg)`, `var(--bg-surface)`, `var(--card)`, `var(--txt)`, `var(--white)`).
  * Đảm bảo thẻ `<html>` của tất cả các trang con tự động thừa kế thuộc tính `data-theme` được tính toán trực tiếp hoặc qua `sessionStorage` từ file điều phối trung tâm `js/shared-nav.js`.

### 2. Tối Ưu Hóa Trải Nghiệm & Tỷ Lệ Chuyển Đổi Ngành FnB (FnB Conversion Optimization)
* **Trang Thực Đơn (`menu.html`)**:
  * Tích hợp thêm các **Badge định dạng món ăn độc quyền** (Mộc Zone 🌿, Specialty 💎, Cay nồng 🌶️, Bán chạy 👨‍🍳) giúp khách dễ dàng chọn lựa theo nhu cầu sức khỏe và Bát tự.
  * Tăng cường hiệu ứng phóng to thẻ món ăn (Card hover zoom) mượt mà 60fps, kèm quét bóng sáng (glow sweep border) và bóng đổ kính mờ glassmorphism sâu hơn.
  * Tối ưu hóa bảng Giỏ hàng nổi (`.cart-panel`) với hiệu ứng làm mờ nền phía sau (`backdrop-filter: blur(12px)`) cực kỳ sang trọng.
* **Trang Thanh Toán (`checkout.html`)**:
  * Thiết kế lại khối hiển thị các bước (`.steps`) với các điểm nút (Step nodes) dạng ngọc bích bóng bẩy, viền kim loại sáng bóng.
  * Nâng cấp các Card chọn phương thức thanh toán (MoMo, PayOS, VNPay) với hiệu ứng ánh kim nổi bật (Metallic shine) khi được chọn.
  * Tích hợp cơ chế tự động hiển thị lời chào cá nhân hóa khi khách hàng nhập số điện thoại thành viên Gold/Silver đã đăng ký.
* **Trang Đặt Bàn (`table-reservation.html`)**:
  * Thay thế sơ đồ bàn thô sơ bằng **Sơ đồ bàn Interactive Glassmorphic Seat Grid** với trạng thái màu ngọc bích sáng (Bàn trống) và màu kim loại bạc xám (Bàn đã đặt), loại bỏ hoàn toàn các màu Hỏa/Thổ (vàng, cam, đỏ).
  * Tối ưu hóa form chọn thời gian và số người đặt bàn theo dạng chip tròn nhấp nháy mượt mà.

### 3. Vệ Sinh Mã Màu Cấm Kỵ Bát Tự v5.1
* Rà soát toàn bộ các khối `<style>` trên các trang con để thanh lọc triệt để các mã màu vàng hoàng kim thô (`#FFD700`, `#D4AF37`), màu cam sặc sỡ và màu nâu gỗ ấm (`#6F4E37`, `#3B2F2F`) - thuộc hành Hỏa và Thổ khắc Thủy.
* Thay thế bằng hệ màu tương sinh Kim - Thủy: màu bạc bạch kim Chrome-Silver (`#C9D6DF`), xanh hải quân Deep-Sea Navy (`#0A1A2E`) và xanh ngọc bích Jade Green (`#4E878C`).

---

## 📅 Task Breakdown & Kế Hoạch Triển Khai

### Phase 1: Đồng Bộ Hóa Kiến Trúc Theme & Vệ Sinh Mã Màu Bát Tự (1-2 ngày)
- [ ] **Task 1.1**: Rà soát và cập nhật khối `<style>` của `menu.html` để kế thừa biến màu từ `brand-tokens.css` và tương thích 100% với Day/Night Hybrid Theme.
- [ ] **Task 1.2**: Đồng bộ hóa bảng màu của `checkout.html` và `table-reservation.html` theo cơ chế theme linh hoạt của hệ thống, thay thế các mã màu tĩnh tối tăm.
- [ ] **Task 1.3**: Chuẩn hóa màu sắc trang Loyalty (`loyalty.html` và `loyalty-calculator.html`) sang hệ màu bạch kim - ngọc bích, loại bỏ các chi tiết màu vàng đồng/vàng kim cũ.
- [ ] **Task 1.4**: Vệ sinh triệt để các font chữ cấm kỵ (`Inter` làm body fallback, `Cinzel`, `Playfair Display`) khỏi tất cả các trang con, chuyển hoàn toàn sang `Space Grotesk` và `Cormorant Garamond`.

### Phase 2: Nâng Cấp Thiết Kế Component & Trải Nghiệm FnB (2 ngày)
- [ ] **Task 2.1**: Nâng cấp giao diện Card món ăn và Giỏ hàng trượt (`.cart-panel`) trong `menu.html` với hiệu ứng kính mờ glassmorphism cao cấp và micro-animations.
- [ ] **Task 2.2**: Thiết kế các Badge định vị món ăn FnB trực quan (Mộc Zone, Organic, Spicy, Best Seller).
- [ ] **Task 2.3**: Nâng cấp các Payment Method Cards (MoMo, PayOS, VNPay) trong `checkout.html` với thiết kế ánh kim mượt mà.
- [ ] **Task 2.4**: Tái cấu trúc Step Indicator (`.steps`) trên trang thanh toán thành thanh quy trình ngọc bích bóng bẩy.
- [ ] **Task 2.5**: Xây dựng sơ đồ bàn đặt trước Interactive Glassmorphic Seat Grid tinh tế cho `table-reservation.html`.

---

## 🧪 Kế Hoạch Xác Minh (Verification Plan)

### Kiểm thử Tự động:
* Chạy `npm run test` để đảm bảo không làm gãy bất kỳ case test i18n hay logic nào của hệ thống.
* Chạy `npm run build` để xác nhận Vite đóng gói thành công 100% không có cảnh báo lỗi đường dẫn tài nguyên.

### Kiểm thử Thủ công:
* Sử dụng Chế độ Giả lập Thiết bị để kiểm tra khả năng co giãn bố cục (Responsive grid) ở các mốc 375px (iPhone), 768px (iPad) và 1440px (Desktop).
* Xác minh tính liên tục của giao diện khi người dùng chuyển đổi thủ công hoặc tự động theo thời gian thực từ Ngày sang Đêm trên tất cả 11 trang HTML.
