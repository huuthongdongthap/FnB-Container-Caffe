# Phase 0 — Real Asset Catalog & Placeholder Replacement

**Priority:** P0 · **Status:** In Progress (five-zone done) · **Depends:** none

## Overview

Map toàn bộ 17 ảnh thật từ quán (IMG_*.webp) vào đúng zones/pages, thay mọi placeholder image (62 aida-public + 1 unsplash). Đây là pre-work bắt buộc trước khi migrate M3 — đảm bảo UI hiển thị không gian thật của Aura Cafe Sa Đéc.

## Photo Inventory (17/17 verified)

Đã đọc và xác minh nội dung từng ảnh (17/17 — hoàn tất):

| File | Content | Spatial zone |
|------|---------|--------------|
| IMG_6565.webp | Courtyard wide-angle: tables, ferns, mature tree, mezzanine visible | **Sân vườn chính** — hero anchor |
| IMG_6566.webp | Kitchen/bar container + steel staircase to mezzanine | **Quầy Bar + Cầu thang** — spatial flow |
| IMG_6702.webp | Rooftop with wicker furniture | **Sky Deck** |
| IMG_6556-frame.webp | Indoor AC container, glass facade, dark wooden tables | **Noir Cabin / Phòng lạnh** |
| IMG_6699.webp | Interior with wall spotlights | **Aura Lounge** |
| IMG_6696.webp | Upper container balcony | **VIP Steel Nest / Ban Công** |
| IMG_6698.webp | Balcony variant | VIP Steel Nest alt |
| IMG_6703.webp | Rooftop alt angle | Sky Deck alt |
| IMG_6631.webp | Facade day — signage | Mặt tiền ban ngày |
| IMG_6593.webp | Facade night — signage | Mặt tiền ban đêm |
| IMG_6581.webp | Secondary exterior AURA | Mặt tiền phụ |
| IMG_6554-frame.webp | Steel staircase between floors | Cầu thang sắt |
| IMG_6555-frame.webp | Ground-floor courtyard | Sân vườn tầng trệt |
| IMG_6564.webp | Container seating indoor + ferns | Indoor container seating |
| IMG_6693.webp | Central garden + tree + staircase | Sân vườn giữa |
| IMG_6694.webp | Street view from upper level | Nhìn từ tầng trên |
| IMG_6697.webp | Noir Cabin interior | Noir Cabin interior |

## Related Files

- **Done:** `src/components/home/five-zone-showcase-data.ts` — `imageUrl` field + 5 zones mapped
- **Done:** `src/components/home/five-zone-showcase.tsx` — render `<img>` real photo thay emoji icon
- Modify: 62 files aida-public + 1 unsplash file (scan riêng trong Phase 5)
- Modify: `src/components/home/hero-section.tsx` + `HeroSection.tsx` — dùng IMG_6565 làm hero background
- Modify: about/contact/gallery pages — mapping theo bảng trên

## Implementation Steps

### 0.1 Five-zone showcase ✅ (done)

- `five-zone-showcase-data.ts`: thêm `imageUrl` per zone
- `five-zone-showcase.tsx`: render real photo thay emoji placeholder
- Mapping: Jade Counter→IMG_6566, Sky Deck→IMG_6702, Noir Cabin→IMG_6556-frame, Aura Lounge→IMG_6699, VIP Steel Nest→IMG_6696

### 0.2 Hero section

- `hero-section.tsx`: background IMG_6565 (courtyard wide-angle) hoặc giữ hero-container-front có sẵn
- Alt text mô tả đúng không gian: "Sân vườn trung tâm Aura Cafe, Sa Đéc"

### 0.3 Placeholder sweep (63 files)

Scan `grep -rl "aida-public" src/` → thay từng file:
- Ưu tiên feature theo bảng mapping zones
- Image URL pattern: `/photos/IMG_*.webp`
- Alt text theo không gian thật (không generic)
- File unsplash (StitchMenu2New-header) → IMG_6566 (bar + menu board)

### 0.4 Logo integration prep

- `logo.svg` dùng trong MD3TopAppBar (Phase 3)
- `logo-aura-rgb.png` cho dark/light contexts
- favicon đã có sẵn — không đụng

## Success Criteria

- [x] Photo inventory 17/17 verified (mỗi ảnh đã được đọc, nội dung xác nhận)
- [x] Five-zone showcase dùng real photos + alt text chuẩn
- [ ] Hero section dùng IMG_6565
- [ ] 62 aida-public files replaced
- [ ] 1 unsplash file replaced
- [ ] Build + tests green sau thay đổi
- [ ] Visual check: không còn placeholder image trên 16 pages audit

## Risk Assessment

- **Low:** Ảnh thật 4032×3024 nặng — cần WebP sizes (đã có 640/1024/1920 cho hero/zones; IMG_*.webp gốc cần resize nếu performance issues)
- **Medium:** 62 files thay ảnh có thể break visual tests nếu cũ assert placeholder URL — grep tests trước
- **Mitigation:** Batch theo feature, commit riêng, test sau mỗi batch
