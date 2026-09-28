# BÁO CÁO KIỂM TOÁN TOÀN DIỆN KIẾN TRÚC UX/UI — AURA CAFE FnB PLATFORM
**Đơn vị thực hiện:** Pipeline Conductor / Antigravity UX Architecture Audit Team  
**Mục tiêu kiểm toán:** Đánh giá chuyên sâu 3 Shell (Customer Storefront, Ops KDS/POS, Admin Management Terminal)  
**Thời gian thực hiện:** 2026-09-24  
**Phiên bản ứng dụng:** AURA CAFE v2.1.1 (React 19 + TypeScript + Vite 8 + Tailwind CSS v4 + M3 Design System)  
**Vị trí lưu trữ báo cáo:** `/Users/mac/mekong-cli/FnB-Container-Caffe/docs/UX_UI_AUDIT_REPORT.md`

---

## 1. BẢNG TỔNG HỢP SỐ LƯỢNG ISSUE THEO DANH MỤC & ĐỘ ƯU TIÊN

| Danh mục kiểm toán (Category) | P0 (Khẩn cấp / Chặn luồng) | P1 (Nghiêm trọng / Ảnh hưởng lớn) | P2 (Trung bình / Hoàn thiện) | Tổng cộng |
|---|:---:|:---:|:---:|:---:|
| **R1. Nhất quán thiết kế (Design Consistency)** | 1 | 3 | 1 | **5** |
| **R2. Luồng người dùng End-to-End (UX Flow)** | 3 | 3 | 1 | **7** |
| **R3. Khả năng tiếp cận (Accessibility - WCAG AA)** | 1 | 2 | 1 | **4** |
| **R4. Tương thích Mobile & Responsive** | 1 | 1 | 1 | **3** |
| **R5. Trải nghiệm hiệu năng (Performance UX)** | 0 | 2 | 1 | **3** |
| **R6. Tính đầy đủ Admin & Ops (Admin/Ops Completeness)** | 4 | 1 | 0 | **5** |
| **TỔNG CỘNG** | **10** | **12** | **5** | **27** |

---

## 2. TỔNG QUAN KIẾN TRÚC & ĐÁNH GIÁ ĐỘC LẬP (EXECUTIVE SUMMARY)

Ứng dụng AURA CAFE FnB được xây dựng trên nền tảng kỹ thuật hiện đại (React 19, TypeScript, Tailwind CSS v4, Zustand, TanStack Query, Hono backend trên Cloudflare Workers). Hệ thống được định vị theo phong cách **Industrial Luxury Container** (không gian container cà phê Sa Đéc, phối màu Deep Navy `#0A1A2E`, Bạc Chrome `#C9D6DF`, Điểm xuyết Forest Green `#4A7C59` theo triết lý Bát Tự v5.0 Kim - Thủy).

Hệ thống phân chia thành 3 Shell tương ứng với 3 nhóm người dùng:
1. **CustomerShell (`[data-shell="customer"]`)**: Phục vụ khách hàng duyệt menu, đặt món tại bàn, đặt bàn trước, thanh toán PayOS/COD, theo dõi đơn hàng và tích lũy hội viên.
2. **OpsShell (`[data-shell="ops"]`)**: Phục vụ bộ phận vận hành tại quầy bar và bếp (KDS trên tablet/màn hình treo, POS phục vụ tại bàn, TV Menu trình chiếu).
3. **AdminShell (`[data-shell="admin"]`)**: Bàn điều khiển quản trị tập trung (Terminal dashboard, quản lý menu, bàn, đơn hàng, khách hàng CRM, báo cáo doanh thu).

### Đánh giá khách quan:
- **Điểm sáng:** Mã nguồn có sự phân tách rõ rệt giữa Presentation Components (Stitch v2) và Domain Hooks; hệ thống offline-first với IndexedDB (`offline-db.ts`) được tích hợp vào giỏ hàng và đặt món; có cơ chế Fallback và ErrorBoundary ở cấp độ route.
- **Rủi ro chí mạng:** 
  1. **Lỗi tài chính/tiền tệ (100x discrepancy):** Dữ liệu đơn hàng backend trả về đơn vị Đồng (VND), nhưng các trang Frontend sau đặt hàng chia cho 100, biến một ly cà phê 31.900₫ thành 319₫ trên biên nhận và khi Reorder.
  2. **Xung đột cấu trúc Shell (Double Navigation / Layout Bleed):** Menu và các trang phụ mount đồng thời cả `MD3TopAppBar` (từ AppShell) lẫn `LandingNav` (từ page), gây đè lớp giao diện; trang `/admin/orders` mount lồng 2 Sidebar và 2 TopBar làm lệch layout 568px sang phải.
  3. **Đứt gãy luồng vận hành (Dead-ends):** Nút "ORDER PICKED UP" trên KDS bị hardcode thuộc tính `disabled`, khiến vé đã làm xong không thể dọn khỏi màn hình; tính năng Đặt bàn khách hàng (`/table-reservation`) hoàn toàn là giao diện giả lập (fake random code), không hề gọi API backend để lưu bàn.
  4. **Xung đột Theme Token:** CSS quy định `AdminShell` là Light Theme (`#FAFAF8`), nhưng component cha `StitchAdminTerminalNew` lại ép nền Dark Navy (`#0A1A2E`), tạo ra hiện tượng xung đột token khiến chữ tối màu chìm hoàn toàn vào nền tối.

---

## 3. PHÂN TÍCH CHI TIẾT TỪNG MỤC THEO TIÊU CHUẨN KIỂM TOÁN

---

### R1. KIỂM TRA NHẤT QUÁN THIẾT KẾ (DESIGN CONSISTENCY)

#### [P0-DES-01] Xung đột Theme Token Đảo Ngược giữa AdminShell CSS Override và Container Component
- **File dẫn chứng:** 
  - `/Users/mac/mekong-cli/FnB-Container-Caffe/src/styles/aura-tokens.css` (Dòng 282–311)
  - `/Users/mac/mekong-cli/FnB-Container-Caffe/src/components/stitch/StitchAdminTerminalNew.tsx` (Dòng 38)
- **Vấn đề phát hiện:**
  - Trong `aura-tokens.css`:
    ```css
    /* ── AdminShell Light Override ── */
    [data-shell="admin"] {
      --md-sys-color-background: var(--aura-pearl-100); /* #F5F5F0 */
      --md-sys-color-surface: #FFFFFF;
      --md-sys-color-on-surface: var(--aura-navy-900);  /* #0A1128 */
      --md-sys-color-primary: var(--aura-chrome-500);
    }
    ```
    Toàn bộ token M3 của `[data-shell="admin"]` được định nghĩa là **Giao diện sáng (Light Theme)** với nền trắng/ngọc trai và chữ màu xanh đen đậm (`#0A1128`).
  - Tuy nhiên, trong `StitchAdminTerminalNew.tsx`:
    ```tsx
    <div data-shell="admin" className="relative min-h-screen bg-[var(--aura-bg-page, var(--aura-bg-surface))] font-body text-[var(--aura-text-primary, #e8e8e8)]">
    ```
    Component layout gốc của Admin lại gắn thuộc tính `data-shell="admin"`, đồng thời áp đặt class `bg-[var(--aura-bg-page)]` (giá trị `#0A1A2E` - Deep Navy cực tối).
