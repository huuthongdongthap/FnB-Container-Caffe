# Backend Code Inventory - FnB Container Caffe

## Routes Inventory

| File | Method | URL | Description |
|------|--------|-----|-------------|
| auth.js | POST | /api/auth/register | Register new user with JWT token |
| auth.js | POST | /api/auth/login | Login user with JWT token |
| auth.js | POST | /api/auth/logout | Logout and revoke token via KV denylist |
| auth.js | GET | /api/auth/me | Get current user info from JWT |
| auth.js | POST | /api/auth/register-staff | Owner-only: create staff account |
| categories.js | GET | /api/categories | List all categories |
| categories.js | GET | /api/categories/:id | Get category by ID |
| contact.js | POST | /api/contact | Submit contact message (throttled: 3/hr/IP) |
| cron.js | - | - | checkOverdueOrders() - SLA check cron job |
| customers.js | GET | /api/customers/me | Get authenticated customer loyalty data |
| loyalty.js | GET | /api/loyalty/summary | Full member summary (tier, wallet, rewards) |
| loyalty.js | GET | /api/loyalty/points | Point history pagination |
| loyalty.js | GET | /api/loyalty/cashback | Cashback transaction history |
| loyalty.js | POST | /api/loyalty/spend-cashback | Use cashback on order (max 50%) |
| loyalty.js | GET | /api/loyalty/rewards | Available rewards to redeem |
| loyalty.js | POST | /api/loyalty/redeem | Redeem reward with points |
| loyalty.js | GET | /api/loyalty/my-rewards | User's claimed rewards |
| loyalty.js | GET | /api/loyalty/tiers | List all tier configs (public) |
| loyalty.js | - | - | processOrderLoyalty() - internal: cashback/points after order |
| menu.js | GET | /api/menu | List menu items (filter: category, available, search) |
| menu.js | GET | /api/menu/:id | Get menu item by ID |
| orders.js | POST | /api/orders | Create order (checkout flow) |
| orders.js | GET | /api/orders/:id | Get order by ID |
| orders.js | PATCH | /api/orders/:id | Update order status (finite state machine) |
| orders.js | GET | /api/orders/latest | Get latest order timestamp (KV flag) |
| orders.js | GET | /api/admin/orders | Admin: list orders with pagination |
| orders.js | GET | /api/stats | Admin: dashboard statistics |
| orders-hono.js | GET | /api/kds/orders/latest | KV flag for KDS pollers |
| orders-hono.js | GET | /api/kds/orders | List orders with items (KDS) |
| orders-hono.js | GET | /api/kds/orders/:id | Get order with items |
| orders-hono.js | POST | /api/kds/orders | Create order (KDS) |
| orders-hono.js | PATCH | /api/kds/orders/:id/status | Update order status (KDS) |
| payment.js | POST | /api/payment/create-link | Create PayOS payment link (HMAC-SHA256) |
| webhooks.js | GET | /api/webhook/payos | PayOS webhook healthcheck |
| webhooks.js | POST | /api/webhook/payos | PayOS IPN handler (HMAC verification) |
| tables.js | GET | /api/tables | List tables (filter: zone, status) |
| tables.js | GET | /api/tables/:id | Get table by ID |
| tables.js | PATCH | /api/tables/:id/status | Update table status (staff/owner) |
| reservations.js | GET | /api/reservations/availability | Check table availability by date/time |
| reservations.js | POST | /api/reservations | Create reservation (throttled: 5/hr/IP) |
| reservations.js | GET | /api/reservations | Admin: list reservations |
| reservations.js | DELETE | /api/reservations/:id | Admin: cancel reservation |
| reviews.js | GET | /api/reviews | List reviews (filter: rating, status, pagination) |
| reviews.js | POST | /api/reviews | Submit review (throttled: 3/hr/IP) |
| shifts.js | POST | /api/shifts/clock-in | Staff clock-in |
| shifts.js | POST | /api/shifts/clock-out | Staff clock-out |
| shifts.js | GET | /api/shifts/current | Get current shift status |
| shifts.js | GET | /api/shifts | Get shift history (owner: all, staff: own) |
| products.js | GET | /api/products | List products (filter: category_id, available) |
| products.js | GET | /api/products/:id | Get product by ID |
| promotions.js | POST | /api/promotions/validate | Validate discount code |
| promotions.js | POST | /api/promotions/redeem | Atomic increment usage count |
| promotions.js | GET | /api/promotions | List active promotions (public) |

