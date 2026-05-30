# Original User Request

## Initial Request — 2026-05-26T13:01:09+07:00

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

## Follow-up — 2026-05-26T13:45:29+07:00

# Teamwork Project Prompt — UI/UX Debug & Polish Sprint (Bazi v5.1)

Sửa chữa triệt để các lỗi hiển thị font (FOUT/layout shift), bất nhất quán nhãn hiệu trong tài liệu chỉ dẫn, và rò rỉ màu sắc cũ tại các trang quản trị nội bộ nhằm tối ưu hóa và hoàn thiện 100% hệ thống UI/UX Aura Cafe theo chuẩn Bát tự v5.1.

Working directory: /Users/mac/mekong-cli/FnB-Container-Caffe
Integrity mode: development

## Requirements

### R1. Font Preloading & Spacing Optimization (FOUT/Layout Shift)
- Thực hiện tối ưu hóa tốc độ tải trang bằng cách bổ sung thuộc tính `font-display: swap;` hoặc chèn thẻ `<link rel="preload" as="font">` thích hợp cho các Google Fonts (*Cormorant Garamond*, *Space Grotesk*, *JetBrains Mono*) trên tất cả 11 trang HTML.
- Đảm bảo loại bỏ hoàn toàn hiện tượng giật giật bố cục (Layout Shift) khi tải trang trên các kết nối mạng chậm.

### R2. Brand Swatch & Guideline Uniformity
- Rà soát toàn bộ tệp tin `brand-guideline.html` và chỉnh sửa các nhãn text hiển thị, mô tả màu sắc (ví dụ: đổi các chữ "Gold", "Luxurious metallic gold" sang "Chrome/Silver" hoặc "Luxurious metallic silver/chrome") để đảm bảo tính nhất quán tuyệt đối giữa nhãn chữ hiển thị và mã CSS thực tế.

### R3. Admin Dashboard Color Alignment (Color Leak Cleanup)
- Rà soát và cập nhật hệ màu sắc hiển thị của các huy hiệu trạng thái (status badges), biểu đồ, và các phần tử trang trí trong `admin/launch-monitor.html` cũng như các tệp tin HTML quản trị khác dưới thư mục `admin/`.
- Thay thế các mã màu gold/cam/đỏ cũ bằng hệ màu Bát tự v5.1 (Navy, Chrome-Silver, Mộc Zone).

## Acceptance Criteria

### Performance & Text Rendering
- [ ] Không xảy ra hiện tượng FOUT (Flash of Unstyled Text) hoặc thay đổi kích thước đột ngột của font chữ khi tải trang giả lập mạng chậm (Slow 3G).
- [ ] Tệp `brand-guideline.html` không còn bất kỳ nhãn văn bản nào chứa chữ "Gold" đi kèm với mã màu bạc/chrome.

### Admin Dashboard Integrity
- [ ] Toàn bộ các trang quản trị `/admin/*` đều áp dụng hệ màu đồng bộ của Bát tự v5.1, không còn sử dụng tông màu cấm kỵ (Hỏa & Thổ).

## Follow-up — 2026-05-28T15:10:36+07:00

Thực hiện đợt "đập đi xây lại" toàn diện về mặt thẩm mỹ và tính năng giao diện (100X Premium Hybrid Overhaul) cho Aura Cafe, bám sát hình ảnh thực tế của quán (quán container 2 tầng: 1 trệt + Rooftop Container Deck, kết cấu khung thép xám, vách cont xanh dương, nội thất gỗ óc chó walnut, bàn ghế da nâu, nhiều cây xanh, vị trí mặt phố Hùng Vương gần sông Sa Đéc, hoàn toàn KHÔNG CÓ view cánh đồng lúa hay view sông trực diện).

Working directory: /Users/mac/mekong-cli/FnB-Container-Caffe
Integrity mode: development

## Requirements

