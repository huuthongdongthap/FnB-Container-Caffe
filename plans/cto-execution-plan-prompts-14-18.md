# ⚔️ AURA SPACE — CTO Execution Plan (Qwen 3.6 Plus Workers)

> **Date:** 2026-04-15 | **Target Repo:** `~/mekong-cli/FnB-Container-Caffe`
> **Model:** Qwen 3.6 Plus via Claude Code CLI
> **Execution Protocol:** Tuân thủ `CLAUDE.md` (Zero chatbot, chunk-edit only, 2-strikes rule)

---

## Hướng Dẫn Điều Phối Cho CTO

### Cách giao việc
Mỗi **Task** dưới đây là **1 lần chạy Worker** (1 prompt paste vào Claude Code CLI). Mỗi task được thiết kế:
- **Atomic:** Chỉ đụng 1-3 file, scope cực nhỏ
- **Self-contained:** Worker đọc context cần thiết ngay trong prompt
- **Verifiable:** Có tiêu chí kiểm tra rõ ràng sau khi Worker chạy xong

### Quy trình
```
CTO paste Task → Worker chạy → CTO verify output → ✅ Next Task / ❌ Fix & Retry
```

### Lưu ý đặc biệt
- `shared-nav.js` (12KB) đã tồn tại → Task 1.x là **audit + update**, không tạo mới
- Worker routes hiện có: `auth, categories, cron, menu, orders, orders-hono, payment, products, tables, webhooks`
- Middleware: `cors.js` — tất cả routes mới phải đi qua CORS middleware này
- D1 binding, framework pattern: đọc từ `worker/src/index.js` + `worker/wrangler.toml`

---

## PHASE 1: UNIFIED NAVIGATION (Prompt #14)
**Branch:** `feat/unified-navigation`
**Commit:** `feat: unify navbar & footer across all customer pages`

### Task 1.1 — Audit shared-nav.js hiện tại
```
Mở file `js/shared-nav.js`. Đọc code hiện có.
Tạo report ngắn (in ra terminal) liệt kê:
1. Function nào đã export (initNavbar? initFooter?)
2. Navigation links hiện có (liệt kê label + URL)
3. Footer links hiện có
4. Mobile drawer có chưa?
5. Scroll effect (transparent → solid) có chưa?
6. So sánh với bảng links cần có dưới đây, đánh dấu THIẾU/THỪA:

NAVBAR LINKS CẦN CÓ:
| Label | URL |
|-------|-----|
| Trang Chủ | index.html |
| Menu | menu.html |
| Không Gian | index.html#spaces |
| Đặt Bàn | table-reservation.html |
| Loyalty | loyalty.html |
| Liên Hệ | contact.html |
| CTA "Đặt Bàn" | table-reservation.html |

MOBILE DRAWER bổ sung: Track Order (track-order.html), About (about-us.html)

FOOTER CẦN CÓ:
| Column | Links |
|--------|-------|
| Khám Phá | Menu, Không Gian, Đặt Bàn |
| Thành Viên | Loyalty + Cashback, Theo Dõi Đơn |
| Hỗ Trợ | Liên Hệ, About |
| Admin | Admin Dashboard, KDS |
Bottom: "© 2026 AURA SPACE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0"

KHÔNG SỬA GÌ. Chỉ báo cáo.
```

### Task 1.2 — Update shared-nav.js: Navbar links + Active state
```
File: `js/shared-nav.js`
Đọc file hiện có. CHỈ SỬA phần navbar links:
1. Đảm bảo ĐẦY ĐỦ links theo bảng ở Task 1.1
2. Thêm link "Loyalty" (loyalty.html) nếu chưa có
3. Active page: thêm class `.nav-active` vào link tương ứng (gold color + underline)
4. Mobile drawer: đảm bảo có Track Order + About links

RULES:
- KHÔNG viết lại toàn bộ file. Chỉ edit chunk cần sửa.
- Giữ nguyên CSS variables hiện có
- Hamburger menu phải hoạt động
- Scroll effect (transparent → solid) phải hoạt động
```

### Task 1.3 — Update shared-nav.js: Footer
```
File: `js/shared-nav.js`
Đọc function `initFooter()` hiện có. Update footer links theo bảng:
| Column | Links |
|--------|-------|
| Khám Phá | Menu, Không Gian, Đặt Bàn |
| Thành Viên | Loyalty + Cashback, Theo Dõi Đơn |
| Hỗ Trợ | Liên Hệ, About |
| Admin | Admin Dashboard, KDS |
Bottom: "© 2026 AURA SPACE · Sa Đéc, Đồng Tháp · fnbcontainer.vn v2.1.0"

KHÔNG viết lại toàn bộ. Chỉ sửa phần footer HTML string.
```

