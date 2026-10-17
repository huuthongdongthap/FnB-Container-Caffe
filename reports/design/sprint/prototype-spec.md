# PROTOTYPE SPECIFICATION — BẢN IN A3 TUYỂN DỤNG AURACAFE

**Dự án:** AURA CAFE — F&B Container Caffe (29 Nguyễn Tất Thành, TP. Sa Đéc, Đồng Tháp)  
**Tài liệu:** `reports/design/sprint/prototype-spec.md`  
**Giai đoạn:** Design Sprint — Phase 2: Create (Prototype Spec Revision 3)  
**Ngày cập nhật:** 14/10/2026  

---

## 1. Bản đồ Tọa độ Bố cục Khổ in A3 (Grid & Coordinate Map: 297 × 420 mm)

```
0,0 ───────────────────────────────────────────────────────────── 297,0
│  [AN TOÀN VIỀN: MARGIN 12mm]                                      │
│                                                                   │
│  Y: 11.5 - 76 mm  ZONE 1: MASTER BRAND HEADER & CALL-OUT          │
│                   - AURA Master Logo Plaque (40×33.7mm, rx=3.8mm)  │
│                   - Tagline: Container Rooftop · 29 Nguyễn Tất Thành
│                   - Tiêu đề: THÔNG BÁO TUYỂN DỤNG (Headline Medium)
│                   - Phụ đề: JOIN OUR TEAM · WE ARE HIRING          │
│                                                                   │
│  Y: 86 - 221 mm   ZONE 2: CÁC VỊ TRÍ ỨNG TUYỂN (2 M3 CARDS)       │
│                   - Card 1: 01. BARISTA (PHA CHẾ) - H=58mm         │
│                   - Card 2: 02. THU NGÂN & PHỤC VỤ - H=58mm        │
│                   - Thu nhập: 15.000đ - 20.000đ/h + Thưởng + Tips │
│                                                                   │
│  Y: 231 - 305 mm  ZONE 3: QUYỀN LỢI & MÔI TRƯỜNG LÀM VIỆC (4 TILES)│
│                   - Ca làm linh hoạt / Xoay ca                    │
│                   - Thu nhập hấp dẫn + Tips + Thưởng              │
│                   - Đãi ngộ AURA VIP (Giảm 50% menu)              │
│                   - Đào tạo tay nghề & Lộ trình thăng tiến        │
│                                                                   │
│  Y: 312 - 396 mm  ZONE 4: CALL TO ACTION & LIÊN HỆ                │
│                   - Cụm mã QR Vector 29×29 dẫn form tuyển dụng    │
│                     (https://auraspace.cafe/tuyen-dung)           │
│                   - Hotline/Zalo: 0986.470.981 (Hỗ trợ 24/7)      │
│                   - Địa chỉ: 29 Nguyễn Tất Thành, Sa Đéc          │
│                                                                   │
│  Y: 410 - 420 mm  FOOTER METADATA & ACCENT STRIP                  │
0,420 ─────────────────────────────────────────────────────────── 297,420
```

---

## 2. Hệ Thống Token Màu Sắc & Kiểu Chữ (Material Design 3 Strict Tokens)

### 2.1 Material 3 Color Tokens
- **Base Surface (`--md-sys-color-surface`):** `#050D1A` (LinearGradient qua `#0A1A2E` đến `#02070F`) — Màu nền xanh đen Industrial Luxury.
- **Surface Container Low (`--md-sys-color-surface-container-low`):** `#0B1D33` (Dùng cho 4 thẻ quyền lợi Zone 3).
- **Surface Container (`--md-sys-color-surface-container`):** `#0E223D` (LinearGradient đến `#142C4C` cho 2 thẻ vị trí Zone 2).
- **Surface Container High (`--md-sys-color-surface-container-high`):** `#112948` (Dùng cho thẻ Master CTA Box Zone 4).
- **Surface Container Highest (`--md-sys-color-surface-container-highest`):** `#172B45` (Dùng cho Icon Avatar và Hotline Capsule).
- **On Surface (`--md-sys-color-on-surface`):** `#F0F4F8` / `#FFFFFF` (Trắng bạc tương phản cao cho tiêu đề vị trí và hotline).
- **On Surface Variant (`--md-sys-color-on-surface-variant`):** `#A2B0C0` / `#9EABB8` (Xám bạc cho nội dung phụ, địa chỉ, website).
- **Outline Variant (`--md-sys-color-outline-variant`):** `#2A4362` (Stroke viền thẻ 0.8mm).
- **Primary Accent (`--md-sys-color-primary`):** `url(#goldGrad)` (`#FFE680` -> `#FFD700` -> `#EFBD8A` -> `#C9924A`).
- **Secondary Accent (`--md-sys-color-secondary`):** `url(#chromeGrad)` (`#FFFFFF` -> `#E8EEF3` -> `#C9D6DF` -> `#8E9DA8`).

