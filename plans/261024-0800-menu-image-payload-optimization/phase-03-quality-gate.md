# Phase 3 — Quality gate + budget test

**Status:** chưa bắt đầu
**Depends on:** phase 02

## Vấn đề

`docs/05_TASKS/menu.md:82` ghi chuẩn "average image size < 50KB". Thực tế:
49 ảnh minh họa đang 83–140 KB, 53/53 vượt. Chuẩn này được viết trước khi có
ảnh thật nên không phản ánh điều gì đang xảy ra.

Hai lựa chọn:
- **A** — Hạ ảnh về đúng 50 KB: bắt buộc quality ~60 hoặc width ~400. Chất
  lượng vẫn chấp nhận được ở card 280 px, đo mean byte diff q60 = 2.61/255.
- **B** — Nới chuẩn lên ~120 KB ở width 1200, và coi payload *thực tế*
  (0.83 MiB toàn trang) là metric quan trọng.

Đề xuất **A cho card, B cho max-width ceiling**: ảnh bình thường ≤ 80 KB ở
800 px (retina card), file 1200 px chỉ là ceiling. Metric chốt = tổng payload
toàn trang, không phải per-file.

## Requirements

- Test fail nếu có resident image vượt budget
- Visual verify 3 breakpoint (390 / 768 / 1440)
- Docs cập nhật chuẩn thật

## Files to create/modify

| File | Action |
|---|---|
| `src/lib/__tests__/menu-image-budget.test.ts` | NEW — budget guard |
| `docs/05_TASKS/menu.md` | cập nhật chuẩn |
| `docs/12_CHANGELOG.md` | ghi optimization |

## Implementation steps

1. **Budget test** — walk `public/menu/aura-drinks/`, assert mỗi derivative
   `-400.*` ≤ 60 KB và `-800.*` ≤ 100 KB. Đọc file thật từ filesystem (đúng
   như `asset-checks.json` làm), **không** mock.
   ```ts
   // Budgets sized for the 308px card at 1x/2x (StitchMenuNew.tsx:86),
   // not for full-screen viewing.
   ```

2. **Visual verify** — 3 breakpoint, mỗi cái kiểm:
   - ảnh không mờ (không bị browser upscale do `sizes` sai)
   - không có layout shift khi scroll
   - ảnh đúng đồ uống (nhất là 4 packshot giữ tỷ lệ gốc)

3. **Docs** — sửa `menu.md:82` thành nêu rõ: card ≈ 308 px, budget per-width,
   và metric thật là tổng payload toàn trang. Xoá dòng "< 50KB" không chính xác.

## Success criteria

- Budget test fail khi một file synthetic vượt ngưỡng (verify bằng cách thêm
  file giả rồi xoá)
- 3 breakpoint không regression, không ảnh mờ
- `docs/05_TASKS/menu.md` mô tả đúng trạng thái sau optimization

## Risks

| Risk | Mitigation |
|---|---|
| Test đọc filesystem → chậm | Chỉ walk một thư mục, ~300 file, không mở/decode pixel |
| Chuẩn bị quá chặt → flaky | Đặt ngưỡng trên kết quả đo thật + 30% headroom |
| Xoá chuẩn cũ làm mất intent | Ghi rõ chuẩn cũ và lý do đổi, không xoá trơn |

## Kết quả verify (2026-10-24)

Budget test: `npx vitest run src/lib/__tests__/menu-image-budget.test.ts` → 4/4.
Fail-path đã chứng minh: thêm file giả 69 KB ở width 400 (trần 40 KB) → test đỏ,
báo đúng tên file + KB + ngưỡng; xoá file giả → xanh lại.

Visual gate (3 breakpoint, `verify-menu-images-browser.mjs`):

- Mọi breakpoint chỉ request `avif 400w` → `sizes` đo đúng, không tải 1200.
- Packshot giữ nguyên `bitmapRatio 0.418` + `objectFit: contain` → không crop.
- Không horizontal overflow ở breakpoint nào.
- Layout: khung ảnh `h-64` giữ nguyên width/height trước và sau khi bitmap về.

 Hai điểm phát hiện, **không phải regression của pipeline ảnh**:

1. `pepsi.webp` (191×635) và `red-bull.webp` (260×413) là master gốc đã nhỏ hơn
   cell 293 px, nên không derivative nào có thể đủ 1x — ảnh mềm bất kể nén thế
   nào. **Cần ảnh nguồn lớn hơn, không phải nén lại.** Guard mới
   (`keeps every master at least as wide as the variant it feeds`) bắt đúng 2
   file này và đang đỏ vì chúng — đây là kết quả có chủ đích, đã xác nhận với
   user, ghi nhận là technical debt chứ không hạ ngưỡng.
2. Card có description không clamp (`StitchMenuNew-menu-card.tsx`, `grow` không
   kèm `line-clamp`) nên card cao thấp khác nhau theo độ dài text. Đây là lỗi
   layout có từ trước (từ `41040bb`), không do ảnh.

## Open questions

Chuẩn 50 KB hiện tại là của anh hay chỉ là dấu vết từ bản nháp? Nếu là
quyếtịnh có chủ đích (ví dụ giới hạn 3G), phase 3 cần nói trước vì sẽ thay đổi
cách phase 1 đặt quality.