### Task 1.4 — Inject shared-nav vào index.html + menu.html
```
Files: `index.html`, `menu.html`
Với mỗi file:
1. Tìm navbar HTML cũ (thường nằm trong <header> hoặc <nav>) → XÓA
2. Tìm footer HTML cũ → XÓA
3. Thêm `<div id="shared-navbar"></div>` ở đầu body
4. Thêm `<div id="shared-footer"></div>` trước </body>
5. Thêm script import:
   <script type="module">
     import { initNavbar, initFooter } from './js/shared-nav.js';
     initNavbar('home'); // hoặc 'menu' cho menu.html
     initFooter();
   </script>

RULES: KHÔNG xóa inline <style>. KHÔNG thay đổi content. Chỉ thay navbar/footer.
```

### Task 1.5 — Inject shared-nav vào checkout.html + table-reservation.html
```
Tương tự Task 1.4 cho:
- `checkout.html` → activePage='checkout'
- `table-reservation.html` → activePage='reservation'

CÙNG RULES: chỉ thay navbar/footer, giữ nguyên mọi thứ khác.
```

### Task 1.6 — Inject shared-nav vào contact + loyalty + track-order + about-us
```
Tương tự Task 1.4 cho:
- `contact.html` → activePage='contact'
- `loyalty.html` → activePage='loyalty'
- `track-order.html` → activePage='track'
- `about-us.html` → activePage='about'
```

### Task 1.7 — Inject minimal navbar vào success.html + failure.html
```
Files: `success.html`, `failure.html`
Navbar minimal: chỉ logo AURA SPACE + link "← Về Trang Chủ" (index.html)
Không cần full navbar. Không cần footer.

Thay navbar cũ (nếu có) bằng minimal version.
```

### ✅ Verify Phase 1
```
CTO kiểm tra:
1. Mở index.html trong browser → navbar đầy đủ links, scroll effect hoạt động
2. Click qua từng page → active link highlight đúng (gold + underline)
3. Mobile view (390px) → hamburger menu mở drawer với đủ links
4. Footer đồng nhất trên tất cả customer pages
5. kds.html, admin/ → KHÔNG bị thay đổi
```

---

## PHASE 2: PAGE LINKING AUDIT (Prompt #15)
**Branch:** `fix/page-linking`
**Commit:** `fix: audit and repair all internal page links + user flow`

### Task 2.1 — Audit tất cả links trong index.html + menu.html
```
Đọc `index.html` và `menu.html`.
Tìm TẤT CẢ `<a href="...">` và `<button onclick="...">`.
In ra terminal báo cáo format:

FILE: index.html
[OK] "Đặt Bàn Ngay" → table-reservation.html (exists ✅)
[OK] "Khám Phá Menu" → menu.html (exists ✅)
[BROKEN] "Xem Toàn Bộ Menu" → menu-full.html (NOT FOUND ❌) → FIX: menu.html
[MISSING] Không có link tới loyalty.html ← CẦN THÊM

Tương tự cho menu.html.
KHÔNG SỬA GÌ. Chỉ báo cáo.
```

### Task 2.2 — Audit links trong checkout + success + failure
```
Tương tự Task 2.1 cho:
- `checkout.html` — kiểm tra "← Quay lại Menu" → menu.html
- `success.html` — kiểm tra "Về Trang Chủ", "Xem Hoá Đơn" (receipt-template.html?id=), "Theo Dõi Đơn" (track-order.html?id=)
- `failure.html` — kiểm tra "Thử Lại Ngay" → checkout.html, "Gọi hỗ trợ" → tel:0909123456
KHÔNG SỬA GÌ.
```

### Task 2.3 — Audit links trong remaining pages
```
Audit cho: table-reservation.html, contact.html, loyalty.html, track-order.html, about-us.html
Kiểm tra theo user flow map:
- table-reservation: có link về index.html? có link tới menu.html?
- contact: Google Maps link đúng? Social links có target="_blank"?
- loyalty: có link tới menu.html?coupon={code}? có link tới table-reservation.html?priority=gold?
- track-order: đọc ?id= từ URL? có link "Đặt Lại" → menu.html?
- about-us: có link tới menu.html và table-reservation.html?
KHÔNG SỬA GÌ. Chỉ báo cáo.
```

