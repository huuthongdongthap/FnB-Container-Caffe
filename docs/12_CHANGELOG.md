# Changelog

Tất cả các thay đổi đáng kể của dự án F&B Caffe Container được ghi lại tại đây.

## [Unreleased]

### 🔧 Odoo Integration — Phase 1: E-Invoicing

- **feat** - OdooClient base class: JSON-RPC 2.0, auth caching, retry with exponential backoff
- **feat** - OdooAccountingClient: order → invoice processing, PDF generation placeholder
- **feat** - Routes: `POST/GET /api/odoo/invoices`, `POST /api/odoo/invoices/:orderId/retry`
- **feat** - Admin routes for Odoo sync failure management
- **feat** - Fire-and-forget Odoo trigger on order completion
- **feat** - Enhanced cron retry queue with Odoo sync logging
- **feat** - Database tables: `odoo_mappings`, `odoo_invoices`, `odoo_sync_logs`
- **feat** - 144 unit tests passing (29 skipped for Phase 2/3)
- **feat** - Lint clean, all migrations applied to D1

### 🔧 Odoo Integration — Phase 2: POS (Sales Orders + Product Sync)

- **feat** - OdooProductClient: availability lookup with KV caching (30s TTL)
- **feat** - searchChangedProducts() for delta sync from Odoo
- **feat** - syncProductsToLocal() batch upsert to odoo_product_sync
- **feat** - updateOdooProduct() with field whitelist + cache invalidation
- **feat** - odoo-sales-mapper: mapOrderToSaleOrder, mapOrderItemToSaleOrderLine, mapCustomerToOdooPartner
- **feat** - POST /api/odoo/sales-orders — create SO from local order (idempotent)
- **feat** - GET /api/odoo/products/:productId/availability — KV-cached stock check
- **feat** - POST /api/odoo/products/sync — delta sync from Odoo to local DB
- **feat** - Migration 002: odoo_product_sync + odoo_sync_failures tables

### 🔧 Odoo Integration — Phase 3: CRM Sync

- **feat** - OdooCrmClient: createLead, updatePartner, addTag, removeTag, getPartnerInfo
- **feat** - mapLoyaltyTier: bronze→Bronze Member, silver→Silver, gold→Gold, platinum→VIP
- **feat** - POST /api/odoo/leads — create lead from customer signup (consent-aware)
- **feat** - GET /api/odoo/customers/:customerId/notes — pull Odoo partner info
- **feat** - POST /api/odoo/customers/:customerId/tags — add loyalty tier tag
- **feat** - Migration 003: odoo_customer_consent table for GDPR compliance

### 🔧 SMTP Transactional Email (SendGrid)