- **Hậu quả:** 
  Khi các component con trong Admin sử dụng semantic class của Material 3 (ví dụ `text-md-on-surface` tức màu `#0A1128`), chữ màu xanh đen sẽ hiển thị trên nền xanh đen `#0A1A2E`, tỉ lệ tương phản tụt xuống **1.1:1**, biến văn bản thành vô hình đối với người dùng quản trị.
- **Đề xuất khắc phục cụ thể:**
  Đồng bộ dứt khoát AdminShell theo phong cách **Dark Terminal đồng nhất với Customer & Ops**. Xóa bỏ block Light Override trong `aura-tokens.css` dòng 282–311, hoặc chuẩn hóa các biến `--md-sys-color-*` trong `[data-shell="admin"]` trỏ về palette dark (`--aura-noir-void`, `--aura-chrome-bright`, `--aura-chrome-200`).

---

#### [P1-DES-02] Tình trạng Hardcode Màu Sắc Tràn Lan (1.319 vị trí hex thô ngoài Design System)
- **File dẫn chứng:** 
  - Toàn bộ thư mục `src/pages/` và `src/components/stitch/` (Ghi nhận tổng cộng 1.319 mã hex).
  - Điển hình: `src/pages/SystemHub.tsx` (28 lần `#a0a8b0`, 10 lần `#0A1A2E`, 8 lần `#6B9FB8`), `src/pages/stitch/promotions-new/` (26 lần `#C9A96E` - màu vàng cam cũ thay vì bạc Kim).
- **So sánh thực tế (Comparative Example):**
  - **Trang làm đúng:** `src/components/stitch/StitchLandingNew-nav.tsx` (dòng 68, 88) sử dụng biến CSS token chuẩn hóa `var(--aura-chrome-dim)`, `var(--aura-chrome-bright)`.
  - **Trang làm sai:** `src/pages/SystemHub.tsx` (dòng 628, 640) hardcode trực tiếp `bg-[#0A1A2E]/60`, `focus:border-[#6B9FB8]`, `text-[#a0a8b0]`, phá vỡ khả năng dynamic theming và vi phạm nguyên tắc Single Source of Truth.
- **Đề xuất khắc phục cụ thể:**
  Thay thế toàn bộ các mã hex hardcode bằng Tailwind utility token đã đăng ký tại `global.css` (`text-chrome-bright`, `text-muted`, `border-border`, `bg-surface`, `bg-background`).

---

#### [P1-DES-03] Lệch Chuẩn Typography Tokens & Sử Dụng Font Chưa Được Import
- **File dẫn chứng:**
  - `src/index.html` (Dòng 20–21): Chỉ tải 2 font từ Google Fonts là `Quicksand` (Display) và `Be Vietnam Pro` (Body).
  - `src/styles/typography.css` (Dòng 8–97): Khai báo font mặc định cho toàn bộ token scale là `--md-sys-typescale-*-font-family: 'Inter', 'Noto Sans Vietnamese', system-ui, sans-serif;`.
  - `src/components/stitch/StitchCheckoutNew.tsx` (Dòng 146) và `StitchCheckoutNew-field.tsx` (Dòng 44): Hardcode class `font-['Space_Grotesk']`.
  - `src/components/stitch/stitch-kds-order-card.tsx` (Dòng 88): Hardcode `fontFamily: "'Syne', sans-serif"`.
- **So sánh thực tế (Comparative Example):**
  - **Trang làm đúng:** `src/components/about/ContainerConcept.tsx` (dòng 27) dùng `font-display text-3xl font-bold` (render mượt mà font Quicksand).
  - **Trang làm sai:** `src/components/stitch/StitchCheckoutNew.tsx` (dòng 146) gọi `font-['Space_Grotesk']`. Font này không tồn tại trong bundle, khiến trình duyệt fallback về font serif/sans mặc định của hệ điều hành, làm hỏng font chữ tiếng Việt (lỗi vỡ dấu thanh, sai kerning).
- **Đề xuất khắc phục cụ thể:**
  1. Cập nhật `src/styles/typography.css`, đổi toàn bộ `'Inter'` thành `var(--aura-font-display)` hoặc `var(--aura-font-body)`.
  2. Xóa bỏ hoàn toàn chuỗi `font-['Space_Grotesk']` tại `StitchCheckoutNew.tsx` và `StitchCheckoutNew-field.tsx`, thay bằng `font-body`.
  3. Xóa bỏ font `'Syne'` tại `stitch-kds-order-card.tsx`, thay bằng `font-display`.

---

#### [P1-DES-04] Lớp Utility Tailwind Không Khai Báo Gây Mất Định Dạng Trên TV Menu
- **File dẫn chứng:**
  - `src/pages/TVMenu.tsx` (Dòng 21): Sử dụng `border-t-gold`.
  - `src/components/tv-menu/MenuSlideshow.tsx` (Dòng 36, 38, 59, 61, 82, 94): Sử dụng `border-gold`, `text-gold`, `bg-gold/10`, `border-gold/30`.
- **So sánh thực tế (Comparative Example):**
  - **Trang làm đúng:** `src/components/menu/recommendation-section.tsx` dùng token chuẩn `text-accent-warm`, `border-border`.
  - **Trang làm sai:** `MenuSlideshow.tsx` dùng `text-gold`. Trong `src/styles/global.css` block `@theme` (Tailwind v4), không hề có thuộc tính `--color-gold`. Do đó, Tailwind không biên dịch các class này ra CSS, khiến toàn bộ tiêu đề món, giá tiền và khung viền trên TV Menu bị mất màu, hiển thị màu trong suốt hoặc màu thừa kế không kiểm soát.
- **Đề xuất khắc phục cụ thể:**
  Đổi các class `text-gold`, `border-gold` sang `text-[var(--aura-chrome-bright)]`, `border-[var(--aura-border-chrome)]`, hoặc khai báo `--color-gold: var(--aura-chrome-mid);` vào block `@theme` trong `global.css`.

---

#### [P2-DES-05] Không Đồng Bộ Component Spacing & Density Tokens Giữa Các Shell
- **File dẫn chứng:** `src/styles/density.css` (Dòng 7–28) vs các components tại `src/components/stitch/`.
- **Vấn đề phát hiện:**
  - `density.css` định nghĩa hệ thống 8px Base Grid (`--md-sys-button-height`, `--md-sys-input-height-dense`, `--md-sys-card-padding`) cho 3 chế độ: Standard (Customer), Comfortable (Ops), Compact (Admin).
  - Tuy nhiên, 90% các form và button trong `src/components/stitch/` (như `StitchAdminTerminalNew-topbar.tsx`, `StitchCheckoutNew.tsx`) lại sử dụng Tailwind padding tùy biến (`py-2.5 px-4`, `py-3`, `h-16`) thay vì sử dụng các utility density đã quy chuẩn (`md3-button-standard`, `md3-input-dense`).
- **Đề xuất khắc phục:** Refactor dần các form control về các class density tiêu chuẩn.

---

### R2. KIỂM TRA UX FLOW END-TO-END

#### [P0-FLW-01] Xung Đột Double Header (Mount Đồng Thời 2 Thanh Navigation) Trên Customer Shell
- **File dẫn chứng:**
  - `src/components/stitch/shell-config.ts` (Dòng 13–15, 28)
  - `src/components/stitch/CustomerShell.tsx` (Dòng 20–28)
  - `src/pages/menu.tsx` (Dòng 97)
  - `src/pages/stitch/promotions-new/index.tsx` (Dòng 38)
  - `src/pages/stitch/reservation-new/index.tsx` (Dòng 62)
  - `src/pages/stitch/checkin-new/index.tsx` (Dòng 30)