## JS Modules Inventory (worker/src/)

| File | Exports | Purpose |
|------|---------|---------|
| index.js | app (Hono) | Main router - all routes mounted |
| middleware/cors.js | corsHeaders, jsonResponse, errorResponse | CORS headers and response helpers |
| middleware/admin-auth.js | requireAuth | JWT + role check for /api/admin/* |
| routes/auth.js | registerUser, loginUser, logoutUser, getCurrentUser, registerStaff | Auth endpoints |
| routes/categories.js | categoriesRouter | Categories CRUD |
| routes/contact.js | submitContact, contactRouter | Contact form handler |
| routes/cron.js | checkOverdueOrders | SLA overdue check cron job |
| routes/customers.js | customersRouter | Customer loyalty endpoints |
| routes/loyalty.js | loyaltyRouter, processOrderLoyalty | Loyalty rewards system |
| routes/menu.js | getMenu, getMenuItem | Menu item endpoints |
| routes/orders.js | createOrder, getOrder, updateOrder, getAdminOrders, getStats | Order CRUD + stats |
| routes/orders-hono.js | ordersRouter | KDS order router (Hono) |
| routes/payment.js | paymentRouter | PayOS payment link creation |
| routes/products.js | productsRouter | Products CRUD |
| routes/promotions.js | promotionsRouter | Discount code validation |
| routes/reservations.js | reservationsRouter | Table reservation system |
| routes/reviews.js | reviewsRouter, getReviews, createReview | Review system |
| routes/shifts.js | shiftsRouter | Staff shift clocking |
| routes/tables.js | tablesRouter | Table management |
| routes/webhooks.js | webhookRouter | PayOS IPN handler |
| utils/logger.js | createLogger, newRequestId | Structured JSON logging |

## JS Modules Inventory (js/ - frontend)

| File | Exports | Purpose |
|------|---------|---------|
| api-client.js | ApiService, apiFetch | API client with timeout/retry |
| auth.js | auth module, autoFillLoggedInUser, showLoginModal | Frontend auth UI |
| cart.js | CartManager, cartModal, checkoutModal, successModal | Cart management |
| checkout.js | checkoutUtils, paymentQR | Checkout orchestrator |
| config.js | API_CONFIG, PAYMENT_CONFIG, DELIVERY_CONFIG | Shared configuration |
| loyalty.js | LoyaltyManager, CUSTOMER_TIERS, POINTS_RULES | Loyalty rewards system |
| menu.js | default | Menu page interactions |
| script.js | default | Main landing page orchestrator |
| shared-nav.js | initNavbar, initFooter | Shared navbar/footer |
| sw.js | default | Service worker for PWA |
| track-order.js | trackOrderGlobal, retrySearch | Order tracking UI |
| kds-app.js | default | KDS (Kitchen Display System) |
| kds-poll.js | KdsPollClient, startKdsPolling | KV flag-based polling |
| kds/kds-api.js | generateOrderId, fetchKDSOrders, updateOrderStatusAPI | KDS API wrappers |
| kds/kds-render.js | renderOrderCard, renderAllOrders, updateStats | KDS rendering |
| checkout/cart-summary.js | loadCartToSummary, updateTotals, calculateDeliveryFee | Checkout summary |
| checkout/payment.js | handleMoMoPayment, handlePayOSPayment, handleCODSuccess | Payment handlers |
| checkout/qr-code.js | openPaymentQRModal, generateBankQR, generateMoMoQR, generateVietQR | QR code generation |
| landing/form-validation.js | initContactForm, validateForm, validateField | Contact form validation |
| landing/gallery.js | initGalleryLightbox | Gallery lightbox |

## Database Schemas (from worker/schema.sql)

### Tables

| Table | Columns | Notes |
|-------|--|-------|
| categories | id, name, slug, description, sort_order, created_at, updated_at | Main menu categories |
| products | id, category_id, name, price, description, image_url, tags, badge, is_available, created_at, updated_at | Normalized menu items for KDS |
| cafe_tables | id, table_number, zone, seats, status, created_at | Table management (Indoor/Outdoor/VIP) |
| menu_items | id, category, name, price, description, tags, badge, available, created_at, updated_at | Legacy menu items |
| customers | id, email, name, phone, loyalty_points, loyalty_tier, created_at, updated_at | Customer loyalty data |
| orders | id, items, total, status, customer_name, customer_phone, customer_email, customer_address, payment_method, payment_status, shipping_fee, discount, notes, delivery_time, table_id, subtotal, tax, total_amount, created_at, updated_at | Order records |
| order_items | id, order_id, product_id, quantity, subtotal, modifiers, created_at | Line items for KDS |
| payments | id, order_id, method, amount, status, transaction_id, payment_url, created_at, updated_at | Payment records |
| reservations | id, table_id, customer_name, customer_phone, guest_count, date, time, zone, status, notes, created_at, updated_at | Table reservations |
| contact_messages | id, name, phone, email, category, content, status, created_at | Contact form submissions |
| reviews | id, customer_name, rating, content, tags, status, created_at | Customer reviews |
| loyalty_members | id, phone, full_name, email, tier, points_balance, total_points_earned, created_at | Legacy loyalty members |
| loyalty_transactions | id, member_id, type, points, reference_id, created_at | Legacy loyalty transactions |
| loyalty_tiers | id, name, min_points, cashback_percent, created_at | Tier configuration |
| loyalty_rewards | id, name, points_cost, status | Reward definitions |
| staff_shifts | id, staff_email, clock_in, clock_out, shift_type, notes | Staff clocking |

### Relationships

- `orders.table_id` → `cafe_tables.id`
- `order_items.order_id` → `orders.id`
- `order_items.product_id` → `products.id`
- `payments.order_id` → `orders.id` (ON DELETE CASCADE)
- `reservations.table_id` → `cafe_tables.id`
- `products.category_id` → `categories.id`

## WebSocket Inventory

**Note:** Uses Cloudflare KV flag pattern instead of WebSocket server (Option A)

| Event | Description |
|-------|-------------|
| KDS_POLL_UPDATE | KV key `latest_order_ts` changed → KDS pollers refresh orders |

## Complete Feature List

### Authentication
- JWT-based auth with HS256 signing
- KV-based token denylist for logout revocation
- PBKDF2-SHA256 password hashing (100k iterations)
- Legacy SHA-256 password verification (auto-migrate on login)
- Role-based access: customer, staff, owner

### Menu System
- Category-based menu organization
- Menu item filtering (category, availability, search)
- Tags and badges per item
- JSON-based tags storage

### Orders
- Order creation with items array
- Order status finite state machine: pending → confirmed → preparing → ready → delivered/completed
- Table integration (occupied/reserved/available)
- KV flag-based real-time for KDS polling (3s latency)

### Payments
- PayOS integration with HMAC-SHA256 signatures
- Payment URL generation with returnUrl/cancelUrl
- Webhook handler for IPN (idempotent)
- Payment records in D1 with transaction_id mapping

### Loyalty System
- 4-tier system: Bronze, Silver, Gold, Platinum
- Cashback wallet with balance tracking
- Points earned per order (tier-based rate)
- Reward redemption with points
- Tier upgrade auto-detection

### Reservations
- Table availability by date/time
- IP-based throttling (5/hr/IP)
- Zone management (Indoor/Outdoor/VIP)

### Reviews
- Rating 1-5 with tags
- Status: pending/approved/published
- IP-based throttling (3/hr/IP)

### Staff Management
- Shift clock-in/clock-out
- Shift type detection (morning/afternoon/evening)
- History view (owner: all, staff: own)

### Admin Features
- JWT + role-based protection on /api/admin/*
- Dashboard statistics (orders today, revenue, top products)
- Order management with pagination
- Table status updates

### Real-time (KDS)
- KV flag pattern: `latest_order_ts` updated on order changes
- Polling client with configurable interval (default 3s)
- Ordered by priority: rush, normal, low

### Cron Jobs
- SLA overdue check (default 15 min threshold)
- Updates status with "[SLA OVERDUE]" note

### Utilities
- Structured JSON logging (createLogger)
- Request ID generation for correlation
- CORS with origin allowlist
- Rate limiting via KV (contact, reviews, reservations)
