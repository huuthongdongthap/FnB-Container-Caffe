---
date: 2025-06-19
version: 1.0
status: stable
---

# SYSTEM ARCHITECTURE — AURA CAFE CONTAINER

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare Pages                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Static Assets (HTML, CSS, JS, images)               │  │
│  │  Built by Vite → dist/                                │  │
│  └───────────────────────────────────────────────────────┘  │
│                              ↓                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Worker: _worker.js (Hono app)                       │  │
│  │  - 27 route modules                                  │  │
│  │  - 4 middleware                                      │  │
│  │  - KV + D1 bindings                                  │  │
│  └───────────────────────────────────────────────────────┘  │
│                              ↓                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  D1 Database (SQLite)                                │  │
│  │  - 11 tables                                         │  │
│  │  - 5 migrations                                      │  │
│  └───────────────────────────────────────────────────────┘  │
│                              ↓                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  KV Namespace                                        │  │
│  │  - Rate limit counters                               │  │
│  │  - Session data                                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘

URL: https://fnb-caffe-container.pages.dev
Worker: aura-space-worker (Cloudflare)
Database: AURA_DB (D1 SQLite)
Cache: AUTH_KV (KV namespace)
```

**Total endpoints:** ~45+ routes  
**Total pages:** 35+ HTML pages  
**Database tables:** 26 tables (includes loyalty, subscription, notification, integration, marketing tables)  
**Frontend modules:** 25 JavaScript modules  

---

## Frontend Architecture

### HTML Pages

**Core Customer Pages (11):**
1. `index.html` — Homepage với water ripple animation (Bazi Chrome-Silver)
2. `menu.html` — Menu display với categories & products
3. `checkout.html` — Shopping cart & checkout flow
4. `success.html` — Order success confirmation
5. `failure.html` — Payment failure page
6. `loyalty.html` — Loyalty program tiers & rewards
7. `track-order.html` — Real-time order tracking
8. `kds.html` — Kitchen Display System (real-time polling)
9. `table-reservation.html` — Table booking form
10. `about-us.html` — About page
11. `contact.html` — Contact form

**Additional Pages:**
- `admin/*.html` — Admin dashboard (8+ pages)
- `brand-guideline.html` — Design system showcase
- `receipt-template.html` — Receipt printing template
- `promotions.html` — Promotions landing page
- `checkin.html` — Loyalty check-in page

### JavaScript Modules (25)

**Core functionality:**
- `main.js` — App initialization (200+ LOC)
- `api-client.js` — Fetch wrapper with auth headers
- `config.js` — App configuration (API base URL, constants)
- `theme.js` — Light/dark auto-switch (06:00-18:00 local)

**E-commerce flow:**
- `cart.js` — Cart state management (localStorage sync)
- `checkout.js` — Checkout flow (form validation, submission)
- `track-order.js` — Real-time order status polling
- `promo.js` — Promotion code application

**Loyalty:**
- `loyalty.js` — Tier display, points tracking
- `signup-loyalty.js` — Registration with loyalty signup
- `checkin.js` — Check-in QR code scanning

**KDS & Admin:**
- `kds-app.js` — Kitchen display rendering
- `kds-poll.js` — Polling for new orders (3s interval)
- `pos.js` — POS mode (fullscreen, quick actions)

**UI/UX:**
- `ui-animations.js` — Shared animation utilities
- `premium-ui.js` — Glassmorphism components
- `asian-wow.js` — "Wow" effect triggers
- `hero-aura.js` — Hero section water ripple
- `shared-nav.js` — Navigation bar component
- `mobile-nav.js` — Mobile hamburger menu

**Infra:**
- `auth.js` — Auth state (JWT token storage, refresh)
- `websocket-client.js` — WebSocket for real-time (planned)
- `i18n.js` — Vietnamese/English strings
- `utils.js` — General utilities (date format, currency)

### CSS Design System

**Bazi v5.1 Color Tokens** (`css/brand-tokens.css`):

```css
/* Thủy (Water) — Primary */
--md-sys-color-primary: #0A1A2E;      /* Deep Navy */
--md-sys-color-primary-container: #1A2A4E;  /* Ocean */
--md-sys-color-on-primary: #ffffff;

/* Kim (Metal) — Accent */
--md-sys-color-secondary: #C9D6DF;    /* Chrome Silver */
--md-sys-color-secondary-container: #6B9FB8; /* Steel Blue */
--md-sys-color-tertiary: #3A6B80;     /* Steel */

/* Mộc (Wood) — Balance */
--md-sys-color-tertiary-container: #1A2D1F;  /* Deep Forest */
--md-sys-color-surface: #2D5A3D;      /* Jade Green */
--md-sys-color-surface-variant: #A8C5A0; /* Moss */

/* Neutrals */
--md-sys-color-background: #060a13;   /* Deep dark bg */
--md-sys-color-surface: #0d1117;      /* Card bg */
--md-sys-color-on-surface: #e8eaed;   /* Text */

/* Banned (Fire/Earth) — MUST NOT USE */
#FFD700, #D4AF37, #FF6B35, #FF1744, #8B4513, etc.
```

**Typography:**
- Heading: `'Cormorant Garamond', serif` (Google Fonts)
- Body: `'Space Grotesk', sans-serif`
- Tech/Prices: `'JetBrains Mono', monospace`

---

## Backend Architecture

### Framework: Hono v4.12.12

**Entry point:** `worker/src/index.js` (210 LOC)

### Middleware Stack (in order)

1. **CORS** — Allowlist origins:
   - `https://fnb-caffe-container.pages.dev`
   - `https://*.fnb-caffe-container.pages.dev`
   - `https://auraspace.cafe`
   - `http://localhost:*`

