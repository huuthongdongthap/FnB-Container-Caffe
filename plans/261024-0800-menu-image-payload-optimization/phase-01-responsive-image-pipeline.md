# Phase 1 — Responsive image pipeline (AVIF + WebP, multi-width)

**Status:** chưa bắt đầu
**Depends on:** `3a8f1ac`

## Requirements

- Sinh derivative cho 53 ảnh ở **ba width**: 400 / 800 / 1200, hai format: AVIF q50 + WebP q80
- `<picture>` với `<source>` AVIF trước, `<img>` WebP làm fallback
- `srcset` đi kèm `sizes` để browser tự chọn
- 49 ảnh minh họa: chỉ re-derive từ source, **không đè file gốc đang dùng**
- 4 packshot giữ nguyên `object-contain`

## Files to create/modify

| File | Action |
|---|---|
| `scripts/build-menu-image-variants.mjs` | NEW — sinh derivative (mirror `convert-to-webp.mjs` pattern) |
| `src/lib/menu-drink-images.ts` | thêm helper resolve variants |
| `src/components/stitch/StitchMenuNew-menu-photo.tsx` | `<picture>` + srcset |

## Vì sao 400/800/1200

Đo từ grid: card nằm trong `max-w-7xl` (1280 px) với `px-6` (48 px) và
`xl:grid-cols-4` (`StitchMenuNew.tsx:86`) → ô ≈ **308 px**. `gap-8` (32 px)
làm 308 hơi lạc quan; thực tế ≈ 293 px.

| Width | Dự kiến | Dùng khi |
|---|---|---|
| 400 | ~35 KB | 1× card (đường đi phổ biến nhất) |
| 800 | ~75 KB | retina 2× card |
| 1200 | ~140 KB | ít dùng — giữ làm ceiling cho breakpoint lớn |

**Không sinh 1600/2400.** Không breakpoint nào cần, và đó là chỗ payload phồng lại.

## Implementation steps

1. **Script** `scripts/build-menu-image-variants.mjs`
   - Walk `public/menu/aura-drinks/*.webp`
   - Skip non-`.webp` (`preview.html`, `collection.json`)
   - Mỗi file → `-{w}.webp` (q80, effort 6) và `-{w}.avif` (q50, effort 6)
   - `withoutEnlargement: true` — 4 packshot nhỏ hơn 400 sẽ **không** bị phóng
   - Idempotent: skip nếu output đã tồn tại và mới hơn source
     (pattern của `convert-to-webp.mjs`)
   - In tổng size trước/sau

2. **Naming** — cùng thư mục, suffix width (`latte-800.webp`, `latte-800.avif`).
   Tránh thư mục con để rule `_headers` của phase 2 bắt được bằng một glob
   `/menu/aura-drinks/*`.

3. **Helper** trong `src/lib/menu-drink-images.ts` — component không được
   hardcode width hay format:
   ```ts
   /** Insert the width suffix before the extension. */
   function atWidth(path: string, width: number): string {
     return path.replace(/\.webp$/, `-${width}.webp`);
   }
   export function menuImageVariants(path: string) {
     return [400, 800, 1200].map((w) => ({ width: w, avif: atWidth(path, w), webp: atWidth(path, w) }));
   }
   ```
   Đổi width hoặc thêm AVIF → sửa một chỗ. Giữ tách khỏi component đang 34 dòng.

4. **Component** `StitchMenuNew-menu-photo.tsx` — `<picture>` bao `<img>`:
   ```tsx
   <picture>
     <source type="image/avif" srcSet={avifSrcSet} sizes={sizes} />
     <img ... srcSet={webpSrcSet} sizes={sizes} decoding="async" />
   </picture>
   ```
   **Giữ nguyên** logic `packshots`, `onError` fallback, `failedSources` — đó là
   hành vi đã có test, không được mất khi refactor sang `<picture>`.

   `sizes` phải khớp grid thật:
   `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` trong
   `max-w-7xl px-6` →
   `(max-width: 639px) 92vw, (max-width: 1023px) 46vw, (max-width: 1279px) 30vw, 293px`

5. **`loading="lazy"` giữ nguyên** — với 49 ảnh một trang, lazy mới là thứ
   quyết định initial payload, quan trọng hơn cả kích thước từng file.
   Thêm `decoding="async"` để decode không block main thread.

6. **Không đụng file 4 packshot gốc.** Chúng đã được re-encode ở `3a8f1ac`
   (tổng 109 KB), và resize lại từ source đã nén sẽ là generation loss thêm.

## Success criteria

- Script chạy idempotent — lần 2 skip hết
- `<picture>` chọn AVIF trên Chrome/Safari 17+, WebP trên browser cũ (verify
  bằng DevTools Network xem file nào thực sự được tải)
- 49 ảnh gốc trong `public/menu/aura-drinks/` **không bị xoá hay đè**
- 4 packshot ≤ 400 px không bị phóng lên
- `tsc --noEmit` clean, project lint 0 error
- Toàn bộ page payload (tổng các file thực tải ở 1×) ≤ 1.0 MiB

## Risks

| Risk | Mitigation |
|---|---|
| Sinh ~300 file làm nợ repo | Naming có hệ thống; cân nhắc gitignore nếu build sinh lại được |
| AVIF không decode trên browser cũ | `<picture>` bắt buộc fallback; test nhánh WebP ở `about://flags` tắt AVIF |
| `sizes` sai → browser chọn ảnh quá nhỏ, ảnh mờ | Lấy đúng grid ở `StitchMenuNew.tsx:86`; verify 3 breakpoint ở phase 3 |
| Re-derive từ source lossy | Source đã là ảnh đã phát hành — không thêm generation loss cho 49 ảnh minh họa |
| `/menu/*` chưa có cache header | Phase 2 xử lý — **đây là blocker thật nếu bỏ qua** |

## Next steps

Phase 2 bắt buộc đi kèng: hiện `/menu/*` **không có** `Cache-Control` nào trong
`_headers` (chỉ `/public/images/*` có) → ảnh bị tải lại mỗi lượt duyệt, triệt
tiêu toàn bộ lợi ích phase này.
