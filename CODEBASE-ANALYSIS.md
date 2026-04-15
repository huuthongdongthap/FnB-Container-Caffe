# CODEBASE ANALYSIS — AURA SPACE (FnB Container Caffe)

> Generated: 2026-04-13 | Total source files: ~120 (excl. node_modules, images, coverage)

---

## 1. CẤU TRÚC THƯ MỤC

```
FnB-Container-Caffe/
├── index.html                  # Landing page chính
├── menu.html                   # Trang menu
├── checkout.html               # Giỏ hàng + thanh toán
├── track-order.html            # Theo dõi đơn hàng
├── table-reservation.html      # Đặt bàn
├── loyalty.html                # Chương trình loyalty
├── kds.html                    # Kitchen Display System
├── kitchen-display.html        # [DEPRECATED] KDS prototype
├── success.html / failure.html # Kết quả thanh toán
├── contact.html / about-us.html
├── layout-2d-4k.html           # Bản vẽ 2D container
├── layout-3d.html              # Visualization 3D
├── binh-phap-thi-cong.html     # Tài liệu thi công
├── project-brief.html          # Project brief
│
├── js/                         # Frontend JavaScript (25 files, ~7.5K LOC)
│   ├── main.js                 # DOMContentLoaded init, PWA register
│   ├── script.js               # Landing page orchestrator
│   ├── config.js               # API endpoints, payment config, cache TTLs
│   ├── api-client.js           # HTTP client → Worker API
│   ├── auth.js                 # Login/register/JWT
│   ├── cart.js                 # Cart (API-backed)
│   ├── cart-manager.js         # Cart (localStorage) ← TRÙNG LẶP
│   ├── menu.js                 # Menu rendering
│   ├── checkout.js             # Checkout flow
│   ├── payment-qr.js           # QR code payment
│   ├── loyalty.js              # Loyalty logic (tiers, points)
│   ├── loyalty-ui.js           # Loyalty UI renderer
│   ├── i18n.js                 # VI/EN translations
│   ├── track-order.js          # Order tracking
│   ├── reviews.js              # Customer reviews
│   ├── toast.js                # Toast notifications
│   ├── utils.js                # Utilities (format, debounce, fetch helpers)
│   ├── theme.js                # Dark/light toggle
│   ├── ui-animations.js        # Scroll/interaction animations
│   ├── ui-enhancements.js      # UI polish
│   ├── premium-ui.js           # Premium tier UI
│   ├── churn-prevention.js     # Churn prevention logic
│   ├── websocket-client.js     # WS client (polling fallback)
│   ├── kds-poll.js             # KDS polling mechanism
│   ├── sw.js                   # Service Worker (PWA)
│   ├── checkout/               # Checkout sub-modules
│   │   ├── cart-summary.js
│   │   ├── payment.js
│   │   └── qr-code.js
│   ├── kds/                    # KDS sub-modules
│   │   ├── kds-api.js          # Mock data generation
│   │   └── kds-render.js       # KDS kanban rendering
│   └── landing/                # Landing page modules
│       ├── form-validation.js
│       └── gallery.js
│
├── css/                        # Stylesheets (~8.9K LOC)
│   ├── styles.css              # Main stylesheet (2467 LOC)
│   ├── checkout-styles.css     # Checkout page
│   ├── kds-styles.css          # KDS base ← TRÙNG LẶP với kds-m3
│   ├── kds-m3.css              # KDS Material Design 3
│   ├── loyalty-styles.css      # Loyalty base ← TRÙNG LẶP với loyalty-m3
│   ├── loyalty-m3.css          # Loyalty Material Design 3
│   ├── ui-enhancements.css     # UI polish
│   ├── track-order-styles.css
│   ├── about-m3.css
│   ├── admin.css
│   ├── payment-modal.css
│   ├── premium-upgrade.css
│   └── print-receipt.css
│
├── worker/                     # Cloudflare Worker (Backend)
│   ├── src/
│   │   ├── index.js            # Route dispatcher (regex matching)
│   │   ├── middleware/
│   │   └── routes/
│   │       ├── auth.js         # Login/register/JWT
│   │       ├── categories.js   # Menu categories CRUD
│   │       ├── orders.js       # Order CRUD
│   │       ├── payment.js      # MoMo/PayOS/VNPay
│   │       └── ...
│   ├── wrangler.toml
│   └── package.json
│
├── admin/                      # Admin panel
│   ├── dashboard.html
│   ├── orders.html
│   ├── pos.html
│   └── admin-dashboard.js
│
├── dashboard/                  # Dashboard module
│   ├── dashboard.html
│   ├── dashboard-api.js
│   ├── dashboard-render.js
│   └── admin-dashboard.js
│
├── data/                       # Static data
│   ├── menu-data.json
│   ├── loyalty-config.json
│   └── orders.json
│
├── db/                         # Database
│   ├── schema.sql              # D1 (SQLite) schema
│   └── seed.sql                # Initial data
│
├── supabase/                   # Supabase config (optional)
├── designs/                    # Architecture docs, task specs, brand assets
├── plans/                      # Sprint plans
├── _archive/                   # Legacy code (properly documented)
├── tests/                      # Jest test suite
├── assets/                     # Brand assets, screenshots
├── public/                     # Static public files
├── scripts/                    # Build/deploy scripts
└── websocket-server.js         # Node.js WebSocket server (dev)
```