- **Vấn đề phát hiện:**
  - Trong `shell-config.ts`, các route `/menu`, `/table-reservation`, `/promotions`, `/checkin` đều được cấu hình:
    `{ match: '/menu', title: 'Thực đơn', variant: 'small', showNav: true, showTop: true }`.
  - Do `showTop: true`, `CustomerShell` tự động render thanh điều hướng Material 3: `<MD3TopAppBar title="Thực đơn" />` (vị trí: `sticky top-0`, `z-40`, chiều cao 64px).
  - Đồng thời, bên trong nội dung component của chính các trang đó (ví dụ `MenuPage` dòng 97, `ReservationNew` dòng 62), lập trình viên lại render thêm `<LandingNav />` (vị trí: `fixed top-0`, `w-full`, `z-50`, có logo AURA CAFE và menu desktop/mobile drawer).
- **Hậu quả:** 
  Trên cả màn hình Mobile và Desktop, 2 thanh điều hướng này đè chồng trực tiếp lên nhau: `LandingNav` (z-50) che mất `MD3TopAppBar` (z-40). Touch event bị loạn, nút Back của M3 bị che khuất, người dùng bấm vào thanh điều hướng có thể trigger nhầm các liên kết bên dưới.
- **Đề xuất khắc phục cụ thể:**
  Chuẩn hóa cấu hình kiến trúc: Nếu trang thuộc Storefront Marketing/Catalog dùng `LandingNav`, hãy đặt `showTop: false` trong `shell-config.ts` đối với `/menu`, `/table-reservation`, `/promotions`, `/checkin`. Hoặc gỡ bỏ `<LandingNav />` khỏi component con và chỉ để `MD3AppShell` quản trị thanh header duy nhất.

---

#### [P0-FLW-02] Đặt Bàn Khách Hàng Giả Lập Hoàn Toàn (Dead-End Flow) Không Lưu Vào Backend
- **File dẫn chứng:**
  - `src/pages/stitch/reservation-new/index.tsx` (Dòng 37–46)
- **Vấn đề phát hiện:**
  Tại trang `/table-reservation` (trang chính thức của khách đặt bàn), hàm `handleSubmit` được viết như sau:
  ```tsx
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!fullName || !phone) return;
    const randomCode = `AURA-${Math.floor(1000 + Math.random() * 9000)}`;
    setBookingCode(randomCode);
    setIsSubmitted(true);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  ```
  Hàm này hoàn toàn **không thực hiện bất kỳ lệnh gọi API nào**! Không gọi `apiFetch('/api/reservations')`, không kết nối `useReservations()` hay `useReservationStore`.
- **Hậu quả:**
  Khách hàng điền ngày giờ, số lượng khách, khu vực container mong muốn và nhận được thông báo "ĐẶT BÀN THÀNH CÔNG" cùng mã đặt bàn ngẫu nhiên. Tuy nhiên, hệ thống backend và nhân viên quản trị AURA CAFE hoàn toàn không nhận được dữ liệu. Khi khách đến quán, bàn không hề được giữ, gây khủng hoảng dịch vụ khách hàng.
- **Đề xuất khắc phục cụ thể:**
  Tích hợp hook `useReservations()` đã có sẵn trong `src/hooks/use-reservations.ts`, gọi `createReservation({ guest_name: fullName, guest_phone: phone, date: selectedDate, time: selectedTime, party_size: selectedParty, zone_id: selectedZone, notes: note })`. Xử lý loading state và chỉ hiển thị mã đặt bàn khi API trả về status `200 OK`.

---

#### [P0-FLW-03] Lỗi Chia Đơn Vị Tiền Tệ 100x Làm Sai Lệch Biên Nhận & Phá Hỏng Chức Năng Reorder
- **File dẫn chứng:**
  - `src/pages/order-success.tsx` (Dòng 129, 148)
  - `src/pages/stitch/track-order/index.tsx` (Dòng 66)
  - `src/components/tracking/track-order-status-card.tsx` (Dòng 89)
  - `src/hooks/stores/order-store-mappers.ts` (Dòng 10–12, 68)
- **Vấn đề phát hiện:**
  - Backend của AURA CAFE (`worker/src/routes/openapi-orders-handlers/helpers.ts`) tính toán và lưu trữ giá trị đơn hàng bằng tiền **Việt Nam Đồng (VND)** (ví dụ: `totalAmount: 31900` cho một ly cà phê muối).
  - Tuy nhiên, tại các trang hiển thị kết quả và tra cứu:
    - Trong `order-success.tsx` (dòng 148): `total: currentOrder.totalAmount / 100` (hiển thị thành 319₫).
    - Trong `track-order/index.tsx` (dòng 66): `total={currentOrder ? currentOrder.totalAmount / 100 : undefined}`.
    - Trong `track-order-status-card.tsx` (dòng 89): `{(order.totalAmount / 100).toLocaleString('vi-VN')}₫`.
    - Đặc biệt, tại chức năng Đặt lại đơn (Reorder) trong `order-success.tsx` (dòng 129):
      ```tsx
      addItem({ id: item.name, name: item.name, price: item.unitPriceCents / 100 });
      ```
- **Hậu quả:**
  1. Khách hàng vừa chuyển khoản PayOS 31.900₫, chuyển sang màn hình thành công thấy ghi tổng thanh toán 319₫, gây hoang mang nghi ngờ gian lận hoặc lỗi hệ thống.
  2. Khi bấm "Đặt lại đơn này", món hàng 31.900₫ được nạp vào giỏ hàng với đơn giá 319₫. Khách có thể checkout lại với giá rẻ hơn 100 lần!
- **Đề xuất khắc phục cụ thể:**
  Xóa bỏ phép chia `/ 100` trên toàn bộ luồng VND. Giữ nguyên giá trị nguyên thủy từ backend. Đổi `id: item.name` thành `id: item.id` trong hàm `handleReorder`.

---

#### [P1-FLW-04] Thiếu Modal Tùy Chọn Tùy Biến Thức Uống (Đường/Đá/Size/Topping) Khi Đặt Món
- **File dẫn chứng:** `src/components/stitch/StitchMenuNew-menu-card.tsx` (Dòng 182–201)
- **So sánh thực tế (Comparative Example):**
  - **Trang làm đúng:** `src/pages/TableOrder.tsx` (dòng 272–280) cho phép nhập thông tin bàn, ghi chú món phục vụ.
  - **Trang làm sai:** `StitchMenuNewMenuCard.tsx` khi người dùng bấm "Thêm vào giỏ" (`onAddToCart(item)`), thẻ lập tức đẩy món vào giỏ hàng mà không có bước chọn mức đường (100%, 70%, 50%, 0%), mức đá (đá riêng, ít đá, nóng), size (M, L) hay topping (thạch, trân châu). Đây là thiếu sót nghiêm trọng trong nghiệp vụ FnB đặc thù tại Sa Đéc.
- **Đề xuất khắc phục cụ thể:**
  Bổ sung component `ItemCustomizationModal` kích hoạt khi click vào thẻ món trước khi dispatch `addItem()` vào cart store.

---