### Task 2.4 — Fix all broken/missing links (batch 1: index + menu + checkout)
```
Dựa trên report từ Task 2.1-2.3, SỬA tất cả links trong:
- `index.html` — fix broken hrefs, thêm missing links
- `menu.html` — fix broken hrefs
- `checkout.html` — fix "← Quay lại Menu" nếu sai

RULES:
- CHỈ sửa href attributes
- KHÔNG thay đổi text content, layout, style
- External links: thêm target="_blank" rel="noopener noreferrer"
- Tel links: href="tel:0909123456"
```

### Task 2.5 — Fix all broken/missing links (batch 2: success + failure + remaining)
```
SỬA links trong: success.html, failure.html, table-reservation.html, contact.html, loyalty.html, track-order.html, about-us.html
Đảm bảo:
- success.html có link "Theo Dõi Đơn" → track-order.html?id={orderId}
- failure.html có "Thử Lại" → checkout.html (giữ cart), "Gọi hỗ trợ" → tel:0909123456
- External links có target="_blank" rel="noopener noreferrer"
```

### Task 2.6 — Verify Cart data persistence (menu → checkout)
```
Đọc `js/cart.js` (10KB).
Kiểm tra:
1. Cart data lưu ở đâu? (localStorage / sessionStorage / API)
2. Khi navigate từ menu.html → checkout.html, data có persist không?
3. Khi failure.html → checkout.html ("Thử Lại"), cart data còn không?

Nếu có vấn đề → fix. Nếu OK → báo cáo "Cart persistence OK".
KHÔNG thay đổi logic, chỉ fix nếu data bị mất khi navigate.
```

### Task 2.7 — Update sitemap.xml
```
File: `sitemap.xml`
Đọc file hiện có. Thêm các pages còn thiếu:
- loyalty.html
- track-order.html
- about-us.html
- contact.html (nếu chưa có)
Giữ format XML chuẩn. lastmod = 2026-04-15.
```

### ✅ Verify Phase 2
```
CTO kiểm tra:
1. Click qua User Flow: index → menu → checkout → success → track-order
2. Click: index → table-reservation → confirmation
3. Click: index → loyalty → menu?coupon=X
4. Tất cả external links mở tab mới
5. Không có 404 nào khi click internal links
```

---

## PHASE 3: API AUDIT & CLIENT (Prompt #16)
**Branch:** `feat/api-integration-audit`
**Commit:** `feat: audit API connections + update api-client.js`

### Task 3.1 — Audit Worker routes hiện có
```
ĐỌC tất cả files trong `worker/src/routes/`:
- auth.js, categories.js, cron.js, menu.js, orders.js, orders-hono.js, payment.js, products.js, tables.js, webhooks.js

ĐỌC `worker/src/index.js` để hiểu route dispatcher pattern.
ĐỌC `worker/wrangler.toml` để xác định D1 binding name.

Tạo file report: `docs/api-audit.md`
Format:
## Worker Routes Hiện Có
| Route File | Endpoints | Method | D1 Tables Used |
|-----------|-----------|--------|----------------|
| menu.js | /api/menu | GET | products, categories |
| ... | ... | ... | ... |

KHÔNG SỬA GÌ. Chỉ tạo report.
```

### Task 3.2 — Audit Frontend API calls
```
ĐỌC các files sau và liệt kê TẤT CẢ API calls (fetch/XMLHttpRequest):
- `js/api-client.js` (4KB)
- `js/config.js` (2KB)
- `js/checkout.js` (12KB)
- `js/menu.js` (13KB)
- `js/loyalty.js` (11KB)
- `js/kds-app.js` (15KB)
- `js/kds-poll.js` (2KB)
- `js/track-order.js` (9KB)
- `js/auth.js` (16KB)
- `js/cart.js` (10KB)
- `websocket-server.js` (8KB)

THÊM vào `docs/api-audit.md`:
## Frontend API Calls
| JS File | Endpoint Called | Method | Worker Route Exists? |
|---------|---------------|--------|---------------------|
| menu.js | /api/menu | GET | ✅ Yes |
| loyalty.js | /api/loyalty/member | GET | ❌ No — CẦN TẠO |
| ... | ... | ... | ... |

## Gap Analysis
### Frontend gọi nhưng Worker chưa có ⚠️
### Worker có nhưng Frontend chưa dùng 📦
### Endpoints mới cần tạo 🆕
```