### Mục đích từng folder

| Folder | Mục đích |
|--------|----------|
| `js/` | Frontend logic: cart, auth, menu, checkout, loyalty, i18n, UI |
| `css/` | Stylesheets theo module (main, checkout, kds, loyalty, admin) |
| `worker/` | Cloudflare Worker backend — API routes, auth, payment gateways |
| `admin/` | Admin panel: quản lý orders, POS, dashboard |
| `dashboard/` | Dashboard analytics: KPI, revenue, top products |
| `data/` | Static JSON: menu items, loyalty config, sample orders |
| `db/` | D1 SQLite schema + seed data |
| `designs/` | Architecture docs, task specs, brand research |
| `plans/` | Sprint plans (260331-fix-refactor, 260401-12-pillars) |
| `_archive/` | Legacy monolith code (properly archived + documented) |
| `tests/` | Jest unit tests |
| `assets/` | Brand logos, screenshots |
| `public/` | Static public assets (images, icons) |
| `scripts/` | Deploy scripts (Cloudflare) |

---

## 2. TECH STACK

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES6 modules) + Vite bundler |
| Styling | Custom CSS + Material Design 3 tokens |
| Backend | Cloudflare Worker (Hono.js) |
| Database | Cloudflare D1 (SQLite) |
| Real-time | WebSocket (dev) / HTTP Polling (prod) |
| Payment | MoMo, PayOS, VNPay |
| PWA | Service Worker + manifest.json |
| Testing | Jest + jsdom |
| Linting | ESLint v9 (flat config) |
| CI/CD | GitHub Actions → Cloudflare Pages |

---

## 3. ENTRY POINTS

### HTML Pages (Customer-facing)
- `index.html` → Landing page (hero, menu preview, gallery, contact)
- `menu.html` → Menu browsing + add to cart
- `checkout.html` → Cart summary + payment
- `track-order.html` → Order status polling
- `table-reservation.html` → Table booking
- `loyalty.html` → Rewards program
- `success.html` / `failure.html` → Payment result pages
- `contact.html` / `about-us.html` → Info pages

### HTML Pages (Staff/Admin)
- `kds.html` → Kitchen Display System (kanban board)
- `admin/dashboard.html` → Admin panel
- `admin/orders.html` → Order management
- `admin/pos.html` → Point-of-sale

### Backend Entry
- `worker/src/index.js` → Cloudflare Worker route dispatcher