### R1. Dynamic Real-time Hybrid Theme Mode
- Tích hợp hệ thống tự động đổi theme theo thời gian thực (Real-time Sun Cycle) trong `js/shared-nav.js` và đồng bộ trên toàn bộ 11 trang HTML:
  - **Từ 06:00 đến 18:00 (Ban ngày):** Tự động bật **Pearl-Silver & Jade Light Mode** sáng sủa, thanh mát.
  - **Sau 18:00 đến trước 06:00 sáng hôm sau (Ban đêm):** Tự động chuyển sang **Deep-Sea Navy & Chrome Dark Mode** lãng mạn, lung linh.
- Đảm bảo nút Toggle Theme trên thanh điều hướng hoạt động hoàn hảo: khi người dùng bấm chuyển thủ công, hệ thống sẽ tạm dừng chế độ tự động cho đến lần tải trang tiếp theo.
- Tránh mọi hiện tượng nháy sáng (Flash of Unstyled Theme - FOVT) khi tải trang.

### R2. Physical Accuracy & Brand Story Rewrite
- Rà soát toàn bộ tệp tin trong dự án (bao gồm `index.html`, `about-us.html`, `contact.html`, `brand-guideline.html`, `promotions.html` và các file meta) để **loại bỏ 100% từ khóa/hình ảnh fake liên quan đến "view đồng lúa" (rice field view) hoặc "view sông trực tiếp"**.
- Viết lại câu chuyện thương hiệu và các đoạn mô tả: Định vị Aura Cafe là **quán container rooftop industrial-luxury 2 tầng (1 trệt + Rooftop Container Deck)** tọa lạc trên đường Hùng Vương sầm uất, nằm gần dòng sông Sa Đéc lịch sử. Không gian nổi bật với nét thô mộc của thép công nghiệp xám, sắc xanh dương hiện đại của container vỏ thép, kết hợp cùng nội thất gỗ óc chó walnut cao cấp và cây xanh tươi mát.

### R3. Interactive 5-Zone Glassmorphic Showcase
- Thay thế hoàn toàn khu vực `spaces-placeholder` (Coming Soon) thô sơ trên trang chủ bằng một **lưới trình diễn không gian 5 khu vực thiết kế (Interactive 5-Zone Grid)** cực kỳ sang trọng:
  1. **Quầy Bar "Mộc Zone" (Jade Counter):** Quầy cont 20ft cuối bên phải tầng trệt, chất liệu walnut kết hợp mặt đá ngọc bích, bao quanh bởi chậu cây xanh giúp hóa giải hướng Nam (Hỏa).
  2. **Rooftop "Thủy Stage" (Sky Deck):** Sân thượng container thoáng đãng, lộng gió, ngắm trọn vẹn cảnh trời đêm phố thị Sa Đéc dưới những ánh đèn lung linh.
  3. **Container Seating (Noir Cabin):** Không gian phòng lạnh container 40ft ấm cúng, thiết kế vách thép công nghiệp đen rỉ tự nhiên kết hợp sofa da navy sang trọng.
  4. **Sunset Corner (Aura Lounge):** Góc ngồi hướng Tây đón hoàng hôn trọn vẹn, sử dụng các vật liệu inox, gương và chrome bóng bẩy (Kim sinh Thủy).
  5. **VIP Steel Nest:** Góc ban công container treo lơ lửng, tạo không gian yên tĩnh và riêng tư tối đa.
- Mỗi Zone được thiết kế dưới dạng **card kính mờ glassmorphism tinh xảo** (`backdrop-filter`, viền chrome mỏng, bóng đổ HSL) kèm mô tả ngắn gọn và hover sweep lướt sáng.

### R4. Premium SVG Social Icons Integration
- Loại bỏ 100% các emoji biểu tượng rẻ tiền (`📘`, `📷`, `🎵`, `💬`) ở Footer và Drawer di động trong `js/shared-nav.js`.
- Thay thế bằng các icon SVG chất lượng cao, tối giản và chuyên nghiệp của Facebook, Instagram, TikTok và Zalo.
- Thêm hiệu ứng hover đổi màu sang Chrome-Silver lung linh kèm chuyển dịch nhẹ (Y-axis transition).

