# Menu image payload optimization

**Scope:** giảm payload ảnh menu cho web, giữ chất lượng đủ cho trải nghiệm duyệt web.
**Depends on:** commit `3a8f1ac` (49 ảnh đã ship)
**Blocks:** nothing

## Measured baseline

Toàn bộ 53 file `public/menu/aura-drinks/` = **6.10 MiB**, trung bình ~116 KB.

- 49 ảnh minh họa: 1200×900, lossy VP8, 83–140 KB
- 4 packshot: đã re-encode ở `3a8f1ac` (1558 KB → 109 KB)

**Display size thực** — card nằm trong `max-w-7xl` (1280 px) với `xl:grid-cols-4`
(`StitchMenuNew.tsx:86`), nên một card ≈ 280 px rộng, ảnh ≈ **280×210 @1× / 560×420 @2× retina**.
Toàn bộ ảnh hiện đang được phục vụ ở mức gấp **2.1×** kích thước retina cần thiết.

Hiện **không có** `srcset`, `<picture>`, hay bất kỳ responsive-image pattern nào
(`grep -rn "srcset\|<picture"` → không có kết quả).

## Kết quả đo được (chưa phải ước lượng)

| Cấu hình | Tổng | Giảm |
|---|---|---|
| Hiện tại (1200 px source) | 6.10 MiB | — |
| 560 px, webp q80 | 1.52 MiB | −75% |
| 560 px, **avif q50** | **0.83 MiB** | **−86%** |

Quality curve trên `latte.webp` (đo mean byte diff trên decoded pixels):

| WebP q | Size | Mean byte diff |
|---|---|---|
| q50 | 48 KB | 2.73 |
| q60 | 52 KB | 2.61 |
| q75 | 66 KB | 2.16 |
| q80 | 83 KB | 1.67 |

Ở q80 và cả q50, độ lệch pixel đều nhỏ hơn 3/255 — mắt không phân biệt được ở kích thước card.

**AVIF khả dụng:** sharp 0.35.3 trong repo build được AVIF (`latte.webp` → 45 KB).

## Phases

| Phase | Nội dung | Rủi ro |
|---|---|---|
| [1](phase-01-responsive-image-pipeline.md) | Sinh ảnh ở nhiều width + `<picture>` AVIF→WebP fallback | CSP, cache header |
| [2](phase-02-cache-and-csp-verification.md) | Fix cache header cho `/menu/*` (chưa có!) + verify build | Regressions |
| [3](phase-03-quality-gate.md) | Visual verify + budget test + docs cập nhật chuẩn | — |

## Khuyến nghị

**Phase 1+2.** Trả tiền một lần lúc build (53 ảnh → ~160 file derivative), rồi mỗi
lượt duyệt web tải 0.83 MiB thay vì 6.10 MiB. Responsive + AVIF có fallback nên
không có trường hợp browser nào hỏng.

Phase 3 giữ lại việc này không tụt lại — hiện `docs/05_TASKS/menu.md:82` ghi
"average image size < 50KB" và 49 ảnh đều vượt.