2. **Route handlers** (applied per route)

3. **Global error handler** — JSON errors only (never leak HTML to API clients)

### API Routes by Category

#### Menu (`/api/menu`)
- `GET /api/menu` — List with filters `?category=, available=1, search=`
- `GET /api/menu/:id` — Single product

#### Orders (`/api/orders`)
- `POST /api/orders` — Create (rate limit: 5/IP/10min)
- `GET /api/orders/latest` — Timestamp of most recent
- `GET /api/orders/:id` — Get order detail
- `PATCH /api/orders/:id` — Update status (admin only)
- `GET /api/admin/orders` — List all (admin only, paginated)
- `GET /api/stats` — Dashboard metrics (admin only)

#### KDS (`/api/kds/orders`)
- Full KDS CRUD (GET, POST) — staff auth required

#### Authentication (`/api/auth/*`)
- `POST /api/auth/register` — Customer signup (rate limited)
- `POST /api/auth/login` — Returns JWT + user object
- `POST /api/auth/logout` — Invalidate session
- `GET /api/auth/me` — Current user profile
- `POST /api/auth/register-staff` — Owner-only staff creation (audited)
- `GET /api/auth/staff` — List staff (owner-only, audited)
- `POST /api/auth/bootstrap-owner` — First-time owner setup
- `POST /api/auth/reset-password` — Email reset flow
- `POST /api/auth/change-password` — Authenticated change

#### Sub-Routers (Hono-native)

| Router | Mount Path | Auth | Purpose |
|--------|------------|------|---------|
| `paymentRouter` | `/api/payment/*` | No | Payment gateway integration |
| `webhookRouter` | `/api/webhook/*` | No | PayOS/Zalo webhooks |
| `categoriesRouter` | `/api/categories/*` | Yes | Category CRUD |
| `productsRouter` | `/api/products/*` | Yes | Product CRUD |
| `tablesRouter` | `/api/tables/*` | Yes | Table management |
| `reservationsRouter` | `/api/reservations/*` | Yes | Reservation CRUD |
| `customersRouter` | `/api/customers/*` | Yes | Customer management |
| `promotionsRouter` | `/api/promotions/*` | Yes | Promo code management |
| `shiftsRouter` | `/api/shifts/*` | Yes | Staff shift tracking |
| `subscriptionsRouter` | `/api/subscriptions/*` | Yes | Notification subscriptions |
| `signageRouter` | `/api/signage/*` | No | Digital signage widgets (menu, promos) |
| `mixpostRouter` | `/api/mixpost/*` | No | Social media auto-posting bridge |
| `pretixRouter` | `/api/pretix/*` | No | Event ticketing bridge (events, orders, webhook, check-in) |

#### Manual Dispatcher (non-Hono)

- `/api/reviews/*` — Customer reviews
- `/api/contact/*` — Contact form submissions
- `/api/loyalty/*` — Core loyalty logic
- `/api/loyalty/referral` — Referral program
- `/api/loyalty/birthday` — Birthday rewards
- `/api/loyalty/checkin` — QR check-in points
- `/api/admin/loyalty/*` — Admin loyalty ops (audited)
- `/api/reports/*` — Report generation (PDF/CSV)

#### Admin Test Endpoints (owner-only)
- `POST /api/test/telegram-sim` — Simulate Telegram order notification
- `POST /api/test/zalo-zns` — Test Zalo ZNS template
- `POST /api/admin/zalo/send-expiry-warnings` — Batch cashback expiry

#### Health & Scheduled
- `GET /api/health` — Health check (`{status: "ok", ts: ...}`)
- `POST (scheduled)` — Daily cron: `checkOverdueOrders()`, `processErpnextRetryQueue()`, `processErpnextProductSync()`, `syncMauticContacts()`, `detectWinbackCandidates()`, `detectBirthdayCandidates()`

<!-- Odoo Integration Routes removed in Phase 07 cleanup (2026-06-30): 22 Odoo files deleted, replaced by ERPNext routes below -->

#### ERPNext Integration Routes (`/api/erpnext/*`)
All require `owner` auth. Mirror Odoo routes with REPL REST transport.

**Accounting:**
- `POST /api/erpnext/invoices` — Create Sales Invoice in ERPNext from completed order
- `GET /api/erpnext/invoices/:orderId` — Lookup invoice by local order
- `POST /api/erpnext/invoices/:orderId/retry` — Retry failed invoice sync

**POS/Products:**
- `GET /api/public/products/:productId/availability` — KV-cached stock check (no auth, shared)
- `POST /api/erpnext/sales-orders` — Create ERPNext Sales Order from local order
- `POST /api/erpnext/products/sync` — Delta sync ERPNext items to D1
- `POST /api/webhooks/erpnext` — Webhook receiver for ERPNext product changes

**Booking:**
- `POST /api/webhooks/cal-booking` — Cal.com webhook receiver (validated by `x-cal-webhook-secret` header). Handles BOOKING_CREATED, BOOKING_CANCELLED, BOOKING_RESCHEDULED. Auto-allocates tables based on capacity and zone preference. Idempotent via `cal_booking_uid`.

**CRM:**
- `POST /api/erpnext/leads` — Create Lead from customer signup (consent-aware)
- `GET /api/erpnext/customers/:customerId/notes` — Pull ERPNext customer notes
- `POST /api/erpnext/customers/:customerId/tags` — Add loyalty tier tag

**Admin:**
- `GET /api/admin/erpnext/sync` — ERPNext sync status and manual trigger page
- `GET /api/erpnext/sync-failures` — List failed ERPNext sync mappings (owner-only, last 100)

### Authentication & Authorization