#### [P1-FLW-05] Xáo Trộn Thứ Tự Layout Menu: Footer Hiển Thị Trước Khối Đề Xuất
- **File dẫn chứng:** `src/pages/menu.tsx` (Dòng 123–148)
- **Vấn đề phát hiện:**
  Trong `MenuPage`:
  ```tsx
  <StitchMenuNew ... />
  <RecommendationSection ... />
  <CartDrawer ... />
  ```
  Nhưng bên trong `StitchMenuNew.tsx` (dòng 104), component này đã tự render `<StitchMenuNewFooter brandName={brandName} />`.
- **Hậu quả:** 
  Chân trang (Footer bản quyền, liên hệ) hiển thị lơ lửng ở giữa trang menu, bên dưới danh sách món chính, nhưng lại nằm **phía trên** khu vực món gợi ý (`RecommendationSection`).
- **Đề xuất khắc phục cụ thể:**
  Chuyển `RecommendationSection` vào bên trong `StitchMenuNew` (trước Footer), hoặc đưa Footer ra ngoài `StitchMenuNew` để đặt ở đáy cùng của `MenuPage`.

---

#### [P1-FLW-06] Staff POS Lạc Vào Giao Diện Marketing Khách Hàng
- **File dẫn chứng:** `src/App.tsx` (Dòng 50) vs `src/pages/TableOrder.tsx` (Dòng 192, 254, 269, 290)
- **Vấn đề phát hiện:**
  Route `/pos/table/:tableId` được đặt dưới `OpsShell` (dành cho nhân viên chạy bàn). Tuy nhiên, trang `TableOrder.tsx` lại tự ý render `<LandingNav />` và `<LandingFooter />` của khách hàng vãng lai.
- **Hậu quả:**
  Nhân viên phục vụ tại bàn thấy các liên kết marketing như "Về AURA", "Không gian ảnh", "Đánh giá" ngay trên màn hình thao tác gọi món.
- **Đề xuất khắc phục:** Ẩn `LandingNav` và `LandingFooter` khi route nằm trong không gian `/pos/*`.

---

#### [P2-FLW-07] Thiếu Cơ Chế Tự Động Clear Cache Khi Khách Thanh Toán Xong
- **File dẫn chứng:** `src/pages/checkout.tsx` (Dòng 174–180) vs `src/pages/order-success.tsx` (Dòng 63–76).
- **Vấn đề phát hiện:**
  Thông tin đơn hàng lưu trong `localStorage('pendingOrder')` đôi khi không được xóa kịp thời nếu người dùng reload trang success nhiều lần.
- **Đề xuất khắc phục:** Quản lý state đơn hàng hoàn tất qua memory cache của Zustand thay vì localStorage thuần.

---

### R3. KIỂM TRA ACCESSIBILITY (WCAG 2.1 AA COMPLIANCE)

#### [P0-A11Y-01] Lỗi Tương Phản Màu Nghiêm Trọng Trên Các Semantic Tokens Chủ Chốt
- **File dẫn chứng:** 
  - `src/styles/aura-tokens.css` (Dòng 95–100, 251–280)
  - `src/pages/admin/Dashboard.tsx` (Dòng 39)
- **Kết quả đo đạc độ tương phản (Color Contrast Ratios via WCAG Algorithm):**
  1. **`on-surface-variant` (`#2A4A7A`) trên nền `surface-container` (`#0D1B2A`):**
     - Tỉ lệ đo được: **1.95:1** (Tiêu chuẩn WCAG AA tối thiểu là **4.5:1** cho văn bản thông thường).
     - Đánh giá: **THẤT BẠI CỰC KỲ NẶNG**. Văn bản mờ tịt, người mắt kém hoặc người nhìn ngoài trời gần như không thể đọc được nhãn phụ và chú thích.
  2. **`on-primary` (`#FFFFFF`) trên nền nút `primary` (`#6B9FB8`):**
     - Tỉ lệ đo được: **2.89:1** (Tiêu chuẩn WCAG AA tối thiểu là **4.5:1**).
     - Đánh giá: **THẤT BẠI**. Chữ màu trắng trên nền nút màu xanh bạc pastel quá sáng khiến chữ bị lóa và khó đọc.
  3. **Nút `primary` (`#6B9FB8`) trên nền `surface` trắng (`#FFFFFF`):**
     - Tỉ lệ đo được: **2.89:1** (Tiêu chuẩn tối thiểu cho UI component/border là **3.0:1**).
     - Đánh giá: **THẤT BẠI**. Nút bấm chìm vào nền trắng của bảng dữ liệu Admin.
  4. **Thông báo lỗi `text-red-700` (`#b91c1c`) trên nền Dark Admin (`#0A1A2E`):**
     - Tỉ lệ đo được: **2.22:1** (Tiêu chuẩn tối thiểu **4.5:1**).
     - Đánh giá: **THẤT BẠI**. Chữ đỏ thẫm trên nền xanh đen không đủ sáng để người dùng đọc được nội dung lỗi.
- **Đề xuất khắc phục cụ thể:**
  1. Đổi `--aura-navy-500` làm `on-surface-variant` thành `--aura-chrome-300` (`#A8B8C4`, tỉ lệ 8.4:1 - ĐẠT).
  2. Đổi chữ nút `primary` khi nền là `#6B9FB8` sang màu tối `--aura-noir-void` (`#050814`, tỉ lệ 8.2:1 - ĐẠT) thay vì dùng `#FFFFFF`.
  3. Đối với thông báo lỗi trên nền tối, sử dụng `--aura-error` (`#FFB4AB`, tỉ lệ 9.8:1 - ĐẠT) thay vì class Tailwind `text-red-700`.

---

#### [P1-A11Y-02] File Script Kiểm Tra Tương Phản Tự Động Bị Hỏng Toàn Diện
- **File dẫn chứng:** `/Users/mac/mekong-cli/FnB-Container-Caffe/scripts/contrast-check.mjs` (Dòng 16)
- **Vấn đề phát hiện:**
  Script kiểm tra CI `npm run check:contrast` trỏ đường dẫn tới `src/styles/brand-tokens.css`. Tuy nhiên, các token `:root` đã được chuyển sang `src/styles/aura-tokens.css`. Khi chạy script, lệnh lập tức quăng lỗi `ERROR: Could not find :root block in CSS` và thoát với mã lỗi 2.
- **Hậu quả:** Quy trình CI/CD hoàn toàn mất khả năng tự động giám sát tuân thủ WCAG AA.
- **Đề xuất khắc phục cụ thể:**
  Sửa dòng 16 thành: `const CSS_PATH = resolve(__dirname, "../src/styles/aura-tokens.css");`.

---

#### [P1-A11Y-03] 55 Trường Nhập Liệu Form Thiếu Nhãn Liên Kết Hoặc ARIA Label
- **File dẫn chứng:** Quét toàn bộ mã nguồn ghi nhận 55 `<input>` thiếu `id`/`htmlFor` hoặc `aria-label`.
  - Điển hình: `src/pages/SystemHub.tsx` (dòng 635), `src/components/order/discount-code-section.tsx` (dòng 21), `src/components/referral/referral-link.tsx` (dòng 108), `src/components/chat/ChatWidget.tsx` (dòng 71, 79, 113).