### 2.2 Material 3 Shape & Elevation Tokens
- **Corner Small (`--md-sys-shape-corner-small`):** `2.8mm` (Indicator pill, salary capsule).
- **Corner Medium (`--md-sys-shape-corner-medium`):** `4.2mm - 4.5mm` (Job Cards, Perks Tiles, Assist Chips, QR Card).
- **Corner Large (`--md-sys-shape-corner-large`):** `5.6mm` (Master CTA Card).
- **Elevation Level 1 (`--md-sys-elevation-level1`):** Drop-shadow dy=1.5mm, stdDeviation=2mm, opacity=0.5.
- **Elevation Level 2 (`--md-sys-elevation-level2`):** Drop-shadow dy=3mm, stdDeviation=3.5mm, opacity=0.65.

### 2.3 Typography Scale (Khổ in A3 — Đơn vị SVG ViewBox 297×420)
- **Master Brand Plaque Logo:** Bounding box an toàn 40 × 33.7mm, bảo toàn 100% nét chữ uốn lượn AURA CAFE.
- **Main Heading (Headline Medium):** 8.8mm, Serif ExtraBold, Màu trắng tinh `#FFFFFF`, Letter-spacing: 1.2mm.
- **Section Heading (Title Medium):** 5.8mm, Sans-serif ExtraBold, All-Caps, Màu `#EFBD8A`.
- **Role Title (Title Large):** 7.2mm, Sans-serif ExtraBold, Màu trắng `#FFFFFF`.
- **Role Body Text (Body Medium):** 4.6mm, Regular, Màu `#D4E3FF` và `#C9D6DF`.
- **Salary Capsule:** 4.9mm, Bold, Màu vàng kim `#FFD700` trên nền semi-transparent gold container.
- **Shift Chips (Label Large):** 4.0mm, Bold, Nằm trong M3 Assist Chip bo tròn 4.5mm.
- **Hotline Display:** 7.8mm, ExtraBold, Màu trắng `#FFFFFF`, Letter-spacing: 0.8mm.
- **Footer / Metadata:** 3.6mm, Medium, Màu `#6B7F96`.

---

## 3. Cấu Trúc SVG Elements & Web Integration

```xml
<svg viewBox="0 0 297 420" width="297mm" height="420mm">
  <defs>...</defs>
  <!-- Background & Shipping Container Ribs Texture -->
  <rect width="297" height="420" fill="url(#bgGrad)"/>
  <!-- Zone 1: Master Brand Plaque + Headline -->
  <!-- Zone 2: 2 Position Cards (Barista & Service) -->
  <!-- Zone 3: 4 Perk Grid Cells -->
  <!-- Zone 4: Master CTA Card (Vector QR + Hotline 0986.470.981 + Address 29 NTT) -->
</svg>
```

**Web Form Tuyển Dụng:**
- Đường dẫn: `/tuyen-dung` & `/ung-tuyen`
- Component: `src/pages/RecruitmentPage.tsx`
- Routing: `src/routes/public-routes.tsx`
- Vector QR Link: `https://auraspace.cafe/tuyen-dung`

---

## 4. Checklist Kỹ Thuật Trước Khi Gửi Xưởng In (Pre-Flight)

- [x] Kích thước chính xác: 297mm × 420mm (Khổ chuẩn DIN A3).
- [x] Vùng nội dung chính nằm trọn trong lề an toàn 12mm cách 4 cạnh biên.
- [x] Logo Master AURA CAFE giữ nguyên vẹn 100% từng nét uốn lượn chữ A, R, A (không crop tròn).
- [x] Đã bỏ vị trí số 3 (Trưởng ca), tái phân bổ 2 vị trí Barista và Phục vụ/Thu ngân với không gian thoáng đãng.
- [x] Thu nhập cập nhật chuẩn xác: **15.000đ - 20.000đ/giờ (15k - 20k/h)**.
- [x] Hotline / Zalo cập nhật chuẩn xác: **0986.470.981**.
- [x] Địa chỉ cập nhật chuẩn xác: **29 Nguyễn Tất Thành, TP. Sa Đéc, Đồng Tháp** (Đối diện Khách sạn Thảo Trâm 2).
- [x] Mã QR vector chuẩn xác ma trận 29×29, quét trực tiếp mở form tuyển dụng 60s online.
- [x] Proof PNG `designs/poster-tuyen-dung-a3.png` đã nghiệm thu trực quan đạt chuẩn mỹ thuật.
- [x] Bản in Giản lược Tái sử dụng Vĩnh viễn (Evergreen Minimalist Edition): `designs/poster-tuyen-dung-a3-minimal.svg` & `designs/poster-tuyen-dung-a3-minimal.png` tối ưu tầm nhìn xa 5-10m; loại bỏ hoàn toàn vị trí tuyển dụng, mức lương và mã QR để sử dụng lâu dài qua mọi đợt tuyển; tập trung vào Logo Master, đại tự TUYỂN DỤNG, Hotline 0986.470.981 và Địa chỉ 29 Nguyễn Tất Thành (đối diện KS Thảo Trâm 2).
