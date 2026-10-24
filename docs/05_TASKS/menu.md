---
date: 2025-06-19
domain: menu
status: stable
priority: P1
---

# TASKS — MENU MANAGEMENT

## Epic: Menu CRUD Operations

**Description:** Full menu management for admin staff.

### Story 1: Category management

**Acceptance Criteria:**
- [ ] Admin can create, read, update, delete categories
- [ ] Category has: name, description, display order, is_active flag
- [ ] Categories sorted by `display_order` ascending
- [ ] Inactive categories hidden from customer menu
- [ ] Category deletion blocked if products assigned (soft delete via is_active)

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 2: Product management

**Acceptance Criteria:**
- [ ] Admin can create, read, update, delete products
- [ ] Product fields: name, description, price (VND), image_url, category_id, is_available, display_order
- [ ] Price stored as integer (VND) to avoid float precision
- [ ] Image upload to Cloudflare R2 or external CDN
- [ ] Out-of-stock flag (optional) — customer cannot order
- [ ] Product variants (size, customization) supported via JSON modifiers

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 3: Menu display to customers

**Acceptance Criteria:**
- [ ] `GET /api/menu` returns all available products grouped by category
- [ ] Supports filtering: `?category=, available=1, search=keyword`
- [ ] Cache response in browser for 5 minutes (stale-while-revalidate)
- [ ] Images lazy-loaded with placeholder
- [ ] Responsive grid layout (mobile: 1 col, desktop: 3-4 cols)
- [ ] Product card shows: name, price, image, availability badge

**Priority:** P1  
**Status:** ✅ Completed

---

## Epic: Menu Presentation

### Story 4: Menu page with filtering

**Acceptance Criteria:**
- [ ] `/menu.html` loads categories as filter tabs
- [ ] Clicking category filters product grid via API
- [ ] Search bar performs client-side filtering on loaded data
- [ ] Empty state shows if no products match
- [ ] Loading skeleton shown during API fetch
- [ ] Infinite scroll or pagination (if >50 products)

**Priority:** P1  
**Status:** ✅ Completed

---

### Story 5: Menu image optimization

**Acceptance Criteria:**
- [x] Images served in AVIF with WebP fallback
- [x] Responsive images: srcset for different screen sizes
- [x] Lazy loading (loading="lazy") for offscreen images
- [x] Immutable cache headers on the image directory
- [ ] Cloudflare Images optimization enabled — off by choice, `_headers` + git instead

**Priority:** P2
**Status:** ✅ Completed

**Budget (2026-10-24):**

Chuẩn per-file "< 50KB" được viết trước khi có ảnh thật và không nêu width, nên
không thể pass/fail được. Thay bằng chuẩn theo đúng width mà card dùng:

| Width | Mục đích | Budget | Đo thực tế (max) |
|---|---|---|---|
| 400 px | card 1x | 40 KB | 25 KB |
| 800 px | card retina 2x | 90 KB | 73 KB |
| 1200 px | ceiling cho viewport lớn | 160 KB | 147 KB |

Card ≈ 293 px (`grid-cols-4` trong `max-w-7xl px-6`), nên width 1200 không bao giờ
được request ở breakpoint nào — nó chỉ tồn tại làm trần.

Metric quan trọng nhất là **tổng payload toàn trang**, không phải per-file: một
file 140 KB ở 1200 px vô hại nếu browser không tải nó; 49 file 25 KB mới là cái
người dùng chịu. Toàn bộ menu trong first paint (~49 ảnh ở width 400, AVIF) =
**0.52 MiB**, so với 6.10 MiB nếu vẫn dùng ảnh gốc 1200 px.

Guard: `src/lib/__tests__/menu-image-budget.test.ts` walk directory thật và fail
nếu bất kỳ file nào vượt ngưỡng theo width đọc ra từ tên file.

Debt đang mở (biết, có chủ đích): `pepsi.webp` (191 px) và `red-bull.webp`
(260 px) là ảnh nguồn nhỏ hơn variant 400 px, nên card sẽ hơi mờ dù nén tốt —
cần ảnh gốc lớn hơn, không phải nén lại. Test
`keeps every master at least as wide as the variant it feeds` đang đỏ vì đúng
2 file này.

