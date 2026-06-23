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
│  │  - 23 route modules                                  │  │
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

**Total endpoints:** ~40+ routes  
**Total pages:** 35+ HTML pages  
**Database tables:** 11 tables  
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
- `POST (scheduled)` — Daily cron: `checkOverdueOrders()`

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

---

## Database Layer (D1 SQLite)

### Schema Overview

**11 tables:**

1. **categories** — Menu categories (id, name, description)
2. **products** — Menu items linked to categories (price, image_url, is_available)
3. **users** — Customers (phone unique, tier: Silver/Gold/Platinum, total_points)
4. **rewards** — Loyalty rewards (point_cost, discount_type, discount_value)
5. **cafe_tables** — Table inventory (table_number unique, capacity, zone, status)
6. **reservations** — Bookings (linked to tables, date/time, status)
7. **orders** — Customer orders (status: 'Bep tiep nhan' etc., subtotal, total)
8. **order_items** — Line items (product, quantity, modifiers)
9. **payments** — Payment records (gateway, transaction_id, status)
10. **promotions** — Discount codes (percent, usage limits, expiry)
11. **staff_shifts** — Time clock records (staff_email, clock_in/out)

**Indexes:** 12 indexes across tables for query optimization.

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
| **Odoo** | 🟡 Partial | POS sync, accounting | Not fully integrated yet |
| **Cal.com** | 🟡 Planned | Room/event booking | API not yet connected |
| **OpenWISP** | 🟡 Planned | WiFi captive portal | Social login planned |
| **pretix** | 🟡 Planned | Event ticketing | Not started |
| **TastyIgniter** | 🟡 Planned | Online ordering migration | Current system standalone |
| **Xibo/Anthias** | ❌ Not applied | Digital signage | Manual screens |
| **Mautic** | 🟡 Planned | Email marketing automation | SMTP configured? |
| **Home Assistant** | 🟡 Partial | HVAC/lighting control | Basic webhook triggers |
| **Frigate** | 🟡 Partial | CCTV heatmap | AI detection not integrated |
| **VNPay/MoMo/SePay** | ✅ Integrated | Payment processing via PayOS webhook | Production |
| **Mixpost** | 🟡 Planned | Social media scheduling | Not implemented |
| **SMTP** | ✅ Basic | Transactional emails (Nodemailer) | Gmail/transactional service |

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

- **Vietnamese e-invoicing:** Pending Odoo integration (2025-06 mandate)
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

*Last updated: 2025-06-19 — Initial documentation conversion*
