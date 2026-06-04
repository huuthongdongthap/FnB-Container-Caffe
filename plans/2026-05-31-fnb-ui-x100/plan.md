# ⚔️ AURA CAFE — X100 FnB UI Visual Overhaul & Bazi v5.1 Plan

> **Date:** 2026-05-31 | **Target Repo:** `~/mekong-cli/FnB-Container-Caffe`
> **Workflow:** Hard Mode (/plan + /ui-design-review + /teamwork-preview)
> **Goal:** Deeply research modern premium FnB UI/UX conventions, audit all pages, resolve visual EST overlapping, correct spelling typos, and standardize Bazi v5.1 theme harmony.

---

## 🏛️ Hướng Tiếp Cận Kiến Trúc (Architecture & Research)

Để đạt đẳng cấp visual X100 vượt trội và chuyển đổi tối ưu (FnB Conversion), Aura Cafe sẽ áp dụng các tiêu chuẩn thiết kế tinh tế nhất:

1. **Vệ sinh chính tả giao diện (Spelling Polish)**:
   - Sửa toàn bộ từ bị viết sai từ **`Đặt Bản`** thành **`Đặt Bàn`** trên thanh điều hướng (navbar), các nút bấm liên kết và form tương tác.
2. **Loại bỏ trùng lặp EST**:
   - Ẩn/che mốc năm `EST. 2023` in chìm trong logo PNG và đồng bộ sang hiển thị duy nhất nhãn `EST. 2018` cách điệu màu Chrome-Silver (`--aura-chrome-mid`).
3. **Typography Đồng bộ**:
   - Tiêu đề sử dụng font `Cormorant Garamond` (serif sang trọng, có độ nghiêng nghệ thuật thanh mảnh).
   - Nội dung và chữ thường sử dụng `Space Grotesk` (sans-serif hiện đại, phong cách industrial-luxury).
4. **Chuẩn hóa Bát tự v5.1 Dark Theme**:
   - Áp dụng triệt độ hệ màu tương sinh Kim - Thủy: màu bạc Chrome-Silver (`#C9D6DF`), xanh hải quân Deep-Sea Navy (`#0A1A2E`) và xanh ngọc bích Jade Green (`#4A7C59`).
   - Tuyệt đối không rò rỉ mã màu Hỏa/Thổ (đỏ, cam, tím, vàng đất sặc sỡ).

---

## 📅 Phân Chia Giai Đoạn (Phases Checklist)

### [Phase 1: Typography, Spelling & Overlap fixes](file:///Users/mac/mekong-cli/FnB-Container-Caffe/plans/2026-05-31-fnb-ui-x100/phase-01-typography-spelling.md) ✅ DONE
- [x] Sửa lỗi chính tả `Đặt Bản` thành `Đặt Bàn` trong `index.html`, `menu.html`, `table-reservation.html`, `contact.html`, `loyalty.html`, `about-us.html` và file điều phối `js/shared-nav.js`.
- [x] Điều chỉnh `.est-override` và logo container che khuất số 2023 trong PNG, hiển thị duy nhất nhãn `EST. 2018`.
- [x] Rà soát thuộc tính `.aura-sr-only` đảm bảo ẩn hoàn hảo H1 trên mobile/desktop.

### [Phase 2: FnB Premium conversion features](file:///Users/mac/mekong-cli/FnB-Container-Caffe/plans/2026-05-31-fnb-ui-x100/phase-02-fnb-visual-polish.md) ✅ DONE
- [x] Tích hợp hệ thống tag món ăn nghệ thuật (`🌿 Mộc Zone`, `💎 Specialty`, `🔥 Cay nồng`) trên menu.
- [x] Nâng cấp hiệu ứng hover zoom 60fps trên các card thực đơn kèm bóng phản chiếu ánh bạc (specular shine).
- [x] Thiết kế sơ đồ bàn **Interactive Glassmorphic Seat Grid** trên `table-reservation.html` với màu ngọc bích lấp lánh cho bàn trống và kim loại bạc mờ cho bàn đã đặt.

### [Phase 3: Bazi v5.1 Darktheme Harmonization Sweep](file:///Users/mac/mekong-cli/FnB-Container-Caffe/plans/2026-05-31-fnb-ui-x100/phase-03-bazi-darktheme-audit.md) ✅ DONE
- [x] Quét sạch 100% rò rỉ mã màu đỏ/vàng/cam cũ trên tất cả 11 trang con và các trang `/admin/*`.
- [x] Đồng bộ hóa màu nền về `--aura-noir-void` (#050D1A) và `--aura-noir-deep` (#0A1A2E).

---

## 🧪 Xác Minh (Verification Plan)
- Chạy 560/560 Jest unit tests thành công 100%.
- Đảm bảo Vite compile và ESLint check đạt 0 lỗi.