### Task 3.3 — Update api-client.js: Menu + Orders + Tables
```
File: `js/api-client.js`
Đọc code hiện có. THÊM (không xóa code cũ) các method sau nếu chưa có:

// MENU
getMenu(category?)  → GET /api/menu?category=X
getMenuItem(id)     → GET /api/menu/:id

// ORDERS
createOrder(data)   → POST /api/orders
getOrder(id)        → GET /api/orders/:id
updateOrderStatus(id, status) → PUT /api/orders/:id/status
getOrdersByStatus(status)     → GET /api/orders?status=X

// TABLES
getTables(zone?)    → GET /api/tables?zone=X
updateTableStatus(id, status) → PUT /api/tables/:id/status

Follow existing code pattern. Giữ nguyên base URL config từ config.js.
```

### Task 3.4 — Update api-client.js: Reservations + Payments + Contact
```
File: `js/api-client.js`
THÊM methods:

// RESERVATIONS
createReservation(data)      → POST /api/reservations
checkAvailability(date)      → GET /api/reservations?date=X

// PAYMENTS
createPayment(data)          → POST /api/payments
updatePaymentStatus(id, st)  → PUT /api/payments/:id/status

// CONTACT
submitContact(data)          → POST /api/contact

// REVIEWS
getReviews(limit?, rating?)  → GET /api/reviews?limit=X&rating=Y
submitReview(data)           → POST /api/reviews
```

### Task 3.5 — Update api-client.js: Loyalty endpoints
```
File: `js/api-client.js`
THÊM methods cho Loyalty (endpoints sẽ được tạo ở Phase 4):

// LOYALTY
getMember(phone)              → GET /api/loyalty/member/:phone
registerMember(data)          → POST /api/loyalty/register
getWallet(userId)             → GET /api/loyalty/wallet/:userId
getTransactions(userId, opts) → GET /api/loyalty/transactions/:userId?type=X&limit=Y
getPointsHistory(userId)      → GET /api/loyalty/points/:userId
processCashback(orderId, uid) → POST /api/loyalty/process-cashback
spendCashback(data)           → POST /api/loyalty/spend-cashback
getRewards(userId)            → GET /api/loyalty/rewards/:userId
redeemReward(userId, rid)     → POST /api/loyalty/redeem
getTiers()                    → GET /api/loyalty/tiers
```

### ✅ Verify Phase 3
```
CTO kiểm tra:
1. Đọc `docs/api-audit.md` — đầy đủ, ánh xạ rõ ràng
2. Đọc `js/api-client.js` — tất cả methods có đúng endpoint, đúng HTTP method
3. Không có syntax error (chạy: node -c js/api-client.js)
```

---

## PHASE 4: WORKER API ROUTES MỚI (Prompt #17)
**Branch:** `feat/loyalty-worker-routes`
**Commit:** `feat: add loyalty, cashback, reviews, contact API routes to Worker`

### Task 4.1 — Đọc Worker pattern + Tạo D1 schema mới
```
BƯỚC 1: Đọc `worker/src/index.js` — ghi nhận framework (Hono? itty-router? raw fetch?), cách khai báo route, cách trả response.
BƯỚC 2: Đọc `worker/src/routes/menu.js` — ghi nhận pattern: route handler → D1 query → JSON response.
BƯỚC 3: Đọc `worker/wrangler.toml` — ghi nhận D1 binding name.

BƯỚC 4: CẬP NHẬT `worker/schema.sql` — THÊM (nếu chưa có):

CREATE TABLE IF NOT EXISTS contact_messages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    category TEXT,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'unread',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    customer_name TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    content TEXT NOT NULL,
    tags TEXT DEFAULT '[]',
    status TEXT DEFAULT 'published',
    created_at TEXT DEFAULT (datetime('now'))
);

KHÔNG đụng tables existing.
```

### Task 4.2 — Tạo route: Reviews + Contact
```
Tạo file `worker/src/routes/reviews.js`:
- GET /api/reviews?limit=10&offset=0&rating=5
  → D1 query reviews table, filter rating if provided
  → Return { success: true, reviews: [...], average_rating, total_count }
- POST /api/reviews
  → Validate: customer_name required, rating 1-5, content min 10 chars
  → Insert with crypto.randomUUID()
  → Return { success: true, review_id }

Tạo file `worker/src/routes/contact.js`:
- POST /api/contact
  → Validate: name, content required
  → Insert into contact_messages
  → Return { success: true, message_id }

Follow EXACT pattern từ menu.js / orders.js. CORS middleware phải được áp dụng.
Register routes trong `worker/src/index.js`.
```