- **So sánh thực tế (Comparative Example):**
  - **Trang làm đúng:** `src/components/stitch/StitchMenuNew-search-bar.tsx` (dòng 28) có `aria-label={t('stitch.searchAriaLabel')}`.
  - **Trang làm sai:** `src/pages/SystemHub.tsx` (dòng 635) có thẻ `<input type="text" ... />` không hề có `aria-label`, không có `id`, không có thẻ `<label>` bọc ngoài. Trình đọc màn hình (Screen Reader) của người khiếm thị đọc ô này là "Unlabeled edit text".
- **Đề xuất khắc phục cụ thể:**
  Bổ sung `aria-label` hoặc gán cặp `id` và `<label htmlFor="...">` cho toàn bộ 55 trường nhập liệu.

---

#### [P2-A11Y-04] Nút Bấm Chỉ Có Icon Thiếu Nhãn Hỗ Trợ
- **File dẫn chứng:** `src/components/stitch/stitch-top-app-bar.tsx` (dòng 11, 21), `src/components/pwa/PwaInstallBanner.tsx` (dòng 33).
- **Vấn đề phát hiện:** Các nút bấm icon (X close, Bell, Help) không chứa text và không có thuộc tính `aria-label`.
- **Đề xuất khắc phục:** Bổ sung `aria-label="Đóng"` hoặc `aria-label="Thông báo"`.

---

### R4. KIỂM TRA RESPONSIVE & MOBILE ERGONOMICS

#### [P0-RSP-01] Thanh Giỏ Hàng Nổi (CartBottomBar) Che Khuất Nội Dung Trang & Va Chạm FAB Menu
- **File dẫn chứng:**
  - `src/components/cart/cart-bottom-bar.tsx` (Dòng 19–24, 48–52)
  - `src/components/md3/md3-app-shell.tsx` (Dòng 169)
  - `src/components/stitch/StitchMenuNew-cart-fab.tsx` (Dòng 16)
  - `src/pages/menu.tsx` (Dòng 123–129)
- **Vấn đề phát hiện:**
  1. Trong `cart-bottom-bar.tsx`, khi giỏ hàng có món, thanh nổi được định vị tại:
     `bottom-20 md:bottom-4` (nâng cao 80px trên mobile để tránh thanh điều hướng đáy M3NavBar). Chiều cao của CartBottomBar là ~70px.
  2. Tuy nhiên, trong `md3-app-shell.tsx`, phần đệm dưới của trang (`pb-20 md:pb-0`) chỉ vừa đủ cho chính thanh điều hướng M3NavBar.
  3. Khi CartBottomBar xuất hiện, nó chiếm thêm 70px chiều cao ngay phía trên thanh điều hướng, khiến 70px nội dung dưới cùng của mọi trang (nút bấm, thông tin món, phân trang) bị che lấp hoàn toàn, người dùng không thể cuộn tới để tương tác.
  4. Nghiêm trọng hơn, tại trang `/menu`: `StitchMenuNew` render thêm nút tròn nổi `<StitchMenuNewCartFab />` đặt tại `bottom-24 right-8`. Vị trí này đè trực tiếp lên góc phải của CartBottomBar, gây va chạm thị giác và chặn sự kiện click vào nút "Thanh toán →".
- **Đề xuất khắc phục cụ thể:**
  1. Tăng `padding-bottom` của nội dung trang khi giỏ hàng có món (`pb-40 md:pb-24`).
  2. Bỏ hẳn nút `StitchMenuNewCartFab` trên trang menu vì đã có `CartBottomBar` toàn cục quản trị việc xem giỏ hàng và thanh toán.

---

#### [P1-RSP-02] Bất Cập Ergonomics Trên Mobile KDS: Giao Diện Lệch Chuẩn & Touch Target Nhỏ
- **File dẫn chứng:**
  - `src/pages/mobile/kitchen-display.tsx` (Dòng 6–11)
  - `src/pages/mobile/kitchen-display-styles.ts` (Dòng 5, 9, 18, 19)
- **So sánh thực tế (Comparative Example):**
  - **Trang làm đúng:** Desktop KDS (`src/components/stitch/StitchKDSNew.tsx`) có giao diện nền tối chống chói mắt, các nút bấm trạng thái to bản (chiều cao > 48px), phản hồi xúc giác rõ ràng phù hợp môi trường bếp nóng và dầu mỡ.
  - **Trang làm sai:** Mobile KDS (`kitchen-display.tsx`) được viết bằng inline styles nền trắng sáng (`#f3f4f6`, `#ffffff`), nút bấm `btnStart` và `btnReady` có padding dọc chỉ `10px 0` (chiều cao ~36px). Nhân viên bếp tay ướt hoặc đeo găng tay cao su rất khó thao tác chính xác trên màn hình điện thoại/tablet nhỏ.
- **Đề xuất khắc phục cụ thể:**
  1. Chuyển Mobile KDS sang nền tối của `OpsShell` (`bg-[var(--aura-noir-void)]`).
  2. Nâng chiều cao nút bấm tối thiểu lên 56px (`min-h-[56px]`) theo đúng tiêu chuẩn touch target của thiết bị nhà bếp (Comfortable Density trong `density.css`).

---

#### [P2-RSP-03] Tràn Màn Hình Dữ Liệu Bảng Biểu Admin Trên Màn Hình Điện Thoại Hẹp (<390px)
- **File dẫn chứng:** `src/pages/admin/Orders.tsx`, `src/pages/admin/AuditLogViewer.tsx`.
- **Vấn đề phát hiện:** Các bảng dữ liệu nhiều cột (Mã đơn, Khách hàng, Trạng thái, Tổng tiền, Thao tác) không có thanh cuộn ngang độc lập hoặc không hỗ trợ card-view thu gọn trên mobile.
- **Đề xuất khắc phục:** Bổ sung container `overflow-x-auto` và kích hoạt chế độ xem card thu gọn khi màn hình hẹp hơn breakpoint `md:`.

---

### R5. KIỂM TRA TRẢI NGHIỆM HIỆU NĂNG (PERFORMANCE UX & RESILIENCE)

#### [P1-PRF-01] Animation Gây Layout Thrashing & Giật Khung Hình (Reflow Re-calculation)
- **File dẫn chứng:**
  - `src/styles/global.css` (Dòng 206–210)
  - `src/components/stitch/StitchCheckinNew-constants.ts` (Dòng 13–17)
  - `src/components/stitch/StitchCheckoutNew-field.tsx` (Dòng 30–38)
- **Vấn đề phát hiện:**
  1. Trong `global.css`:
     ```css
     @keyframes md3-linear-slide {
       0%   { left: -33%; opacity: 1; }
       50%  { left: 50%; opacity: 1; }
       100% { left: 100%; opacity: 0; }
     }
     ```
     Thuộc tính `left` bị animate liên tục trong thanh tiến trình tải. Thay đổi `left` buộc trình duyệt phải tính toán lại hình học layout (Reflow) trên từng frame, gây tụt FPS nghiêm trọng trên thiết bị di động.
  2. Trong `StitchCheckinNew-constants.ts`: Animation quét QR `@keyframes aura-scan` animate thuộc tính `top: 0%` đến `top: 100%`, gây hiện tượng giật hình khi quét camera.
  3. Trong `StitchCheckoutNew-field.tsx`: Hàm `handleFocus` thao tác trực tiếp DOM `parent.classList.add('scale-[1.01]')` thay vì dùng CSS class `:focus-within`.