---

### Story 6: Menu SEO

**Acceptance Criteria:**
- [ ] Each product has unique slug for SEO URL: `/menu/[category]/[product]`
- [ ] Open Graph meta tags for menu page (og:title, og:image)
- [ ] Structured data (JSON-LD) for menu items (Recipe schema)
- [ ] Sitemap includes menu URLs

**Priority:** P3  
**Status:** ⚠️ Partial (category slugs exist, product slugs not implemented)

---

## Future Tasks (Backlog)

### Task: Priced product variants (size, add-ons)

**Description:** Support product variations with price modifiers (e.g., size S/M/L, thêm topping).

Đã thử và gỡ bỏ: modal từng hiện size L (+5.000₫) và topping (+5.000đ/+8.000đ), nhưng
server-authoritative pricing (`resolveServerProductPrice`) bỏ qua giá client khi product row
đã tồn tại trong DB — khách thấy 34.000₫, server thu 29.000₫; gửi modifier id không có trong
`modifier_choices` thì bị HTTP 400, không có fallback mềm. Nên lần này đã bỏ hoàn toàn size
và topping khỏi modal để giá hiển thị = giá thu.

Nếu làm lại, cần đồng bộ cả 3: (1) seed `modifier_groups` + `modifier_choices` cho từng món,
(2) checkout gửi `modifiers: string[]` thay vì nhúng chuỗi vào `notes`, (3) pricing-resolver
đọc được modifier đã chọn. Rule layer (`src/lib/menu-option-rules.ts`) đã tách sẵn nên chỉ
cần thêm nhóm option mới.

**Progress (2026-10-23):**
- (3) pricing-resolver đã đọc được modifier từ trước — `pricing-resolver.ts` tính
  `modifierDelta` và `order-snapshot.ts` lưu snapshot. Phần này không cần làm lại.
- (1) Đã có UI admin để tạo dữ liệu (tab "Tùy chọn" trong `/admin/menu`) thay vì seed SQL:
  CRUD API `/api/menu-modifiers` đã có và được `staffAuth` bảo vệ, nên seeding bằng SQL sẽ
  tạo thêm một đường ghi không qua phân quyền. **Chưa seed** — cần quyết định thương mại
  (món nào có size, phụ thí hay đổi giá gốc, giá topping, size và topping có cộng dồn được
  không). Còn một lỗ hổng: chưa có sẵn PATCH/DELETE cho `modifier_choices`, nên sửa sai giá
  hiện phải ghi trực tiếp DB.
- (2) Chưa làm. Lưu ý bẫy id: `menu.tsx` nối suffix vào product id và `use-cart-store.ts`
  đọc ngược lại, nên nếu modifier đổi sang object phải bỏ cơ chế suffix đó chứ không patch.

**Remaining effort:** ~12h (link editor + checkout gửi modifiers + test end-to-end)
**Priority:** P2

---

### Task: Combo meals

**Description:** Create bundled products (e.g., breakfast set) with fixed price for multiple items.

**Effort:** 12h  
**Priority:** P2

---

### Task: Inventory tracking

**Description:** Track ingredient stock levels, auto-hide products when ingredients run out.

**Effort:** 24h  
**Priority:** P3 (requires integration with Odoo Inventory)

---

### Task: Menu scheduling

**Description:** Time-based menu availability (e.g., breakfast menu 6-11am, lunch 11am-2pm).

**Effort:** 8h  
**Priority:** P3

---

### Task: QR code menu

**Description:** Generate unique QR codes per table that link to digital menu with table number embedded.

**Effort:** 8h  
**Priority:** P2

---

### Task: Menu analytics

**Description:** Track most-viewed products, time spent on menu, conversion rate per item.

**Effort:** 16h  
**Priority:** P3

---

*Related files:*
- `worker/src/routes/categories.js`
- `worker/src/routes/products.js`
- `worker/src/routes/menu.js`
- `db/schema.sql` (categories, products tables)
- `js/menu.js`
- `menu.html`
MENUS_EOF

echo "Created: docs/05_TASKS/menu.md"