**JWT Flow:**
1. Client POST `/api/auth/login` with `{phone, password}` (or OTP)
2. Worker validates against `users` table
3. Issues JWT signed with `JWT_SECRET` (Wrangler secret)
4. Client stores in `localStorage` / session cookie
5. Subsequent requests: `Authorization: Bearer <token>`
6. `requireAuth(roles)` middleware verifies token + role check

**Role checks:**
- `owner` — full access (bootstrap, staff management, test endpoints)
- `staff` — kitchen, orders, tables, reservations
- Unauthenticated — menu, order creation (limited)

### Rate Limiting

**KV-backed counters** (per IP):
- **Auth endpoints:** 20 attempts / 5 minutes (`rate:auth:{ip}`)
- **Order creation:** 5 orders / 10 minutes (`rate:order:{ip}`)

Configuration: `AUTH_KV` namespace, TTL per key.

### Audit Logging

`audit(action)` middleware logs to `state/gates/`:
- `audit-<action>-<timestamp>.json`
- Captures: user (from JWT), action, IP, timestamp, request snapshot

Used for: accountability, debugging, compliance.

### Email & SMS Utilities

**Email providers:**

| Provider | File | Purpose | Tier |
|----------|------|---------|------|
| SendGrid | `worker/src/lib/email.js` | Transactional emails (order confirm, receipt, welcome, e-invoice) | 100/day free |
| Resend | `worker/src/lib/resend-client.js` | Marketing campaign emails (via Mautic triggers) | 3,000/mo free, 100/day |

**SMS provider:**
| Provider | File | Cost |
|----------|------|------|
| SpeedSMS | `worker/src/lib/speedsms-client.js` | 490 VND/SMS flat (~$6/mo for 300). Brandname sender (type=2), number normalization |

**SendGrid patterns:** Non-blocking fire-and-forget via `ctx.waitUntil()` or bare `.catch()`