## Acceptance Criteria

### Hybrid Theme & Code Quality
- [ ] `js/shared-nav.js` tự động tính toán thời gian thực của client và áp dụng đúng thuộc tính `data-theme="light"` hoặc `data-theme="dark"` tại thẻ `<html>` ngay khi tải trang.
- [ ] Không còn bất kỳ từ khóa "đồng lúa", "view đồng lúa", "view sông trực tiếp" hay "rice field" nào xuất hiện trong các đoạn text hiển thị của website.
- [ ] Không còn bất kỳ emoji nào trong danh sách social links của Footer; tất cả được hiển thị bằng SVG mịn màng.
- [ ] 5 Zone không gian hiển thị dưới dạng card kính mờ vô cùng tinh tế, phản hồi hover mượt mà 60fps trên di động.
- [ ] Lệnh `npm run build` chạy thành công không có lỗi biên dịch của Vite hay cú pháp HTML rác.
- [ ] Các bài test Jest trong thư mục `tests/` vượt qua thành công với tỷ lệ 100%.

## Follow-up — 2026-05-30T21:55:23+07:00

# Teamwork Project Prompt — UI/UX Deep Design Review & Brand Audit

Thực hiện kiểm tra sâu sắc giao diện (Deep UI/UX Design Review) và chuẩn hóa toàn bộ hệ thống giao diện Aura Cafe để đảm bảo tính đồng bộ 100% của hệ sinh thái Bát tự v5.1 (Kim/Silver + Thủy/Navy + Mộc/Green) trên toàn bộ 11 trang HTML của dự án. Loại bỏ triệt để các rò rỉ mã màu cũ, lỗi nhấp nháy chuyển theme (FOVT), lỗi nhảy chữ (FOUT), và tối ưu hóa tỷ lệ chuyển đổi ngành FnB.

Working directory: /Users/mac/mekong-cli/FnB-Container-Caffe
Integrity mode: development

## Requirements

### R1. Bazi v5.1 Brand Consistency Sweep
- Rà soát toàn bộ 11 trang giao diện khách hàng và tất cả các trang nội bộ quản trị `/admin/*` (như `admin/launch-monitor.html`, `admin/loyalty-dashboard.html`, v.v.) để đảm bảo kế thừa chính xác biến động từ `brand-tokens.css`.
- Đảm bảo các thuộc tính `.text-gold` (chuyển sang Chrome/Silver) có độ tương phản tuyệt hảo và sắc nét trên cả Light Mode và Dark Mode. 
- Xóa bỏ triệt để các mã màu Hỏa/Thổ (vàng đất, cam chói, đỏ thô) trong các huy hiệu, button, và menu món ăn.

### R2. Real-time Hybrid Theme & Anti-Flicker (FOVT) Audit
- Đảm bảo cơ chế tự động đổi theme theo thời gian thực (Pearl-Silver & Jade Day / Deep-Sea Navy & Chrome Night) tại `js/shared-nav.js` được áp dụng ngay lập tức khi thẻ `<html>` tải, triệt tiêu hoàn toàn hiện tượng nhấp nháy sáng (Flash of Unstyled Theme - FOVT).
- Kiểm tra nút Toggle Theme thủ công hoạt động mượt mà trên tất cả 11 trang con và ghi nhớ trạng thái chuẩn xác.

### R3. Responsive Layout Shift & Accessibility Review
- Đảm bảo không xảy ra hiện tượng FOUT (Flash of Unstyled Text) hoặc xê dịch layout (Layout Shift) khi tải trang giả lập mạng chậm.
- Tối ưu hóa các điểm chạm tương tác, đặc biệt là lưới thực đơn (`.menu-grid`), sơ đồ chọn bàn tương tác (`.seat-grid`), và các bước thanh toán (`.steps`) trên các độ phân giải từ 320px (di động cực nhỏ) đến 1920px.