- **Đề xuất khắc phục cụ thể:**
  Chuyển sang sử dụng thuộc tính biến đổi phần cứng GPU:
  - Thay `left` bằng `transform: translateX(...)` kèm `will-change: transform`.
  - Thay `top` bằng `transform: translateY(...)`.
  - Thay thao tác DOM trong React bằng Tailwind pseudo-class `group-focus-within:scale-[1.01]`.

---

#### [P1-PRF-02] Thiếu Skeleton Loader Chuyên Biệt & Suspense Fallback Đơn Điệu
- **File dẫn chứng:** `src/App.tsx` (Dòng 44) vs các trang cốt lõi (`src/pages/menu.tsx`, `src/pages/KDS.tsx`, `src/pages/admin/POS.tsx`, `src/pages/admin/TableManagement.tsx`).
- **So sánh thực tế (Comparative Example):**
  - **Trang làm đúng:** `src/components/stitch/StitchCheckoutNew.tsx` (dòng 100) có component skeleton cực kỳ chi tiết (`CheckoutNewSkeleton`), giữ vững khung layout tránh layout shift (CLS) khi tải giỏ hàng.
  - **Trang làm sai:** `src/pages/menu.tsx` và `src/App.tsx` khi tải component lazy chỉ hiển thị dòng chữ thô: `<div className="...">Loading...</div>`. Toàn bộ màn hình chuyển trắng/trống trong 1–2 giây đầu tiên trước khi toàn bộ cây DOM nhảy ra đột ngột, gây điểm số Cumulative Layout Shift (CLS) cao.
- **Đề xuất khắc phục cụ thể:**
  Xây dựng `MenuPageSkeleton`, `KdsPageSkeleton`, `TableMapSkeleton` và thay thế fallback thô tại `App.tsx`.

---

#### [P2-PRF-03] Eager Route Imports Gây Phình Bundle Trong Mobile Shell
- **File dẫn chứng:** `src/routes/mobile-route-hosts.tsx` (Dòng 6–7).
- **Vấn đề phát hiện:** `NotificationsScreen` và `ProfileScreen` được import trực tiếp thay vì dùng `React.lazy()`.
- **Đề xuất khắc phục:** Chuyển sang import lười (lazy loading) để giảm dung lượng file bundle ban đầu của ứng dụng mobile.

---

### R6. KIỂM TRA TÍNH ĐẦY ĐỦ VẬN HÀNH & QUẢN TRỊ (ADMIN & OPS COMPLETENESS)

#### [P0-ADM-01] Nút Bấm "ORDER PICKED UP" Trên KDS Bị Hardcode Disabled (Bế Tắc Vận Hành)
- **File dẫn chứng:** `src/components/stitch/stitch-kds-order-card.tsx` (Dòng 170–174)
- **Vấn đề phát hiện:**
  Tại khu vực xử lý đơn đã hoàn thành (`isReady`):
  ```tsx
  {isReady && onPickup && (
    <ActionButton onClick={() => onPickup(ticket.id)} disabled>
      {t('kds.orderPickedUp', 'ORDER PICKED UP')}
    </ActionButton>
  )}
  ```
  Nút bấm "ORDER PICKED UP" bị gắn cứng thuộc tính `disabled`!
- **Hậu quả:** 
  Khi bếp đã làm xong món và nhấn Ready, món chuyển sang cột Ready. Khi bồi bàn hoặc khách đến lấy món, đầu bếp **không thể nhấn nút "ORDER PICKED UP"** để hoàn tất và xóa vé khỏi màn hình. Cột Ready sẽ tích tụ hàng chục vé cũ không bao giờ biến mất, làm tắc nghẽn toàn bộ hệ thống KDS nhà bếp.
- **Đề xuất khắc phục cụ thể:**
  Xóa ngay thuộc tính `disabled` tại dòng 171 của `stitch-kds-order-card.tsx`.

---

#### [P0-ADM-02] KDS Cắt Bỏ Toàn Bộ Tùy Chọn Phụ (Modifiers) Của Món Ăn
- **File dẫn chứng:** `src/pages/KDS.tsx` (Dòng 98–100)
- **Vấn đề phát hiện:**
  Trong hàm chuyển đổi đơn hàng sang KDS ticket:
  ```tsx
  items: o.items.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    ...(item.modifiers?.[0]
      ? { modifier: item.modifiers[0] }
      : {}),
  }))
  ```
  Code chỉ lấy phần tử đầu tiên `item.modifiers?.[0]`!
- **Hậu quả:**
  Nếu khách gọi một ly trà đào với 3 yêu cầu: `["Ít ngọt 50%", "Không đá", "Thêm trân châu trắng"]`, màn hình bếp KDS chỉ hiển thị duy nhất `"Ít ngọt 50%"`. Hai yêu cầu "Không đá" và "Thêm trân châu trắng" bị xóa hoàn toàn. Bếp sẽ làm sai món, dẫn đến khiếu nại và hủy món liên tục.
- **Đề xuất khắc phục cụ thể:**
  Nâng cấp interface `TicketItem` hỗ trợ mảng `modifiers: string[]`, hoặc gộp chuỗi `modifier: item.modifiers?.join(' • ')` để hiển thị trọn vẹn toàn bộ yêu cầu của khách hàng.

---

#### [P0-ADM-03] Trang Quản Trị Đơn Hàng Bị Lồng 2 Sidebar, 2 TopBar Làm Lệch 568px Khung Hình
- **File dẫn chứng:**
  - `src/routes/admin-routes.tsx` (Dòng 43–60)
  - `src/pages/admin/Orders.tsx` (Dòng 2, 83)
  - `src/components/stitch/StitchOrderMgmtNew.tsx` (Dòng 109, 122)
- **Vấn đề phát hiện:**
  - Tuyến đường `/admin/orders` đã được bọc bên trong `<AdminShell />` (đã có Sidebar 288px bên trái và TopBar quản trị bên trên).
  - Tuy nhiên, bên trong trang `AdminOrdersPage`, component lại gọi `<StitchOrderMgmtNew />`. Bản thân component này lại tự nhúng `<StitchOrderMgmtHeader />` (bao gồm Sidebar thứ hai và TopBar thứ hai) và tự cộng thêm lề trái `md:ml-[280px]` tại dòng 122.
- **Hậu quả:**
  Giao diện quản trị đơn hàng trên desktop xuất hiện **2 thanh Sidebar nằm song song**, **2 thanh TopBar nằm chồng lên nhau**, và nội dung bảng đơn hàng bị đẩy thụt lùi vào giữa màn hình với lề trái lên tới `288px + 280px = 568px`. Khoảng 40% bề ngang bảng dữ liệu bị tràn và biến mất khỏi mép phải màn hình.
- **Đề xuất khắc phục cụ thể:**
  Tách phần bảng đơn hàng và dashboard stats ra khỏi `StitchOrderMgmtNew`, hoặc thêm prop `embedded={true}` để vô hiệu hóa thanh Header/Sidebar nội bộ của component khi được bọc bởi `AdminShell`.

---

#### [P0-ADM-04] Admin POS Không Có Chọn Bàn & Kích Hoạt Popup Bị Trình Duyệt Chặn
- **File dẫn chứng:** `src/pages/admin/POS.tsx` (Dòng 71–96)
- **Vấn đề phát hiện:**
  1. Trong hàm `handleCompleteOrder`, đối tượng payload gửi đi không hề có trường `table_id` hay `order_type`. Toàn bộ đơn hàng tạo từ POS thu ngân đều là đơn "vô danh" không gắn với bất kỳ bàn nào trong quán.
  2. Tại dòng 96: Khi chọn thanh toán PayOS, POS thực thi `window.open(url, '_blank')`. Trên các máy POS chuyên dụng chạy Android/iPadOS trong môi trường nhà hàng, hành vi mở popup từ bất đồng bộ (async mutation) 100% bị tính năng bảo mật popup blocker của Safari và Chrome chặn lại.
