# Phase 2 — Cache header + CSP for menu images

**Status:** chưa bắt đầu
**Depends on:** phase 01
**Blocks:** phase 03 (budget test vô nghĩa nếu ảnh tải lại mỗi lượt)

## Vấn đề đo được

`_headers` chỉ có cache rule cho `/public/images/*`, `/*.min.css`, `/*.min.js`.
Đường dẫn mới `/menu/aura-drinks/*` **không khớp glob nào**.

Hệ quả: mỗi lượt duyệt web tải lại ~6.10 MiB (hoặc 0.83 MiB sau phase 1) —
không cache, không `immutable`. Đây là lỗi đã có từ commit `3a8f1ac`, không
phải do phase 01 gây ra.

Deploy là `wrangler pages deploy dist/` (`deploy-cloudflare.sh:176`), nên
`_headers` phải nằm ở **root của `dist/`** lúc deploy. Verify `dist/_headers`
đã tồn tại và được copy (hiện tại script không copy `_headers`/`_redirects`
rõ ràng — cần kiểm, vì `dist/` có chúng nhưng không thấy lệnh copy trong
`deploy-cloudflare.sh`; có thể do Vite copy `public/` sang `dist/`).

## Requirements

- `/menu/aura-drinks/*` được cache `immutable, max-age=31536000`
- `Content-Type` đúng cho `.avif` (`image/avif`) — Vite/Pages thường tự lo,
  nhưng phải verify
- Không phá CSP hiện có (`img-src 'self' data: https: blob:` — **đã đủ**, ảnh
  từ `self` nên không cần đổi CSP)
- Không đổi bất kỳ security header nào khác

## Files to modify

| File | Action |
|---|---|
| `_headers` | thêm rule cho `/menu/*` |
| `deploy-cloudflare.sh` | verify `_headers` ship (chỉ nếu giải trình below đúng) |

## Implementation steps

1. Thêm vào `_headers`, ngay dưới block `/public/images/*` cho gọn:
   ```
   /menu/aura-drinks/*
     Cache-Control: public, max-age=31536000, immutable
   ```
   Vì sao `immutable` an toàn: tên file có width suffix (`latte-800.webp`).
   Nếu đổi ảnh, filename đổi → URL mới → không bao giờ stale cache.

2. Verify `dist/_headers` chứa rule sau `npm run build`. Nếu Vite không copy,
   thêm `cp _headers dist/` vào `deploy-cloudflare.sh:157` — chỗ đang
   `cp robots.txt sitemap.xml dist/`.

3. Verify `Content-Type: image/avif` bằng curl trên URL đã deploy:
   ```bash
   curl -sI https://<domain>/menu/aura-drinks/latte-800.avif | grep -i content-type
   ```

4. **Không** đụng CSP. `img-src` đã cho phép `'self'` và cả `https:`, ảnh
   same-origin qua được. Thêm `image/avif` vào CSP là thừa — CSP điều hành
   *nguồn*, không điều hành *format*.

## Success criteria

- `grep -A1 "/menu/aura-drinks" _headers` trả về rule
- `curl` trả `cache-control: public, max-age=31536000, immutable`
- `curl` trả đúng `image/avif` và `image/webp`
- Không rule security nào bị mất (`diff _headers` với bản gốc chỉ thêm dòng mới)

## Risks

| Risk | Mitigation |
|---|---|
| `immutable` + sai filename → ảnh cũ mãi | Width trong tên file; đổi nội dung thì đổi tên |
| `_headers` không ship → fix vô hiệu | Bước 2 verify, và curl xác nhận trên môi trường thật |
| Cache sai khi swap ảnh qua admin | Ảnh admin upload dùng product `imageUrl` riêng, không nằm trong `/menu/aura-drinks/*` |

## Next steps

Phase 3 chốt độ an toàn bằng visual verify + budget test.