### API Routes

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/menu` | GET | Menu items |
| `/api/products` | GET | Products (filter: category, availability) |
| `/api/categories` | GET | Menu categories |
| `/api/tables` | GET | Table availability |
| `/api/orders` | POST | Create order |
| `/api/orders/:id` | GET/PATCH | Fetch/update order |
| `/api/admin/orders` | GET | All orders (admin) |
| `/api/stats` | GET | Sales KPIs |
| `/api/auth/*` | POST/GET | Login/register/logout |
| `/api/payment/*` | POST | Payment gateway |
| `/api/webhooks/*` | POST | Payment callbacks |

---

## 4. CODE TRÙNG LẶP & KHÔNG SỬ DỤNG

### 4.1 Trùng lặp — Cần hợp nhất

| Files | Vấn đề | Mức độ |
|-------|--------|--------|
| `js/cart.js` vs `js/cart-manager.js` | Cả 2 quản lý cart: cart.js (API-backed, 384 LOC) vs cart-manager.js (localStorage, 57 LOC). Trùng chức năng addToCart, removeFromCart, clearCart | **HIGH** |
| `css/kds-styles.css` vs `css/kds-m3.css` | Cả 2 load đồng thời trong kds.html. kds-styles (923 LOC) là base, kds-m3 (708 LOC) là M3 override → risk specificity conflict, CSS bloat | **HIGH** |
| `css/loyalty-styles.css` vs `css/loyalty-m3.css` | Tương tự KDS — cả 2 load trong loyalty.html. loyalty-m3 (593 LOC) lớn hơn loyalty-styles (369 LOC), có thể đã thay thế | **HIGH** |

### 4.2 Files deprecated / không sử dụng

| File | Lý do | Action |
|------|-------|--------|
| `kitchen-display.html` | Prototype cũ của KDS, inline JS, không modular. Đã thay bởi `kds.html` | **REMOVE** |
| `js/cart-manager.js` | Không referenced trong HTML nào. Trùng với cart.js | **REMOVE hoặc MERGE** |
| `test-reviews.html` | File test 1.6KB, không phải trang production | **REMOVE** |
| `lighthouse-report.html` | Report cũ 610KB, không cần trong repo | **REMOVE** |

### 4.3 Files cần audit import chain

Các file JS sau không có `<script src>` trực tiếp trong HTML nhưng có thể được import qua ES modules:
- `js/auth.js`, `js/menu.js`, `js/checkout.js`, `js/payment-qr.js`
- `js/reviews.js`, `js/churn-prevention.js`, `js/i18n.js`
- `js/config.js`, `js/utils.js`, `js/toast.js`, `js/main.js`

→ Cần verify import chain từ các entry module (script.js, kds-app.js, loyalty-ui.js).

### 4.4 Console.log trong production

| File | Lines | Issue |
|------|-------|-------|
| `js/kds-poll.js` | 50, 60, 71, 74 | 4x `console.log()` không có DEBUG guard |
| `js/auth.js` | 69, 107, 144, 177 | Có DEBUG guard ✓ (OK) |

---

## 5. ĐÁNH GIÁ CHẤT LƯỢNG CODE

### 5.1 Naming Conventions — ✅ Tốt

- **camelCase** cho variables/functions: `isLoggedIn`, `getProducts`, `formatPrice`
- **kebab-case** cho CSS classes: `.auth-modal-header`, `.menu-category`
- **SCREAMING_SNAKE** cho constants: `API_BASE`, `DEBUG`, `CART_KEY`
- Tên hàm descriptive: `fetchWithRetry()`, `renderMenuCategories()`, `initAddToCart()`

**Vấn đề nhỏ:** Prefix `_` cho private functions không nhất quán (menu.js dùng, checkout.js dùng, nhưng auth.js không dùng).

### 5.2 Architecture & Patterns — ⚠️ Trung bình

**Tốt:**
- `js/loyalty.js` (logic) tách biệt `js/loyalty-ui.js` (UI) → đúng pattern separation of concerns
- Worker backend dùng Hono.js routing → clean
- Archive có README.md document migration path → chuyên nghiệp
- ESLint config mạnh: `no-eval`, `no-var`, `prefer-const`

**Cần cải thiện:**
- Cart có 2 implementation song song (cart.js vs cart-manager.js)
- CSS có 2 layer (base + M3) load đồng thời gây specificity conflict
- Một số file lớn chưa tách module: `auth.js` (599 LOC), `loyalty-ui.js` (603 LOC)

### 5.3 Error Handling — ⚠️ Trung bình

**Tốt:**
- `api-client.js`: AbortController + timeout 30s
- `utils.js`: `fetchWithRetry()` với exponential backoff
- `auth.js`: try/catch + graceful fallback (logout tiếp tục dù server fail)

**Lỗi nghiêm trọng:**
- `utils.js` lines 126, 141, 153: **Syntax error** trong catch blocks — thiếu error parameter:
  ```javascript
  catch ) {  // ← INVALID SYNTAX — break module loading
    return defaultValue;
  }
  ```

### 5.4 Security — ❌ Nhiều vấn đề

| Vấn đề | Mức độ | Chi tiết |
|---------|--------|----------|
| **XSS via innerHTML** | CRITICAL | `menu.js`: category names, item descriptions inject trực tiếp qua innerHTML không escape |
| **XSS via toast** | CRITICAL | `menu.js` line 444: productName inject vào innerHTML |
| **Password hashing yếu** | CRITICAL | `worker/src/routes/auth.js`: SHA-256 không salt, không bcrypt |
| **Hardcoded API URLs** | HIGH | `checkout.js` line 54: `http://localhost:8000/api` — không dùng env var |
| **JWT trong localStorage** | HIGH | Vulnerable to XSS — nên dùng HttpOnly cookie |
| **Không có CSRF token** | HIGH | Tất cả POST/PATCH requests không có anti-CSRF |
| **WebSocket plaintext** | MEDIUM | `ws://localhost:8080` — không WSS cho production |
| **Discount codes hardcoded** | MEDIUM | `checkout.js`: valid codes nằm trong frontend JS |

### 5.5 Performance Patterns — ✅ Tốt

- Lazy loading images: `loading="lazy"` trong menu rendering
- Cache strategy: Menu 5 min, Orders 1 min, Stats 5 min
- Service Worker cho PWA offline
- Debounce/throttle utilities trong utils.js
- Vite bundler cho production build

---

## 6. TỔNG KẾT & ĐỀ XUẤT

### Điểm tổng: 6/10

| Tiêu chí | Điểm | Ghi chú |
|----------|-------|---------|
| Cấu trúc thư mục | 8/10 | Rõ ràng, có archive, plans, designs |
| Naming conventions | 8/10 | Nhất quán, descriptive |
| Modularity | 6/10 | Tốt ở loyalty, yếu ở cart/CSS |
| Error handling | 5/10 | Có pattern nhưng có syntax error trong utils.js |
| Security | 3/10 | Nhiều XSS, weak hashing, hardcoded URLs |
| Performance | 8/10 | Lazy load, caching, PWA, Vite |
| Code duplication | 5/10 | Cart, CSS layers cần consolidate |
| Documentation | 7/10 | Archive documented, CLAUDE.md tốt, thiếu JSDoc ở nhiều file |

### Action Items theo Priority

**P0 — Fix ngay:**
1. Fix syntax error `utils.js` lines 126, 141, 153 (catch blocks)
2. Fix XSS trong `menu.js` — escape tất cả user input trước innerHTML
3. Thay SHA-256 bằng bcrypt + salt trong `worker/src/routes/auth.js`
4. Thay hardcoded API URLs bằng config.js / env variables

**P1 — Sprint tiếp theo:**
5. Merge `cart.js` + `cart-manager.js` → single CartManager (API primary, localStorage fallback)
6. Consolidate CSS: chọn 1 giữa base styles và M3 cho KDS + Loyalty
7. Thêm CSRF tokens cho tất cả mutating requests
8. Chuyển JWT từ localStorage → HttpOnly cookie

**P2 — Tech debt:**
9. Remove `kitchen-display.html`, `test-reviews.html`, `lighthouse-report.html`
10. Remove `console.log` trong `kds-poll.js` hoặc wrap bằng DEBUG flag
11. Audit import chain để xác nhận dead code
12. Tách `auth.js` (599 LOC) và `loyalty-ui.js` (603 LOC) thành sub-modules

---

*Report generated by codebase analysis — 2026-04-13*