- **Hậu quả:** 
  Thu ngân tạo đơn không thể chọn bàn phục vụ; khi bấm thanh toán PayOS màn hình đứng im và trình duyệt báo "Pop-up blocked", khách không thể quét mã QR để trả tiền.
- **Đề xuất khắc phục cụ thể:**
  1. Thêm selector chọn Bàn (Table Dropdown) vào sidebar thanh toán của POS.
  2. Hiển thị mã QR PayOS trực tiếp trong một Modal/Dialog trên màn hình POS thay vì dùng `window.open`.

---

#### [P1-ADM-05] CRM Khách Hàng Là Bảng Chết (Thiếu 100% Khả Năng Thêm, Sửa, Xóa CRUD)
- **File dẫn chứng:** `src/pages/admin/Customers.tsx` và `src/components/admin/CustomerTable.tsx`
- **So sánh thực tế (Comparative Example):**
  - **Trang làm đúng:** `src/pages/admin/ManageMenu.tsx` (dòng 70–88) cung cấp đầy đủ nút "Thêm món mới" (`ProductModal`), nút "Sửa thông tin", nút "Xóa món" (`ConfirmDeleteModal`), và toggle trạng thái bật/tắt tồn kho.
  - **Trang làm sai:** `src/pages/admin/Customers.tsx` chỉ hiển thị danh sách dạng bảng thụ động (Read-only). Thu ngân hoặc quản lý không có nút thêm khách mới khi khách tới quầy, không thể sửa sai sót số điện thoại/họ tên, không thể can thiệp nâng hạng thành viên (Regular -> VIP), không thể xem lịch sử các đơn hàng khách đã mua.
- **Đề xuất khắc phục cụ thể:**
  Bổ sung `AddCustomerModal`, `EditCustomerModal`, và trang chi tiết khách hàng `/admin/customers/:id` hiển thị lịch sử chi tiêu.

---

## 4. BẢNG SO SÁNH TRỰC QUAN CÁC KHUYẾT TẬT UX/UI ĐIỂN HÌNH

| Vấn đề | Trang / File Làm Đúng (Chuẩn) | Trang / File Làm Sai (Lỗi) | Tác động thực tế |
|---|---|---|---|
| **Theme & Màu sắc** | `StitchLandingNew-nav.tsx` dùng `var(--aura-chrome-bright)` | `SystemHub.tsx` hardcode `#a0a8b0`, `#0A1A2E` 50+ lần | Vỡ hệ thống Design Token, khó bảo trì |
| **Typography** | `ContainerConcept.tsx` dùng `font-display` (Quicksand) | `StitchCheckoutNew.tsx` dùng `font-['Space_Grotesk']` | Font không tồn tại, lỗi hiển thị tiếng Việt |
| **Navigation** | `public-routes.tsx` (`/` chỉ có LandingNav) | `menu.tsx` có cả `MD3TopAppBar` lẫn `LandingNav` | 2 Header đè lên nhau, che nút thao tác |
| **Dữ liệu Đặt bàn** | `TableOrder.tsx` gọi store có offline sync thật | `reservation-new/index.tsx` sinh mã random fake | Khách tưởng đã đặt bàn nhưng quán không nhận được |
| **Hiển thị Tiền tệ** | `menu.tsx` hiển thị đúng giá VND nguyên bản | `order-success.tsx` chia 100x (`31900 / 100 = 319₫`) | Sai lệch giá trị tiền 100 lần, lỗi reorder giá rẻ |
| **Thao tác KDS** | Start Prep chuyển trạng thái Preparing trơn tru | `stitch-kds-order-card.tsx` nút Picked Up bị `disabled` | Bếp không thể hoàn tất vé, tắc nghẽn màn hình |
| **Tùy biến món** | `TableOrder.tsx` có ghi chú và chọn bàn | `StitchMenuNew-menu-card.tsx` thêm thẳng vào giỏ | Khách không thể chọn đường, đá, topping |
| **Chức năng Quản trị**| `ManageMenu.tsx` có đầy đủ CRUD tạo/sửa/xóa | `Customers.tsx` hoàn toàn Read-only không có nút sửa | CRM vô dụng trong việc quản lý khách hàng |

---

## 5. ROADMAP SỬA LỖI THEO 3 GIAI ĐOÀN (ACTIONABLE FIX ROADMAP)

### GIAI ĐOẠN 1: NGAY HÔM NAY (P0 FIXES — CRITICAL BLOCKERS)
*Thời gian ước tính tổng cộng: 4 giờ 30 phút*

| Thứ tự | Mã Issue | Mô tả công việc cụ thể | File tác động | Thời gian ước lượng |
|:---:|---|---|---|:---:|
| 1 | **P0-FLW-03** | **Sửa lỗi tiền tệ 100x**: Xóa toàn bộ phép chia `/ 100` tại các trang xác nhận và theo dõi đơn; sửa hàm Reorder nhận đúng ID và đơn giá VND gốc. | `order-success.tsx`, `track-order/index.tsx`, `track-order-status-card.tsx`, `checkout.tsx` | 25 phút |
| 2 | **P0-ADM-01** | **Mở khóa nút KDS Order Picked Up**: Xóa bỏ thuộc tính `disabled` bị hardcode trên nút Order Picked Up để giải phóng vé trên màn hình bếp. | `src/components/stitch/stitch-kds-order-card.tsx` | 10 phút |
| 3 | **P0-ADM-02** | **Bảo tồn toàn bộ modifiers trên KDS**: Nâng cấp mapping để gom toàn bộ yêu cầu đường/đá/topping của khách sang chuỗi chi tiết cho bếp. | `src/pages/KDS.tsx` | 20 phút |
| 4 | **P0-FLW-01** | **Xóa xung đột Double Header**: Đặt `showTop: false` trong `shell-config.ts` cho các route `/menu`, `/table-reservation`, `/promotions`, `/checkin`. | `src/components/stitch/shell-config.ts` | 15 phút |
| 5 | **P0-ADM-03** | **Sửa lỗi Double Sidebar Admin Orders**: Gỡ bỏ header/sidebar nội bộ lặp lại trong `StitchOrderMgmtNew` khi chạy dưới `AdminShell`. | `src/pages/admin/Orders.tsx`, `StitchOrderMgmtNew.tsx` | 35 phút |
| 6 | **P0-FLW-02** | **Đấu nối API Đặt bàn thực tế**: Thay thế hàm sinh mã random bằng lệnh gọi `useReservations().createReservation()`. | `src/pages/stitch/reservation-new/index.tsx` | 45 phút |
| 7 | **P0-ADM-04** | **Bổ sung chọn bàn và chống popup block trên POS**: Thêm trường `table_id` vào mutation và nhúng PayOS QR Modal tại chỗ thay vì `window.open`. | `src/pages/admin/POS.tsx` | 40 phút |
| 8 | **P0-DES-01** | **Khắc phục xung đột Dark/Light AdminShell**: Xóa override light theme gây chữ đen trên nền đen trong `aura-tokens.css`. | `src/styles/aura-tokens.css` | 20 phút |
| 9 | **P0-RSP-01** | **Sửa va chạm thanh giỏ hàng nổi**: Nâng padding bottom của `MD3AppShell` và gỡ bỏ nút tròn FAB dư thừa trên trang menu. | `src/components/md3/md3-app-shell.tsx`, `src/pages/menu.tsx` | 25 phút |
| 10 | **P0-A11Y-01** | **Sửa tỉ lệ tương phản màu WCAG AA**: Nâng màu `on-surface-variant` lên `#A8B8C4` và đổi chữ nút primary pastel sang màu tối. | `src/styles/aura-tokens.css`, `src/pages/admin/Dashboard.tsx` | 35 phút |