| File | Purpose |
|------|---------|
| `worker/src/lib/email.js` | SendGrid HTTP API wrapper (v3 Mail Send). 10s timeout, structured logging, graceful skip when SENDGRID_API_KEY is unset |
| `worker/src/templates/order-confirm.js` | Order confirmation HTML — Vietnamese, itemized table, Aura Cafe branding (#0A1A2E/#C9D6DF) |
| `worker/src/templates/receipt.js` | Payment receipt HTML — Vietnamese, green success header, payment details summary |
| `worker/src/templates/welcome.js` | Welcome email HTML — HTML-escaped customer name, loyalty tier display, XSS prevention |

**SendGrid triggers** (all fire-and-forget):
- `routes/orders.js` — Order confirmation on `POST /api/orders`
- `routes/webhooks.js` — Payment receipt on PayOS webhook `PAID` event
- `routes/auth.js` — Welcome email on `POST /api/auth/register`
- `routes/erpnext-invoices.js` — E-invoice notification with PDF download URL

**Resend** (`worker/src/lib/resend-client.js`): HTTP POST to `api.resend.com/emails`, Bearer token auth, 10s timeout. Returns `{success, messageId}` — graceful skip when `RESEND_API_KEY` unset. Called via Mautic campaign touchpoints (campaign-templates.js).

**SpeedSMS** (`worker/src/lib/speedsms-client.js`): HTTP POST to `api.speedsms.vn/index.php/sms/send`, Basic auth (base64 apiKey:apiSecret), brandname type=2. Phone normalization to 84xxxxxxxxx format. Returns `{success, messageId}` — graceful skip when credentials unset.

**Env vars required:**
- `SENDGRID_API_KEY` — SendGrid Bearer token
- `EMAIL_FROM` — Sender address (default: aura@fnb-caffe-container.pages.dev)
- `EMAIL_FROM_NAME` — Display name (default: AURA CAFE)
- `RESEND_API_KEY` — Resend.com API key
- `SPEEDSMS_API_KEY`, `SPEEDSMS_API_SECRET` — SpeedSMS credentials

### Marketing Automation Bridge (Mautic)

**Status:** Complete (Phase 04, 2026-06-30)

One-way D1-to-Mautic contact sync bridge. Runs via CF Worker cron. No public HTTP endpoints — all operations are cron-triggered.

**Architecture:**
```
D1 (customers table)
  → syncMauticContacts()    (cron, incremental via KV cursor)
    → MauticClient.batchUpsertContacts()  (groups of 50)
      → syncSegments()       (loyalty tier, recency, birthday month)
        → MauticClient.addContactToSegment()

D1 (orders + customers)
  → detectWinbackCandidates()  (30-day inactive, cron)
  → detectBirthdayCandidates() (birthday month, cron)
    → MauticClient.addContactToCampaign()
      → campaign_enrollments table (dedup, 30d window)

Admin trigger:
  → triggerPromoCampaign()  (manual, with segment filter: tier + recency)
```

**Files:**
- `worker/src/lib/mautic-client.js` — OAuth2 client credentials, contact/segment/campaign API, retry with backoff, FastCGI fallback
- `worker/src/lib/campaign-templates.js` — Vietnamese templates (winback, birthday, promo), each returns `{subject, html, sms}`
- `worker/src/routes/mautic-bridge.js` — Bridge logic: contact transformation, incremental sync, segment mapping, campaign enrollment triggers
- `worker/src/routes/cron.js` — Re-exports `syncMauticContacts`, `detectWinbackCandidates`, `detectBirthdayCandidates`
- `worker/src/index.js` — `scheduled.fetch()` runs all 3 Mautic cron tasks via `ctx.waitUntil()`

**Database:** `campaign_enrollments` table for dedup (30-day rolling window per customer per campaign type), audit, and Mautic contact ID mapping.

**Campaign types:**
- **Win-back:** Customers with last order 30-31 days ago. Enrolls in Mautic win-back campaign. Skips if already enrolled in last 30 days.
- **Birthday:** Customers whose birthday is in current month. Skips if already enrolled this month or already used `birthday_discount_used` action.
- **Promo:** Manual trigger with optional segment filter (loyalty tier or recency). No auto-dedup (admin-owned).

**Segments assigned during sync:**
- **Tier:** BASIC → `loyalty_bronze`, SILVER → `loyalty_silver`, GOLD → `loyalty_gold`, PLATINUM → `loyalty_platinum`
- **Recency:** ≤30d → `active`, 31-60d → `at_risk`, >60d or no orders → `inactive`
- **Birthday:** Current month matches customer birthday → `birthday_this_month`

**Phone-only fallback:** Customers without email get an internal address `{phone}@aura-cafe.internal` for Mautic contact upsert (email is Mautic's unique identifier).

**Env vars:** `MAUTIC_BASE_URL`, `MAUTIC_CLIENT_ID`, `MAUTIC_CLIENT_SECRET`, `MAUTIC_CAMPAIGN_WINBACK`, `MAUTIC_CAMPAIGN_BIRTHDAY`, `MAUTIC_CAMPAIGN_PROMO`, `MAUTIC_SEGMENT_*` (8 segment IDs).

**Tests:** 73 tests across 5 files, all pass.

---

## Digital Signage (Xibo)

**Status:** Complete (Phase 03, 2026-07-01)

Xibo CMS v4.4.3 running on Docker serves as the digital signage platform. Content is delivered via self-contained HTML widgets that fetch real-time data from CF Worker API endpoints.

### Architecture

```
┌────────────────────┐      LAN       ┌─────────────────────┐
│  Xibo CMS (Docker) │ ◄────HTTP───── │  Xibo Player (RPi)  │
│  Cloud VPS, 2GB RAM│                 │  Raspberry Pi 5     │
│  Serves widgets    │                 │  HDMI → TV Display  │
└────────────────────┘                 └─────────────────────┘
         ▲                                      │
         │ HTTP widget fetch                    │ Auto-refresh
         │ (5 min cache)                        │ (Xibo interval)
         ▼                                      ▼
┌────────────────────┐                 ┌─────────────────────┐
│  CF Worker API     │                 │  TV Screen          │
│  /api/signage/*    │                 │  Displays widget    │
│  Reads D1 tables   │                 │  content live       │
└────────────────────┘                 └─────────────────────┘
```

### Signage HTML Widgets

Three self-contained widgets in `signage-widgets/`, fully offline-capable (zero CDN dependencies, inline fonts):

| Widget | File | Purpose | Data Source |
|--------|------|---------|-------------|
| Menu Board | `signage-widgets/menu-board.html` | Category-grouped products with prices and images | `GET /api/signage/menu` |
| Promo Screen | `signage-widgets/promo-screen.html` | Promotional carousel with expiry badges | `GET /api/signage/promos` |
| Welcome Screen | `signage-widgets/welcome-screen.html` | Welcome + Wi-Fi + loyalty + specials sections | `GET /api/signage/promos` |

**Design constraints:**
- Zero external CDN requests (100% self-contained)
- Offline-capable: all CSS and fonts inlined
- Bilingual Vietnamese + English content
- Aura Cafe branding (#0A1A2E Navy, #C9D6DF Chrome)
- TV-optimized: large fonts, high contrast, 16:9 layout

### Signage API Endpoints

| Endpoint | Method | Auth | Cache | Description |
|----------|--------|------|-------|-------------|
| `/api/signage/menu` | GET | None | 5 min | Categories with available products, grouped by category, sorted by `sort_order` |
| `/api/signage/promos` | GET | None | 5 min | Active promotions list (code, percent, max_discount, min_order, expires_at) |

**Response format:** `{ success: true/false, data: [...] }` — all JSON, no auth headers needed.

**Caching:** Both endpoints set `Cache-Control: public, max-age=300` (5 minutes). Xibo players cache at the CMS level; additional CDN caching is redundant.

### Data Sources

Both endpoints are **read-only** and query existing D1 tables:
- `products` + `categories` (for menu)
- `promotions` (for promos)

No new database tables or migrations required. No write operations.

### Routes

Registered in `worker/src/index.js`:
```js
import { signageRouter } from './routes/signage.js';
app.route('/api/signage', signageRouter);
```

### Setup

See `docs/xibo-setup-guide.md` for full bilingual deployment guide covering:
- Docker Compose setup for Xibo CMS (v4.4.3, 2GB RAM minimum)
- Raspberry Pi 5 player installation (dietpi + Xibo Linux Player)
- Widget configuration in Xibo CMS web interface
- End-to-end testing procedure
- Troubleshooting common issues (blank screens, stale content, NTP sync)

### Tests

30 TDD tests across 2 files, all pass:
- `tests/signage-api.test.js` (12) — API endpoint correctness, Cache-Control headers, error handling, data grouping
- `tests/signage-widgets.test.js` (18) — Widget rendering, data binding, error states, carousel, section rotation, file existence

---

## Social Media Bridge (Mixpost)

**Status:** Complete (Phase 04, 2026-07-01)

Self-hosted Mixpost (Docker) serves as the social media publishing engine. CF Worker bridge auto-generates posts from Aura D1 data (promos, menu specials) and pushes to Mixpost API for scheduling.

### Architecture

```
Aura CF Worker                     Mixpost Docker (VPS:9000)
┌──────────────────────┐           ┌────────────────────────┐
│ /api/mixpost/        │──REST──→  │ Mixpost API            │
│   posts (CRUD)        │  Bearer   │  POST /api/mixpost/    │
│   generate (promo→post)│  token   │    posts               │
│   accounts (list)     │           │    media               │
│                       │           │    accounts            │
│ Cron: auto-post       │──REST──→  │                        │──→ Facebook
│   daily specials      │           │ Mixpost UI (Vue SPA)   │──→ Instagram
└──────────────────────┘           └────────────────────────┘
```

### API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/mixpost/posts` | POST | None (internal) | Create scheduled social post with optional media uploads. Zod-validated body: `{ content, accounts, scheduledAt, mediaUrls }` |
| `/api/mixpost/generate` | POST | None (internal) | Auto-generate post draft from D1 data. Body: `{ source: "promotion"|"menu", id }`. Returns `{ content, mediaUrls, hashtags }` |
| `/api/mixpost/accounts` | GET | None (internal) | Proxy to Mixpost — list connected social accounts |
| `/api/mixpost/posts` | GET | None (internal) | Proxy to Mixpost — list recent posts with status |

### Content Templates

Content generation in `worker/src/routes/mixpost.js`:
- **Promotion posts:** `{code}: Giam {percent}% don hang!` + emoji + hashtags (#AuraCafe, #KhuyenMai)
- **Daily specials:** "Mon dac biet hom nay" with product names, prices, and images
- **Weekly highlights:** "Best seller tuan nay" — top 3 products by order count

### Cron Jobs

| Cron | Schedule | Logic | Skip Condition |
|------|----------|-------|----------------|
| `autoPostDailySpecials` | Daily 07:00 | Queries top 3-5 available products, generates branded post | No products available |
| `autoPostNewPromotions` | Daily 08:00 | Detects promotions activated in last 24h | No new promotions |
| `autoPostWeeklyHighlights` | Mon 09:00 | Aggregates top sellers from last 7 days of orders | Insufficient order data |

All cron functions are idempotent and gracefully skip when `MIXPOST_API_URL` is unset.

### Data Sources

Read-only queries to existing D1 tables:
- `products` — daily specials, weekly highlights
- `promotions` — promotion announcements
- `categories` — menu category grouping (for specials)
- `orders` + `order_items` — weekly best sellers aggregation

No new database tables or migrations required.

### Setup

See `docs/mixpost-setup-guide.md` for full bilingual deployment guide covering:
- Docker Compose setup (3 containers: Mixpost, MySQL, Redis)
- REST API add-on installation (`composer require inovector/mixpost-api`)
- API token generation
- Facebook/Instagram account connection in Mixpost UI
- Worker env var configuration (`MIXPOST_API_URL`, `MIXPOST_API_TOKEN`)
- Troubleshooting common issues (401 token, Facebook re-auth, port conflicts)

### Tests

33 TDD tests in `tests/mixpost-bridge.test.js`, all pass:
- Mixpost API client: auth headers, retry on 5xx, error classes, graceful skip when unconfigured
- Hono routes: POST /posts validation, POST /generate content templates, GET /accounts and /posts proxy
- Cron functions: daily specials generates from products, new promos detects 24h window, weekly highlights aggregates, empty data skips gracefully

---

## Event Ticketing Bridge (pretix)

**Status:** Complete (Pillar 07/12, 2026-07-01)

Self-hosted pretix (Docker, Python/Django, AGPL) serves as the event ticketing engine. CF Worker bridge proxies events/orders, receives webhooks with HMAC-SHA256 validation, provides QR-based check-in, and connects to Mixpost for event promotion.

### Architecture

```
Aura CF Worker                     pretix Docker (VPS:9001)
┌──────────────────────┐           ┌────────────────────────┐
│ /api/pretix/         │──REST──→  │ pretix REST API        │
│   events (list)      │  Token    │  /api/v1/organizers/   │
│   orders (sync)      │           │  .../events/           │
│   checkin (proxy)    │           │  .../orders/           │
│   generate (post)    │           │  .../checkinlists/     │
│                       │           │                        │
│ /api/pretix/webhook  │←──POST─── │ pretix Webhook         │
│   (HMAC-SHA256)      │  Hook     │  order.placed          │
│                       │           │  order.paid            │
│ Cafe Website         │──embed──→ │ pretix JS Widget       │
│  /workshops page     │           │  (ticket sales UI)     │
└──────────────────────┘           └────────────────────────┘
```

### API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/pretix/events` | GET | None | List events + ticket types from pretix |
| `/api/pretix/events/:slug` | GET | None | Get single event with items |
| `/api/pretix/orders` | GET | None (admin) | List recent orders |
| `/api/pretix/webhook` | POST | HMAC-SHA256 | Receive pretix webhook events |
| `/api/pretix/checkin` | POST | None | Proxy check-in scan (QR secret to pretix redeem API) |
| `/api/pretix/generate` | POST | None | Generate branded social post from event data |

### Webhook Actions

pretix fires webhooks that the handler validates and processes:

| Action | Handler | D1 Effect |
|--------|---------|-----------|
| `pretix.event.order.placed` | `syncNewOrder()` | Inserts row in `ticket_orders` |
| `pretix.event.order.paid` | `updateOrderStatus()` | Updates status to `paid` |
| `pretix.event.order.canceled` | `updateOrderStatus()` | Updates status to `canceled` |
| `pretix.event.order.refund.done` | `updateOrderStatus()` | Updates status to `refunded` |
| Unknown action | Ignored | No DB change, returns 200 |

Signature validation: HMAC-SHA256 of raw request body against `PRETIX_WEBHOOK_SECRET`. Returns 401 on mismatch.

### Check-in Flow

```
Door Scanner (mobile web app)
  │ QR scan → extracts ticket secret
  ▼
POST /api/pretix/checkin { secret, event, listId? }
  │ Proxy to pretix redeemCheckin API
  ▼
Response: { status: "green"|"yellow"|"red", message: "..." }
  │ green  = ticket valid, first check-in
  │ yellow = already checked in (re-entry)
  │ red    = invalid ticket / expired
  ▼
Door opens / alert displayed
```

### Social Post Generation

`POST /api/pretix/generate` creates Vietnamese branded event promotion content for Mixpost:

- **Event source:** Event name, date, location, ticket types with prices
- **Output:** `{ content, hashtags, mediaUrls }` — ready for `/api/mixpost/posts`
- **Hashtags:** `#AuraCafe`, `#SuKien`, `#Workshop`

### Files

| File | Purpose |
|------|---------|
| `worker/src/lib/pretix-client.js` | pretix REST API HTTP client (token auth, retry, error class) |
| `worker/src/routes/pretix.js` | Hono router (6 endpoints + webhook handler + D1 sync) |
| `tests/pretix-bridge.test.js` | 25 TDD tests (client + routes) |
| `docs/pretix-setup-guide.md` | Bilingual VN+EN setup guide (Docker, organizer, widget, check-in) |
| `docs/docker-compose.pretix.yml` | Docker Compose (PostgreSQL 15 + Redis 7 + pretix standalone) |
| `docs/pretix.cfg` | pretix configuration template |

### Database

`ticket_orders` table in D1 (added to schema):
- `id TEXT PK` — pretix order code (e.g. "ABC23")
- `event_slug`, `event_name`, `status`, `customer_email`, `customer_name`
- `total`, `currency`, `items` (JSON), `ticket_secret`
- `webhook_raw` (JSON), `created_at`, `updated_at`
- Indexes on `event_slug`, `status`, `customer_email`

### Setup

See `docs/pretix-setup-guide.md` for full bilingual deployment guide covering:
- Docker Compose setup (PostgreSQL 15 + Redis 7 + pretix/standalone:stable)
- pretix admin: organizer creation, event + ticket type configuration
- API token generation (Admin UI or `createtoken` CLI)
- Cloudflare Worker env var configuration
- pretix JS widget embed on `/workshops` page
- Check-in scanner web app setup
- Troubleshooting (port conflicts, 401 errors, webhook issues, CORS)

### Tests

25 TDD tests in `tests/pretix-bridge.test.js`, all pass:
- **PretixClient (8):** Token auth header, getEvent with items, paginated orders, redeemCheckin POST, createWebhook, retry on 5xx, PretixApiError on 401/4xx
- **pretix Routes (17):** GET /events (list + error), GET /events/:slug (detail + 404), GET /orders (list + error), POST /webhook (4 actions + invalid signature + unknown action + missing header), POST /checkin (green/yellow/red + missing secret), POST /generate (event post + unknown event)

---

## Database Layer (D1 SQLite)

### Schema Overview

**Core tables (11 original):**
1. **categories** — Menu categories (id, name, description)
2. **products** — Menu items linked to categories (price, image_url, is_available)
3. **users** — Customers (phone unique, tier: Silver/Gold/Platinum, total_points)
4. **rewards** — Loyalty rewards (point_cost, discount_type, discount_value)
5. **cafe_tables** — Table inventory (table_number unique, capacity, zone, status)
6. **reservations** — Bookings (linked to tables, date/time, status, cal_booking_uid for Cal.com webhook idempotency)
7. **orders** — Customer orders (status: 'Bep tiep nhan' etc., subtotal, total)
8. **order_items** — Line items (product, quantity, modifiers)
9. **payments** — Payment records (gateway, transaction_id, status)
10. **promotions** — Discount codes (percent, usage limits, expiry)
11. **staff_shifts** — Time clock records (staff_email, clock_in/out)

**Extended tables (loyalty, subscriptions, integrations, marketing):**
- **cashback_wallets** — Customer cashback balance (earn/spend tracking)
- **cashback_transactions** — Cashback earn/spend/expire/refund log
- **loyalty_tiers** — Tier definitions (bronze/silver/gold/platinum) with multipliers
- **loyalty_point_logs** — Points earn/spend history per customer
- **loyalty_audit_log** — Audit trail for all loyalty actions
- **bonus_campaigns** — Configurable bonus campaigns (checkin, referral, birthday, signup)
- **referral_codes** — Unique referral codes per customer
- **referrals** — Referral records with points awarded
- **user_rewards** — Customer-redeemed rewards
- **notification_audit_log** — Sent notification tracking (ZNS, Telegram, email, SMS)
- **subscription_plans** — Container lease plan definitions
- **subscriptions** — Active container lease contracts
- **subscription_invoices** — Subscription renewal billing records
- **mrr_snapshots** — Daily MRR/ARR metric snapshots
- **odoo_mappings / erpnext_mappings** — Entity sync mappings (order, customer, product)
- **odoo_invoices / odoo_sync_logs / odoo_product_sync / odoo_sync_failures / odoo_customer_consent** — Odoo integration tables (legacy superseded by ERPNext)
- **erpnext_sync_logs** — ERPNext sync audit log
- **campaign_enrollments** — Mautic campaign enrollment tracking (dedup, 30d window)
- **contact_messages** — Contact form submissions

**Indexes:** 35+ indexes across all tables for query optimization.

**Foreign keys:** Enforced at application layer (D1/SQLite doesn't support FK constraints).

### Migrations

`db/migrations/` (5 files):
1. `0002_fix_loyalty_signup.sql`
2. `20260419_01_payments_txid_index.sql`
3. `20260530_03_loyalty_v3_tier_checkin_referral.sql`
4. `20260606_06_referral_edge_cases.sql`
5. `20260606_07_missing_loyalty_tables.sql`

### Seed Data

`db/seed-promotions.sql` — Pre-populated promo codes:
- `AURA20` (20% off, expires 2026-06-06)
- `AURA10` (10% off, expires 2026-06-13)
- `WELCOME` (permanent 10% off)

---

## Deployment Topology

### Build Process (`vite.config.js`)

1. **HTML discovery:** Auto-detect `.html` in root + `/admin` + `/signup` (excludes templates)
2. **CSS/JS bundling:** Vite processes imports, produces hashed assets
3. **Copy assets:** Plugins copy `css/`, `js/`, `_redirects`, `_worker.js` to `dist/`
4. **Minify:** Terser (JS), CSSNano (CSS)
5. **Output:** `dist/` ready for Cloudflare Pages

### Cloudflare Pages Setup

**Build command:** `npm run build`  
**Output directory:** `dist/`  
**Environment variables:** Set in Pages dashboard (none required for basic operation)

**Bindings (wrangler.toml / Pages config):**
- `D1_DATABASE` → `AURA_DB`
- `KV_NAMESPACE` → `AUTH_KV`

### CI/CD

GitHub Actions (expected in `.github/workflows/`):
1. `lint` — ESLint check
2. `test` — Jest unit tests
3. `build` — Vite production build
4. `deploy` — Automatic on main branch push to Cloudflare Pages

---

## External Integrations (12 Pillars)

| Pillar | Status | Integration Points | Notes |
|--------|--------|-------------------|-------|
| **ERPNext** | 🟡 Migration In Progress (Phase 01-07 done, Phase 08 blocked on credentials) | REST API via Workers: Sales Invoice (Phase 1), Item/Bin for POS (Phase 2), Lead/Customer doctypes for CRM (Phase 3). ADR 0016-0018 | Replaced Odoo JSON-RPC with ERPNext REST. 10 new files, same sync table reuse. Phase 07 cleanup complete (22 Odoo files deleted). Phase 08 blocked: needs ERPNext credentials for E2E testing |
| **Cal.com** | 🟢 Phase 01-02 Done, Phase 03 Finalizing | Webhook receiver + Cal.com embed widget | Webhook at `/api/webhooks/cal-booking` handles create/cancel/reschedule. Auto-allocates tables via capacity + zone. Idempotent via `cal_booking_uid`. Cal.com popup widget on table-reservation page |
| **OpenWISP** | 🟡 Planned | WiFi captive portal | Social login planned |
| **pretix** | 🟢 Complete | CF Worker Bridge → pretix Docker (VPS:9001) → PostgreSQL + Redis. 6 API endpoints (events, orders, webhook, check-in, generate). HMAC-SHA256 webhook validation. QR-code check-in proxy. pretix JS widget embed. `ticket_orders` D1 table for order sync. 25 tests passing | Pillar 07/12 done (2026-07-01). 4 new files. See `docs/pretix-setup-guide.md` |
| **TastyIgniter** | 🟡 Planned | Online ordering migration | Current system standalone |
| **Xibo/Anthias** | 🟢 Complete | CF Worker API endpoints (2) + Xibo CMS v4.4.3 (Docker) + Xibo Player (RPi 5) → HDMI → TV. 3 self-contained HTML widgets (menu-board, promo-screen, welcome-screen), zero CDN, offline-capable. Public read-only endpoints with 5-min cache. 30 tests | Docker CMS on Cloud VPS (2GB RAM). Reads existing D1 tables only (menu, categories, promotions). No new DB tables required |
| **Mautic** | 🟢 Complete | One-way D1→Mautic sync via Workers cron. OAuth2 client credentials. Contact upsert, segment assignment (tier/recency/birthday month), campaign enrollment triggers (winback, birthday, promo). Channels: Resend email + SpeedSMS SMS + existing Zalo ZNS. 73 tests passing | Phase 04 done (2026-06-30). 10 new files. `campaign_enrollments` table added to schema |
| **Home Assistant** | 🟡 Partial | HVAC/lighting control | Basic webhook triggers |
| **Frigate** | 🟡 Partial | CCTV heatmap | AI detection not integrated |
| **VNPay/MoMo/SePay** | ✅ Integrated | Payment processing via PayOS webhook | Production |
| **Mixpost** | 🟢 Complete | CF Worker Bridge → Mixpost Docker (VPS:9000) → Facebook/Instagram. 4 API endpoints (posts, generate, accounts, list). 3 cron jobs (daily specials 07:00, new promos 08:00, weekly highlights Mon 09:00). Content templates for promotions + daily specials + best sellers. Bilingual setup guide. 33 tests passing | Phase 04 done (2026-07-01). 4 new files. No new DB tables (reads from products, promotions, categories). See `docs/mixpost-setup-guide.md` |
| **SMTP** | ✅ Enhanced | Transactional emails via SendGrid (100/day). Marketing emails via Resend (3,000/mo). SMS via SpeedSMS (490 VND/SMS). Campaign-templated winback/birthday/promo | Order confirm, receipt, welcome, e-invoice PDF notice. 73 Mautic tests + 14 SendGrid tests |

---

## Security Architecture

### Threat Model

| Threat | Mitigation |
|--------|------------|
| **Brute force auth** | Rate limiting (20/5min), IP-based |
| **Session hijacking** | JWT with short expiry, HTTPS only |
| **XSS** | CSP headers, no innerHTML without sanitization |
| **CSRF** | SameSite cookies, CORS strict |
| **SQL injection** | Parameterized queries only (D1 prepared statements) |
| **DoS** | Cloudflare rate limits + Workers auto-scaling |
| **Data leakage** | Encrypted D1 backups, KV encrypted at rest |
| **Secret exposure** | Wrangler secrets, `.env` in `.gitignore` |

### Access Controls

- **Owner:** Full access, can bootstrap, register staff, view all data
- **Staff:** Can manage orders, tables, reservations, menu items
- **Customer:** Self-service via public pages, limited to own data

### Compliance

- **Vietnamese e-invoicing:** Pending ERPNext integration (2025-06 mandate)
- **Data retention:** D1 backups retained 30 days (Cloudflare default)
- **GDPR-ish:** Customer data deletion via admin endpoint (implement if needed)

---

## Scalability Considerations

### Cloudflare Free Tier Limits (Current)

| Resource | Limit | Current usage | Headroom |
|----------|-------|---------------|----------|
| Workers requests | 100k/day | ~500/day | 99.5% |
| D1 storage | 5 GB | ~10 MB | 99.8% |
| KV reads | 1k/day | ~50/day | 95% |
| Bandwidth | 10 GB/day | ~100 MB/day | 99% |

**Conclusion:** No scaling concerns for single-location cafe. Upgrade to $5/mo plan if traffic grows 10x.

### Bottlenecks

- **D1 connection pooling:** Workers reuse connections automatically
- **KV rate limits:** 1k ops/day is tight for rate limiting; KV is per-namespace aggregate
- **Worker CPU time:** 10ms per request typical; stays well under 50ms limit

### Multi-location Future

If expanding to multiple cafes:
- **Database:** Split per-location (tenant_id column) or separate D1 databases
- **Auth:** Multi-tenant JWT claims
- **Config:** Location-specific in `mekong.config.yaml` instances

---

## Observability

### Health Checks

`GET /api/health` returns:
```json
{ "status": "ok", "ts": "2025-06-19T10:30:00Z" }
```

Used by: Cloudflare Pages uptime monitor, load balancers.

### Logging

- **Console logs** captured by Cloudflare Workers logs (accessible in dashboard)
- **Audit logs** written to `state/gates/audit-*.json` (git-tracked for forensic)
- **Error reporting:** Global error handler logs to console (consider Sentry if needed)

### Metrics

No built-in metrics dashboard yet. Consider:
- Cloudflare Analytics (requests, bandwidth, errors)
- Custom dashboard via `GET /api/stats` (orders, revenue, top products)

---

## Development Workflow

1. **Clone & setup:** `npm install` (root) + `cd worker && npm install`
2. **Dev server:** `npm run dev` (Vite on :8081) + `wrangler dev` (Worker)
3. **Lint:** `npm run lint` (ESLint 9.0)
4. **Test:** `npm test` (Jest) or `npm run test:ci` (CI mode)
5. **Build:** `npm run build` → `dist/`
6. **Deploy:** `npm run deploy` (Cloudflare Pages)

**Database changes:** Manual migrations in `db/migrations/` (versioned SQL).

---

## Key Design Decisions (See 06_ADR/ for full ADRs)

- **ADR-001:** Use Cloudflare Workers over traditional VPS → Serverless, auto-scaling, $0 Free Tier
- **ADR-002:** D1 SQLite vs PostgreSQL → Simplicity, sufficient for single-location, no operational overhead
- **ADR-003:** Static HTML + Vanilla JS vs React/Vue → Faster load, no build complexity, sufficient for needs
- **ADR-004:** Hono framework vs plain Workers → Built-in routing, middleware, clean structure
- **ADR-005:** JWT auth vs sessions → Stateless, scalable, Cloudflare KV backing
- **ADR-006:** Bazi v5.1 design system → Founder's cultural requirement, brand differentiation
- **ADR-007:** Rate limiting at Worker layer → Prevent abuse before DB hit
- **ADR-008:** Audit logging to git-tracked files → Immutable trail, easy review
- **ADR-009:** Payment webhook sync (not polling) → Real-time, reliable, idempotent
- **ADR-010:** KDS polling (3s) vs WebSocket → Simpler, sufficient for small kitchen
- **ADR-013:** Odoo Accounting → JSON-RPC 2.0 via Workers, retry queue + exponential backoff *(Superseded by ADR-0016)*
- **ADR-014:** Odoo POS Sync → KV-cached availability (30s TTL), delta cron sync, field whitelist *(Superseded by ADR-0017)*
- **ADR-015:** Odoo CRM Sync → Bidirectional D1<->Odoo, consent before create, loyalty tier mapping *(Superseded by ADR-0018)*
- **ADR-016:** ERPNext Accounting → REST API, token auth, Sales Invoice doctype, retry queue reuse
- **ADR-017:** ERPNext POS Sync → Item/Bin REST, delta via modified timestamp, KV cache reuse
- **ADR-018:** ERPNext CRM Sync → Lead/Customer doctypes, _user_tags, one-way D1→ERPNext, consent gate

---

**Related docs:**
- `02_AGENTS.md` — Agent roles for development
- `04_ROADMAP.md` — Timeline and milestones
- `05_TASKS/` — Detailed task breakdowns by domain
- `06_ADR/` — Architecture Decision Records
- `07_EVALUATION.md` — KPIs and monitoring
- `08_BUSINESS_MODEL.md` — Revenue and cost structure
- `09_BEHAVIOR_GRAPH.md` — User journey maps
- `10_RISK_REGISTER.md` — Risk management

---

*Last updated: 2026-07-01 — pretix Event Ticketing Bridge complete (CF Worker Bridge → pretix Docker, 6 endpoints, 25 tests). Mixpost Social Media Bridge complete. Xibo Digital Signage complete. See `docs/pretix-setup-guide.md`, `docs/xibo-setup-guide.md`, and `docs/mixpost-setup-guide.md`*
