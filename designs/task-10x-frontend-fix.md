# AURA SPACE — 10X Frontend Fix

## Batch 1: Critical Blockers

### Fix 1: Order modal PHẢI KHÔNG tự mở
Trong `js/script.js` và `js/script.min.js`, tìm code khởi tạo `orderModal`. Đảm bảo modal có `display: none` mặc định. Modal chỉ mở khi user click nút "Đặt Hàng". Nếu có `orderModal.style.display = 'flex'` hoặc `orderModal.classList.add('active')` trong DOMContentLoaded, XÓA nó.

### Fix 2: Navbar không wrap/overlap
Trong `css/styles.css`, fix `.m3-top-app-bar`:
- Thêm `flex-wrap: nowrap` cho nav container
- Giảm gap: `gap: clamp(0.5rem, 2vw, 1.5rem)` cho `.nav-desktop`
- Logo: `flex-shrink: 0`
- Nav links: `white-space: nowrap; font-size: clamp(0.75rem, 1.2vw, 0.875rem)`

### Fix 3: Heading "Từ Sa Đéc Với Yêu Thương" bị blur
Trong `css/styles.css`, tìm class `.gradient-text` hoặc `.section-title` trong about section. Xóa mọi `filter: blur()` hoặc `text-shadow` quá mức. Giữ lại gradient nhưng phải SẮC NÉT, đọc được.

### Fix 4: premium-upgrade.css — progressive enhancement
Trong `css/premium-upgrade.css`, thay `.reveal { opacity: 0; }` thành `.reveal:not(.visible) { opacity: 0; }` và thêm fallback: nếu JS không chạy, content vẫn hiển thị.

## Batch 2: Branding & Assets  

### Fix 5: Xóa ảnh VIBE CODING
Trong `index.html`, tìm section "Không Gian" (space section). Thay thế hình ảnh có "VIBE CODING" bằng hình ảnh khác từ folder `images/` hoặc dùng hình khác từ section about (container café thực tế). KHÔNG được có branding "VIBE CODING" trên trang AURA SPACE.

### Fix 6: Thay emoji bằng Material Symbols
Thay các emoji icon trong feature cards:
- ☕ → `<span class="material-symbols-outlined">coffee</span>`
- 🌿 → `<span class="material-symbols-outlined">eco</span>`  
- 🐵 → `<span class="material-symbols-outlined">rooftop_deck</span>`
Thêm Material Symbols CDN nếu chưa có:
`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined">`

### Fix 7: "2026 Established" wrap trong container
Bọc text "2026 Established" trong một div `.stat-badge`:
```css
.stat-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; background: var(--md-sys-color-surface-container); border-radius: 99px; font-size: 0.875rem; }
```

### Fix 8: Cập nhật phone
Thay `0xxx.xxx.xxx` thành `Sắp khai trương` hoặc số thực.

## Batch 3: UX Polish

### Fix 9: Footer contrast
Dark mode footer: text color thay thành `rgba(255,255,255,0.7)` tối thiểu.
Light mode footer: text color `#49454F` trên background sáng.

### Fix 10: Contact form alignment
Sửa form layout thành:
```css
.contact-form { display: flex; flex-direction: column; gap: 16px; }
.contact-form label { text-align: left; font-weight: 500; }
.contact-form input, .contact-form textarea { width: 100%; padding: 12px 16px; border-radius: 8px; }
```

### Fix 11: Đảm bảo hero hiển thị
Hero section phải visible ngay khi vào trang:
- z-index hero > modal backdrop nếu modal auto-open
- Hoặc đơn giản: FIX modal không auto-open (Fix 1)

## Batch 4: Test
```bash
npx serve . -l 3000
# Mở localhost:3000 kiểm tra:
# ✅ Hero visible đầu tiên
# ✅ Navbar không overlap
# ✅ About heading sắc nét
# ✅ Không có VIBE CODING
# ✅ Footer đọc được
```

## Design Tokens (tham khảo)
- Dark bg: #0A0A0A
- Gold: #C9A962
- Fonts: Cormorant Garamond (display), Space Grotesk (title), Inter (body)
- Glass: rgba(10,10,10,0.6) + blur(16px)