### Task 4.3 — Tạo route: Loyalty (read-only endpoints)
```
Tạo file `worker/src/routes/loyalty.js`:

GET /api/loyalty/member/:phone
  → Query users + loyalty_tiers + cashback_wallets WHERE phone = :phone
  → Return member profile + tier + wallet balance
  → 404 if not found

GET /api/loyalty/wallet/:userId
  → Query cashback_wallets WHERE user_id = :userId
  → Return { balance, total_earned, total_spent }

GET /api/loyalty/transactions/:userId?type=earn|spend|all&limit=20
  → Query cashback_transactions, filter by type, ORDER BY created_at DESC
  → Return { transactions: [...], total: count }

GET /api/loyalty/points/:userId?limit=20
  → Query loyalty_point_logs WHERE user_id = :userId
  → Return { points_logs: [...], total_points: X }

GET /api/loyalty/tiers
  → Query loyalty_tiers ORDER BY min_points ASC
  → Return { tiers: [...] }

GET /api/loyalty/rewards/:userId
  → Query user_rewards JOIN rewards
  → Return { active: [...], used: [...], expired: [...] }

Register routes trong index.js.
```

### Task 4.4 — Tạo route: Loyalty (write endpoints)
```
File: `worker/src/routes/loyalty.js` (thêm vào file từ Task 4.3)

POST /api/loyalty/register
  → Body: { phone, full_name, email? }
  → Insert users + auto-create cashback_wallets (balance: 0)
  → 409 if phone exists
  → Return { success, member, wallet }

POST /api/loyalty/process-cashback
  → Body: { order_id, user_id }
  → Logic trong JS (D1 không có PL/pgSQL):
    1. Lấy order total
    2. Lấy user tier → cashback rate
    3. Tính cashback = total * rate
    4. UPDATE cashback_wallets SET balance = balance + cashback
    5. INSERT cashback_transactions
  → Return { cashback_earned, points_earned, new_balance, tier }

POST /api/loyalty/spend-cashback
  → Body: { user_id, order_id, amount }
  → Check balance >= amount, check max 50% order total
  → UPDATE wallet, INSERT transaction
  → Return { success, amount_spent, new_balance }

POST /api/loyalty/redeem
  → Body: { user_id, reward_id }
  → Check points, deduct, generate code, create user_reward
  → Return { success, code, reward_details }
```

### Task 4.5 — Update seed.sql
```
File: `worker/seed.sql`
THÊM (không xóa data cũ):
- 10 sample reviews (rating 3-5, nội dung tiếng Việt: "Không gian tuyệt vời!", "Cà phê ngon, view đẹp"...)
- 3 loyalty tier definitions (Silver: 0pts/2%, Gold: 500pts/5%, Platinum: 2000pts/10%)
- 5 reward definitions (Giảm 10% đơn hàng, Free size up, Mua 1 tặng 1...)
```

### ✅ Verify Phase 4
```
CTO kiểm tra:
1. cd worker && npx wrangler dev --local (chạy Worker local)
2. curl http://localhost:8787/api/reviews → trả data
3. curl -X POST http://localhost:8787/api/contact -d '{"name":"Test","content":"Hello"}' → success
4. curl http://localhost:8787/api/loyalty/tiers → trả tier list
5. Không có syntax error khi Worker khởi động
```

---

## PHASE 5: BACKEND PROPOSALS + P0/P1 FEATURES (Prompt #18)
**Branch:** `feat/backend-enhancements`
**Commit:** `feat: implement P0+P1 backend features + create proposals doc`

### Task 5.1 — Tạo docs/backend-proposals.md
```
ĐỌC toàn bộ:
- worker/src/routes/ (10 files)
- js/ (23 files)
- supabase/schema.sql
- db/schema.sql
- websocket-server.js

Tạo file `docs/backend-proposals.md`:
## Đã có ✅ (liệt kê features backend đang hoạt động)
## Đang thiếu & Cần thiết 🔴 (frontend ĐÃ CÓ UI nhưng backend chưa support)
## Đề xuất mới 🆕 (chưa có cả frontend lẫn backend)
## Roadmap ưu tiên (P0/P1/P2)

P2 chỉ ĐỀ XUẤT, không implement:
- Analytics Aggregation (Cron Trigger)
- Inventory Tracking
- QR Code Ordering
- Export/Report
```