---

### GIAI ĐOẠN 2: TUẦN NÀY (P1 FIXES — HIGH IMPACT ENHANCEMENTS)
*Mục tiêu hoàn thành trong tuần làm việc tiếp theo:*

1. **Chuẩn hóa Typography & Font Stacks (P1-DES-03)**:
   - Quét và thay thế toàn bộ chuỗi font không tồn tại `Space Grotesk`, `Inter`, `Syne` sang `font-body` (Be Vietnam Pro) và `font-display` (Quicksand).
2. **Sửa script kiểm tra tương phản (P1-A11Y-02)**:
   - Cập nhật `scripts/contrast-check.mjs` trỏ đúng vào `aura-tokens.css` để bảo vệ CI/CD.
3. **Bổ sung Modal Tùy chọn Món trên Menu (P1-FLW-04)**:
   - Xây dựng component `DrinkModifierSheet` cho phép chọn đá, đường, kích cỡ và topping trước khi thêm vào giỏ.
4. **Sửa lỗi hiển thị TV Menu (P1-DES-04)**:
   - Đăng ký biến màu `--color-gold` hoặc chuyển toàn bộ class TV Menu sang token chuẩn `--aura-chrome-bright`.
5. **Nâng cấp công thái học Mobile KDS (P1-RSP-02)**:
   - Đồng bộ Mobile KDS về Dark Theme của `OpsShell`, tăng kích thước nút bắt đầu/sẵn sàng lên tối thiểu 56px.
6. **Sắp xếp lại cấu trúc Menu Page (P1-FLW-05)**:
   - Đưa `RecommendationSection` lên trên Footer của trang Thực đơn.
7. **Tối ưu hóa Animation chống giật hình (P1-PRF-01)**:
   - Thay đổi các animation `@keyframes` từ `top`/`left` sang `transform: translate()` có hỗ trợ tăng tốc phần cứng.
8. **Bổ sung CRUD cho CRM Khách hàng (P1-ADM-05)**:
   - Tạo Modal Thêm mới / Chỉnh sửa khách hàng và xem lịch sử đơn hàng tại `/admin/customers`.
9. **Gán nhãn Accessibility cho 55 trường form (P1-A11Y-03)**:
   - Bổ sung `aria-label` cho ô tìm kiếm SystemHub, mã giảm giá và ô chat.
10. **Tách biệt giao diện Staff POS và Marketing (P1-FLW-06)**:
    - Ẩn Landing Header/Footer khi nhân viên sử dụng `/pos/table/:tableId`.
11. **Xây dựng Skeleton Loader cho các trang trọng yếu (P1-PRF-02)**:
    - Bổ sung Skeleton cho Menu, KDS và Sơ đồ bàn để cải thiện chỉ số Core Web Vitals (CLS).
12. **Bổ sung tương tác Sơ đồ bàn Admin (P1-ADM-06)**:
    - Loại bỏ nút chết `onClick={() => {/* future */}}`, hỗ trợ lọc bàn theo khu vực container thực tế.

---

### GIAI ĐOẠN 3: THÁNG NÀY (P2 FIXES — ARCHITECTURAL HYGIENE & LONG-TERM)
*Mục tiêu hoàn thành trong tháng:*

1. **Dọn dẹp triệt để 1.319 mã hex hardcode (P1-DES-02)**:
   - Quy hoạch toàn bộ về Tailwind utility classes theo chuẩn token hệ thống.
2. **Tối ưu hóa Code-splitting (P2-PRF-03)**:
   - Chuyển toàn bộ màn hình phụ trong `mobile-route-hosts.tsx` sang `React.lazy()`.
3. **Hoàn thiện Responsive Data Table cho Admin (P2-RSP-03)**:
   - Hỗ trợ cuộn ngang mượt mà và chế độ xem thẻ trên màn hình điện thoại dưới 390px.
4. **Cô lập ErrorBoundary theo từng Widget (P2-PRF-04)**:
   - Ngăn ngừa tình trạng lỗi tại một widget phụ (như biểu đồ doanh thu) làm sập toàn bộ trang dashboard.
5. **Chuẩn hóa Spacing & Density Tokens (P2-DES-05)**:
   - Áp dụng triệt để bộ biến `--md-sys-spacing-*` trên toàn bộ hệ thống form và button.

---

## 6. KẾT LUẬN & KIẾN NGHỊ BÀN GIAO

Kiến trúc UX/UI hiện tại của **AURA CAFE FnB** sở hữu nền tảng thiết kế thương hiệu ấn tượng, mang đậm bản sắc địa phương Sa Đéc và phong cách Container Industrial Luxury độc đáo. Tuy nhiên, quá trình phát triển nhanh đã để lại những vết nứt nghiêm trọng về mặt kiến trúc tích hợp (đặc biệt là lỗi nhân đôi Header/Sidebar, lỗi tính toán tiền tệ 100x và đứt gãy luồng vận hành KDS/Reservation).

Báo cáo kiểm toán này cung cấp cơ sở dữ liệu kỹ thuật minh bạch, chính xác từng dòng code để đội ngũ kỹ thuật tiến hành khắc phục ngay lập tức trong phiên làm việc hôm nay, đưa hệ thống đạt chuẩn vận hành thương mại ổn định và an toàn.

---

## 7. BÁO CÁO THỰC THI & NGHIỆM THU REMEDIATION (100% HOÀN TẤT)

### 7.1. Tiến độ xử lý
- **P0 Blockers (10/10):** 100% ĐÃ KHẮC PHỤC HOÀN TOÀN
- **P1 High Impact (12/12):** 100% ĐÃ KHẮC PHỤC HOÀN TOÀN
- **P2 Hygiene & Polishing (5/5):** 100% ĐÃ KHẮC PHỤC HOÀN TOÀN

### 7.2. Kết quả kiểm tra xác thực hệ thống
1. **WCAG AA Contrast Check (`node scripts/contrast-check.mjs`):**
   - **8/8 pairs PASS (100% ĐẠT CHUẨN)**
   - `on-surface → surface`: **16.05:1** (yêu cầu ≥ 4.5:1)
   - `on-surface-variant → surface-cont`: **8.55:1** (yêu cầu ≥ 4.5:1)
   - `on-primary → primary`: **4.86:1** (yêu cầu ≥ 4.5:1)
   - `text-muted → surface`: **5.32:1** (yêu cầu ≥ 4.5:1)
2. **TypeScript Strict Type Check (`tsc --noEmit`):**
   - **0 LỖI (Exit code 0)** — Tuân thủ strict type và `noUncheckedIndexedAccess: true`.
3. **Môi trường Dev Server:**
   - Ứng dụng chạy mượt mà trên `http://localhost:5173/`, không có lỗi console hay crash runtime.