### R4. E2E Verification & Social Icons Purge
- Rà soát và loại bỏ 100% các biểu tượng emoji rẻ tiền (`🛒` tại giỏ hàng, `✈` tại trang liên hệ) và thay thế bằng các icon vector SVG phẳng cao cấp tối giản nhất.
- Đảm bảo sơ đồ đặt bàn `table-reservation.html` sử dụng thiết kế hình học blueprint phẳng chuyên nghiệp thay cho emoji ghế.

### R5. Automated Testing & Code Health Compliance
- Đảm bảo toàn bộ mã nguồn tuân thủ nghiêm ngặt chuẩn ESLint của dự án.
- Đảm bảo lệnh `npm run build` thực hiện đóng gói sản phẩm hoàn hảo sang thư mục `dist/`.
- Kiểm tra 22/22 Jest tests vượt qua thành công với tỷ lệ 100%.

## Acceptance Criteria

### Brand & Color Alignment
- [ ] 100% các nhãn text, card món ăn và gradient đạt độ tương phản chuẩn WCAG AA.
- [ ] Không còn bất kỳ mã màu cấm kỵ (Hỏa & Thổ) nào tồn đọng trong CSS của các trang con và admin.

### Dynamic Interaction & Experience
- [ ] Tự động chuyển theme hoạt động tức thì, không gây chớp nháy màn hình khi tải trang.
- [ ] 5-Zone Grid trên trang chủ hiển thị các asset ảnh 8k chất lượng cao rõ nét và phóng to (scale zoom) mượt mà 60fps khi hover.
- [ ] 100% emoji thô sơ được thay bằng SVG cao cấp. Sơ đồ đặt bàn dạng Blueprint hình học phẳng.

### Code & Compilation Health
- [ ] 100% các bài test Jest đều PASS.
- [ ] Biên dịch Vite và lint kiểm tra thành công với 0 lỗi ESLint.


## Follow-up — 2026-05-30T21:55:52+07:00

You are the Project Orchestrator (archetype: orchestrator, role: orchestrator, user_liaison, human_reporter).

Your absolute objective is to coordinate the team to implement the requirements described in ORIGINAL_REQUEST.md verbatim.

Workspace: /Users/mac/mekong-cli/FnB-Container-Caffe
Working directory: /Users/mac/mekong-cli/FnB-Container-Caffe/.agents/orchestrator

Please read the ORIGINAL_REQUEST.md under your workspace and the handoff files under .agents/ to understand the state of the project.

