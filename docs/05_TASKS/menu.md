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
- [ ] Images served in WebP format with JPEG fallback
- [ ] Responsive images: srcset for different screen sizes
- [ ] Lazy loading (loading="lazy") for offscreen images
- [ ] Cloudflare Images optimization enabled
- [ ] Average image size < 50KB

**Priority:** P2  
**Status:** ✅ Completed

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

### Task: Product variants (size, add-ons)

**Description:** Support product variations (e.g., size S/M/L, extra toppings) with price modifiers.

**Effort:** 16h  
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