### Task 5.2 — P0: Verify Order Flow End-to-End
```
ĐỌC:
- `js/checkout.js` — xem gọi API nào khi submit order
- `worker/src/routes/orders.js` — xem handler create order
- `success.html` — xem có đọc order_id từ response không

Kiểm tra flow: checkout submit → Worker tạo order (D1) → trả order_id → redirect success.html?id={orderId}

Nếu có gap → FIX, ghi comment "// FIX: P0 order flow"
Nếu OK → báo cáo "Order flow E2E: OK"
```

### Task 5.3 — P0: Verify KDS Real-time Integration
```
ĐỌC:
- `js/kds-app.js` — xem cách nhận order mới
- `js/kds-poll.js` — polling mechanism
- `websocket-server.js` — WS message format
- `js/websocket-client.js` — client WS handler

Kiểm tra: Khi Worker tạo order mới → có push event tới KDS không?
WebSocket message format có match giữa server và client không?

Nếu có gap → FIX (thêm WS emit trong order creation route)
Nếu OK → báo cáo "KDS real-time: OK"
```

### Task 5.4 — P0: Table Status Sync
```
ĐỌC:
- `worker/src/routes/tables.js` — xem update status handler
- `table-reservation.html` — xem cách render table status
- `js/websocket-client.js` — xem có listen table events không

Kiểm tra: Reservation tạo → table status update → POS/KDS thấy real-time?

Nếu gap → thêm table status update vào reservation creation flow.
```

### Task 5.5 — P1: Cashback Auto-Trigger Webhook
```
File: `worker/src/routes/webhooks.js`
THÊM route:

POST /api/webhooks/order-completed
  → Body: { order_id }
  → Logic:
    1. GET order từ D1
    2. Lấy user_id từ order
    3. Nếu user là loyalty member → gọi logic process-cashback (từ loyalty.js)
    4. Return { cashback_processed: true/false, amount }
  → Comment: "// NEW: P1 auto cashback webhook"

CẬP NHẬT `worker/src/routes/orders.js`:
  Khi order status thay đổi → 'completed'/'hoàn thành':
  → Tự gọi internal process-cashback logic
  → Comment: "// NEW: P1 trigger cashback on order complete"
```

### Task 5.6 — P1: Order Status Notification
```
ĐỌC `websocket-server.js`
THÊM message type: 'ORDER_STATUS_CHANGED'

Khi order status thay đổi (trong orders.js PATCH handler):
→ Broadcast WS message: { type: 'ORDER_STATUS_CHANGED', orderId, newStatus, timestamp }

ĐỌC `js/track-order.js`
→ Thêm WebSocket listener cho 'ORDER_STATUS_CHANGED'
→ Khi nhận → update UI real-time (nếu orderId match)
→ Comment: "// NEW: P1 real-time order notification"
```

### ✅ Verify Phase 5
```
CTO kiểm tra:
1. Đọc docs/backend-proposals.md — đầy đủ, có roadmap rõ ràng
2. Test order flow: tạo order qua checkout → success page hiện order_id
3. Test KDS: tạo order → KDS page tự hiện order mới
4. Test cashback: đổi order status → 'completed' → wallet balance tăng
5. Test notification: đổi order status → track-order page tự update
```

---

## 📊 Tổng Kết Task Breakdown

| Phase | Prompt | Tasks | Scope | Est. Worker Runs |
|-------|--------|-------|-------|-----------------|
| 1 | #14 - Navigation | 7 tasks | Frontend only | 7 |
| 2 | #15 - Page Linking | 7 tasks | Frontend only | 7 |
| 3 | #16 - API Audit | 5 tasks | Frontend + Docs | 5 |
| 4 | #17 - Worker Routes | 5 tasks | Backend (Worker) | 5 |
| 5 | #18 - Backend Features | 6 tasks | Full-stack | 6 |
| **Total** | | **30 tasks** | | **30 runs** |

> [!IMPORTANT]
> **Thứ tự bắt buộc:** Phase 1 → 2 → 3 → 4 → 5
> Phase 1+2 (Frontend) có thể chạy song song nếu có 2 Workers.
> Phase 3 phải xong trước Phase 4 (audit trước, build sau).
> Phase 5 phụ thuộc Phase 4 (cần loyalty routes đã có).

> [!TIP]
> Mỗi Task = 1 prompt paste vào Claude Code CLI.
> CTO verify sau mỗi task trước khi chạy task tiếp theo.
> Nếu Worker fail 2 lần (2-strikes rule) → escalate lên CTO review.