Key Requirements:
1. Brand Consistency (Bazi v5.1):
- Standardize all 11 HTML pages and all admin pages (under admin/*) to be 100% aligned with the Bazi v5.1 color tokens (Silver/Chrome, Navy, Jade/Green).
- Remove all Fire & Earth colors (gold, red, orange, brown) from buttons, badges, food menu, and UI elements.
- Ensure Chrome/Silver color (.text-gold class rebranded/polished) is highly readable on both light & dark themes.

2. Real-time Hybrid Theme & Anti-Flicker (FOVT):
- Eliminate 100% theme flickering (Flash of Unstyled Theme - FOVT) when loading any of the 11 pages.
- The real-time automatic system in js/shared-nav.js must execute instantly as soon as <html> loads, and manual toggle state must be memorized correctly across pages.

3. Responsive Layout Shift & Accessibility (FOUT):
- Ensure no layout shift (FOUT) when loading on simulated slow connections.
- Optimize all interactive touchpoints (menu grid, reservation blueprint interactive seat-grid, checkout steps) on all screens from 320px to 1920px.

4. E2E Verification & Social Icons Purge:
- 100% premium SVG vector icons in Footer and Mobile Drawer.
- Sơ đồ đặt bàn (table-reservation.html) must use a flat blueprint layout (blueprint geometric lines/shapes) instead of emoji chairs/tables.
- Remove all remaining emojis (e.g. 🛒, ✈) and replace with clean SVG icons.

5. Automated Testing & Code Health:
- ESLint must pass perfectly with 0 errors.
- Vite build (npm run build) must compile perfectly into dist/ with no errors.
- All 22/22 Jest tests must pass 100% successfully.

Please initialize your plan in plan.md, track progress in progress.md, and coordinate your Explorer, Worker, and Reviewer subagents. When all milestones are complete, report back to me with a victory claim.



## Follow-up — 2026-05-30T21:56:35+07:00

You are the PROJECT ORCHESTRATOR. Your absolute objective is to coordinate the team to implement the requirements described in ORIGINAL_REQUEST.md verbatim.

Workspace: /Users/mac/mekong-cli/FnB-Container-Caffe
Working directory: /Users/mac/mekong-cli/FnB-Container-Caffe/.agents/orchestrator

Key Requirements:
1. Brand Consistency (Bazi v5.1):
- Standardize all 11 HTML pages and all admin pages (under admin/*) to be 100% aligned with the Bazi v5.1 color tokens (Silver/Chrome, Navy, Jade/Green).
- Remove all Fire & Earth colors (gold, red, orange, brown) from buttons, badges, food menu, and UI elements.
- Ensure Chrome/Silver color (.text-gold class rebranded/polished) is highly readable on both light & dark themes.

2. Real-time Hybrid Theme & Anti-Flicker (FOVT):
- Eliminate 100% theme flickering (Flash of Unstyled Theme - FOVT) when loading any of the 11 pages.
- The real-time automatic system in js/shared-nav.js must execute instantly as soon as <html> loads, and manual toggle state must be memorized correctly across pages.

3. Responsive Layout Shift & Accessibility (FOUT):
- Ensure no layout shift (FOUT) when loading on simulated slow connections.
- Optimize all interactive touchpoints (menu grid, reservation blueprint interactive seat-grid, checkout steps) on all screens from 320px to 1920px.

4. E2E Verification & Social Icons Purge:
- 100% premium SVG vector icons in Footer and Mobile Drawer.
- Sơ đồ đặt bàn (table-reservation.html) must use a flat blueprint layout (blueprint geometric lines/shapes) instead of emoji chairs/tables.
- Remove all remaining emojis (e.g. 🛒, ✈) and replace with clean SVG icons.

5. Automated Testing & Code Health:
- ESLint must pass perfectly with 0 errors.
- Vite build (npm run build) must compile perfectly into dist/ with no errors.
- All 22/22 Jest tests must pass 100% successfully.

Please initialize your plan in plan.md, track progress in progress.md, and coordinate your Explorer, Worker, and Reviewer subagents (using `self` with appropriate Roles) to implement these requirements.
Since you are spawned as a subagent, you MUST send a message with your results, reports, and updates back to your caller (the Project Sentinel) using the `send_message` tool. When all milestones are complete, send a "victory claim" to the Sentinel.

## Follow-up — 2026-05-30T22:03:38+07:00

You are the Project Orchestrator (archetype: orchestrator).
Your absolute objective is to coordinate the team to implement the requirements described in ORIGINAL_REQUEST.md verbatim and resolve all 144 Jest test failures so that the entire test suite passes 100%.

Workspace: /Users/mac/mekong-cli/FnB-Container-Caffe
Working directory: /Users/mac/mekong-cli/FnB-Container-Caffe/.agents/orchestrator

Key Tasks:
1. Update `tests/dashboard.test.js` or Mock/re-route it since the `dashboard/` directory was consolidated into `admin/dashboard.html` and no longer exists.
2. Resolve structural mismatches in `kds.html` (e.g. body class, orderDetailBody) so `tests/kds-system.test.js` passes.
3. Update `index.html` headers with the PWA assets (`apple-touch-icon`) expected by `tests/pwa-features.test.js`.
4. Fix any other test failures in `tests/` to reach 100% success rate (22/22 suites or all tests passing).
5. Maintain 100% compliance with Bazi v5.1 (Navy, Chrome/Silver, Mộc Green) and zero Fire/Earth leaks.

Please initialize/update your plan in plan.md, track progress in progress.md, and coordinate your Explorer, Worker, and Reviewer subagents. When all tests pass and milestones are complete, write your handoff.md and send a victory claim back to me.
