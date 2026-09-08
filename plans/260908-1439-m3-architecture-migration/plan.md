# M3 Architecture Migration — Full Audit & Rebuild

**Ngày:** 2026-09-08 · **Nguồn:** `/plan` "dựng lại toàn bộ kiến trúc theo chuẩn M3, dựa trên commits tháng 6"
**Brand:** **AURA CAFE** (39 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp)
**Mode:** standard

## Mục tiêu

Migrate toàn bộ design system sang **Material Design 3 (M3)** — tokens, components, patterns, accessibility — **dùng ảnh thật từ quán (17 IMG_*.webp) thay mọi placeholder**, giữ brand palette (Navy + Forest + Chrome, Tokens v6.0), áp cho toàn bộ 31 feature dirs + 349 Stitch components.

## Hiện trạng (scout 2026-09-08)

| Khía cạnh | Trạng thái |
|-----------|-----------|
| Design tokens | `brand-tokens.css` v6.0 — 357 aura-* props, **chưa có md-sys-*** |
| M3 components | **0** — `src/components/md3/` chưa tồn tại |
| Placeholder images | 62 aida-public + 1 unsplash file — cần thay bằng ảnh thật |
| Ảnh thật | 17 IMG_*.webp trong `public/photos/`, 4 logo files, 4 zones (3 sizes), 2 heroes (3 sizes) |
| Tests | 341 files, 3115 tests — xanh |
| Five-zone showcase | `imageUrl` đã map vào 5 zones, component render real photos |

## Chiến lược 3 lớp token bridge (KHÔNG rewrite 349 components)

1. **M3 semantic tokens** (mới): `md-sys-color-*`, `md-sys-typescale-*`, `md-sys-shape-*`, `md-sys-elevation-*`, `md-sys-motion-*` — alias sang aura values
2. **TW v4 @theme mapping**: map md-sys → Tailwind utilities
3. **12 M3 primitives**: Tailwind-based, không thêm dependency

Components cũ aura-* tokens vẫn hoạt động. Migration từng page tự nguyện.

## Real Asset Catalog

**17 ảnh quán thật** tại `public/photos/`:

| Ảnh | Zone/Page | Vị trí |
|-----|-----------|--------|
| IMG_6565.webp | Hero / Sân vườn chính | Homepage hero banner (wide-angle courtyard) |
| IMG_6566.webp | Quầy Bar (Jade Counter) | Zone 01 — kitchen/bar + cầu thang |
| IMG_6702.webp | Sky Deck (Rooftop) | Zone 02 — sân thượng wicker |
| IMG_6556-frame.webp | Noir Cabin (Container) | Zone 03 — phòng lạnh AC |
| IMG_6699.webp | Aura Lounge | Zone 04 — nội thất đèn tường |
| IMG_6696.webp | VIP Steel Nest | Zone 05 — ban công tầng 2 |
| IMG_6631.webp | About Us hero | Mặt tiền ban ngày |
| IMG_6593.webp | About Us / nightlife | Mặt tiền ban đêm |
| IMG_6554-frame.webp | Architecture section | Cầu thang sắt |
| IMG_6555-frame.webp | Gallery / garden | Sân vườn tầng trệt |
| IMG_6564.webp | Gallery / indoor | Container seating + ferns |
| IMG_6581.webp | Contact / location | Mặt tiền phụ AURA |
| IMG_6693.webp | Gallery / garden2 | Central garden + tree |
| IMG_6694.webp | Gallery / street | Nhìn từ tầng trên |
| IMG_6697.webp | Gallery / cabin | Noir Cabin interior |
| IMG_6698.webp | Gallery / balcony | Ban công tầng 2 |
| IMG_6703.webp | Gallery / rooftop2 | Sân thượng góc khác |

**Logo files** tại `public/images/`:
- `logo.svg` — logo chính (dùng trong TopAppBar)
- `logo-aura-rgb.png` — RGB version
- `aura-space-logo-v2f.webp` — full logo

## Phases

| Phase | Nội dung | Status | Priority |
|-------|----------|--------|----------|
| [Phase 0](phase-00-real-asset-catalog.md) | Real Asset Catalog — map ảnh thật vào zones/pages, thay placeholder | **Mới** | P0 |
| [Phase 1](phase-01-m3-design-tokens.md) | M3 design token layer + TW v4 mapping | Pending | P0 |
| [Phase 2](phase-02-m3-component-primitives.md) | 12 M3 primitives + docs + tests | Pending | P0 |
| [Phase 3](phase-03-m3-navigation-patterns.md) | TopAppBar/NavigationBar vào core layouts + logo AURA CAFE | Pending | P1 |
| [Phase 4](phase-04-m3-a11y-motion.md) | WCAG AA + motion tokens + reduced-motion | Pending | P1 |
| [Phase 5](phase-05-stitch-batch-migration.md) | 132 files raw hex → M3 tokens + thay 63 placeholder images | Pending | P2 |
| [Phase 6](phase-06-verification.md) | Full verification: build + 3115 tests + visual audit 16 pages | Pending | P0 |

## Dependencies

```
Phase 0 (assets) → Phase 1 (tokens) → Phase 2 (primitives) → Phase 3 (nav) → Phase 4 (a11y)
                                                                          ↘ Phase 5 (batch)
Phase 6 (verify) — cuối cùng, gate tất cả
```

## Key Decisions

1. **Brand: AURA CAFE** — biển hiệu vật lý ghi "VIVA STAR COFFEE" nhưng brand canonical là AURA CAFE (codebase)
2. **Không thêm Material Web dependency** — Tailwind-based primitives
3. **Giữ 357 aura tokens** — M3 layer là alias
4. **Ảnh thật thay placeholder** — Phase 0 bắt buộc trước Phase 1
5. **Five-zone showcase** đã dùng `imageUrl` + real IMG_*.webp photos