- **feat** - SendGrid HTTP API wrapper (`worker/src/lib/email.js`) with 10s timeout, fire-and-forget pattern, ctx.waitUntil() support
- **feat** - Order confirmation template (`worker/src/templates/order-confirm.js`) -- Vietnamese layout, itemized table, Aura Cafe branding (#0A1A2E Navy, #C9D6DF Chrome)
- **feat** - Payment receipt template (`worker/src/templates/receipt.js`) -- Vietnamese layout, green success header, payment details
- **feat** - Welcome email template (`worker/src/templates/welcome.js`) -- HTML escaping for XSS prevention, loyalty tier display
- **feat** - Fire-and-forget email triggers in order creation (orders.js), payment webhook (webhooks.js), registration (auth.js), and e-invoice with PDF URL (odoo-invoices.js)
- **feat** - 14 unit tests (`tests/email.test.js`) covering utility validation, template rendering, edge cases
- **chore** - Updated `.env.example` with SENDGRID_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME

### 🎯 Features

- **feat(kds)** - Realtime order tracking integration using HTTP polling:
  - KDS: 3-second polling with `KdsPollClient`, auto-refresh on status changes
  - Track Order page: 5-second polling with animated timeline updates
  - Success page: Real-time progress bar with toast notifications
  - KDS stats: Now fetch real counts from API instead of hardcoded
  - Sound notifications: Web Audio API beeps for new orders (800Hz) and ready status (1200Hz)
  - All WebSocket dead code removed
  - 556 tests passing, lint clean, production ready
  - See: `plans/260626-1412-realtime-order-tracking-integration/`

### 📚 Documentation

- **docs** - Complete documentation overhaul with standardized 12-docs structure:
  - `00_FOUNDER_MANIFESTO.md` — Vision, mission, values, Bazi principles
  - `01_GOAL.md` — Project objectives, success metrics, scope
  - `02_AGENTS.md` — Agent catalog and usage guide
  - `03_ARCHITECTURE.md` — System architecture, components, data flows
  - `04_ROADMAP.md` — Timeline, milestones, phase planning
  - `05_TASKS/` — Task breakdowns by domain (orders, loyalty, menu, reservations, payments, admin, integration, infrastructure)
  - `06_ADR/` — 12 Architecture Decision Records
  - `07_EVALUATION.md` — KPIs, evaluation framework, monitoring
  - `08_BUSINESS_MODEL.md` — Revenue streams, cost structure, unit economics
  - `09_BEHAVIOR_GRAPH.md` — User journey maps, touchpoints
  - `10_RISK_REGISTER.md` — Risk inventory with mitigation plans
  - `11_GLOSSARY.md` — Terms, acronyms, concepts
  - `12_CHANGELOG.md` — This file, updated
- **docs** - Created `docs/README.md` navigation hub for documentation
- **prompts** - Added `prompts/` directory with 5 prompt files (goal, architect, reviewer, security, business)
- **github** - Added `.github/pull_request_template.md`

### 🏗️ Architecture

- **ADR** - Added 12 Architecture Decision Records covering:
  - Cloudflare Workers platform choice
  - D1 SQLite vs PostgreSQL
  - Static HTML vs SPA frameworks
  - Hono framework adoption
  - JWT authentication
  - Bazi v5.1 design system
  - Rate limiting at Worker layer
  - Audit logging to git-tracked files
  - Payment webhook vs polling
  - KDS polling vs WebSocket
  - PayOS as primary gateway
  - Multi-tier loyalty structure

## [v2.1.0] - 2026-03-31

### 🔧 Maintenance & Cleanup

#### Production Code Quality
- **cleanup** - Xóa 4 console.log còn lại trong js/ (chỉ giữ console.error)
- **fix** - Resolve 2 TODO comments trong checkout.js và config.js về PayOS configuration
- **docs** - Cập nhật README.md với Quick Start section và 11 API endpoints

#### Infrastructure Cleanup
- **cleanup(python)** - Xóa legacy Python files không sử dụng
- **cleanup(test)** - Fix test environment configuration
- **cleanup(root)** - Dọn dẹp files ở root directory
- **git** - Removed .min files khỏi git tracking (CSS/JS minified assets)

#### Version Sync
- **version** - Sync version across package.json, README, CHANGELOG

---

## [v2.0.0] - 2026-03-17

### 🎉 Major Features

#### Cloudflare Migration
- Di chuyển toàn bộ infrastructure sang Cloudflare Pages
- Tích hợp Cloudflare Workers cho edge computing
- Cloudflare D1 database cho lưu trữ dữ liệu
- Cloudflare KV cho auth session storage
- Tối ưu performance với CDN toàn cầu

#### Revenue Engine
- Hệ thống thanh toán đa dạng: COD, MoMo, VNPay, PayOS
- Integration với PayOS production gateway
- Checkout flow tối ưu với QR code payment
- Tự động hóa quy trình xử lý đơn hàng
- Delivery fee calculation theo ward distance
- Free delivery threshold từ 500K → 300K

#### Happy Hour System
- Automatic happy hour detection (2:00 PM - 4:00 PM)
- 20% discount cho tất cả đồ uống
- Visual indicators trong menu
- Auto-apply discount khi checkout

#### Loyalty & Referral Program
- Referral code system cho khách hàng
- 30% commission cho referrer
- 15% discount cho người được giới thiệu
- Commission tracking dashboard
- Withdrawal request system
- Multi-tier loyalty program (Bronze, Silver, Gold, Platinum)

#### Churn Prevention
- 30-day inactive customer detection
- Targeted promo campaigns
- Win-back discount codes
- Customer engagement analytics

#### PWA Features
- Offline mode với service worker
- Add to home screen support
- Push notifications
- App-like experience trên mobile
- Manifest.json với icons

#### SEO Optimization
- Meta tags optimization
- Open Graph tags
- Twitter Card tags
- Structured data (JSON-LD)
- Sitemap generation
- Robots.txt configuration

### 🎨 Design System

#### Material Design 3
- Fully implemented M3 design tokens
- Color system với primary, secondary, tertiary palettes
- Typography scale chuẩn M3
- Component library đồng bộ
- Dark mode support
- Responsive design với breakpoints

### 🛠️ Technical Improvements

#### Testing
- 576 unit tests với Jest
- 14 test suites covering all major features
- Test coverage cho checkout, loyalty, menu, i18n
- Automated testing trong CI/CD

#### Performance
- CSS minification với clean-css
- JavaScript minification với terser
- Image optimization với WebP
- Lazy loading cho images
- Critical CSS inlining
- Code splitting

### 🔧 Fixed Issues

- PayOS clientId hardcoded → environment variable
- Delivery fee threshold từ 500K → 300K
- Font families cập nhật sang Space Grotesk/Inter
- Test failures do class name mismatches
- Mock fetch issues trong tests
- i18n translation keys

---

## [v5.0.0] - 2026-03-14

### 🎉 Features (Tính năng mới)
- **feat(loyalty)** - Thêm chương trình Loyalty Rewards cho khách hàng thân thiết (#2a9de0e69)
- **feat(seo)** - Thêm SEO metadata, PWA service worker support (#66b92ae0b)
- **feat(menu)** - Menu page với filtering, gallery lightbox và JSON data (#37aaf15a6)
- **feat(dashboard)** - Admin dashboard với Order Management, Analytics integration (#9b6dfbf07, #a2fe589c4)
- **feat(fnB-caffe-container)** - Order System, Dark Mode, Responsive và SEO/PWA (#204ea0a76)
- **feat(theme)** - Cập nhật F&B color palette với warm coffee tones + ☕ favicon (#9f277a627)

### 🐛 Bug Fixes
- **fix(responsive)** - Thêm breakpoint styles cho 375px trên menu, dashboard, KDS (#9556d5886)
- **fix(tests)** - Điều chỉnh console.log threshold cho dashboard API logging (#630a8ad24)

### 📦 Performance & Cleanup
- **chore(perf)** - Minify CSS/JS assets và clean console.log production code (#e83b56abf)
- **refactor** - Remove console.log statements từ dashboard.js (#3a733acf7)

### 📚 Documentation
- Admin dashboard verification report (#4d433b7c1)
- Project complete report (#79a8dc39e)
- Responsive fix report với breakpoint audit (#32834b668)
- Frontend UI build report cho admin dashboard (#99c9414f7)
- Release notes v4.42.0 (#88c713d5a)

---

## [v4.42.0] - 2026-03-13

### Features
- Release notes v4.42.0 và fix tests (#88c713d5a)

---

## [v1.0.0] - 2026-03-10

### 🚀 Initial Release
- F&B Caffe Container Initial Launch (#0df1b0c0f)
- Complete F&B Container website build (#e98a4fae7)

---

## Version History

| Version | Date | Description |
|---------|------|-------------|
| v2.1.0 | 2026-03-31 | Production cleanup: console.log removal, TODO resolution, Python legacy cleanup, test environment fixes, .min files removed from git |
| v2.0.0 | 2026-03-17 | Cloudflare migration, Revenue Engine, Happy Hour, Loyalty Referral, Churn Prevention, PWA, SEO |
| v5.0.0 | 2026-03-14 | Loyalty program, PWA, SEO, Admin dashboard |
| v4.42.0 | 2026-03-13 | Cleanup và performance improvements |
| v1.0.0 | 2026-03-10 | Initial launch |

---

## Semantic Versioning

Dự án tuân theo [Semantic Versioning](https://semver.org/):
- **MAJOR** - Thay đổi không tương thích ngược
- **MINOR** - Tính năng mới, tương thích ngược
- **PATCH** - Bug fixes, tương thích ngược
