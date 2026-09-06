# Architecture & UI/UX Audit Report — F&B Container Caffe

**Generated:** 2026-08-25 22:36  
**Scope:** Full-stack audit of backend (Cloudflare Workers + D1) and frontend (React + Vite + Tailwind)  
**Trigger:** `/audit-plan` + `/architecture-review` with `--auto --parallel`

---

## Executive Summary

| Layer | Status | Risk Level | Key Finding |
|-------|--------|------------|-------------|
| **Backend Architecture** | ✅ Solid | Low | Clean Hono router, modular routes, Durable Objects for realtime |
| **Database (D1)** | ✅ Solid | Low | Normalized schema, 42 tables, proper indexes, Time Travel (30-day PITR) |
| **Auth & Security** | ✅ Strong | Low | JWT + KV revocation, RBAC, audit logs, rate limits, CORS allowlist |
| **Observability** | ✅ Complete | Low | Correlation IDs, structured logging, health degraded state, KDS SLA alerts |
| **Payments (PayOS)** | ✅ Hardened | Low | Idempotent create-link, atomic webhook, race guards, out-of-order handling |
| **Deployment Gates** | ✅ Ready | Low | Preflight, typecheck, 1533 tests, health check, 12 smoke tests, rollback |
| **Frontend Architecture** | ⚠️ Mixed | Medium | React 19 + Vite + Tailwind v4, but large page count (57+), duplicate files |
| **UI/UX Consistency** | ⚠️ Partial | Medium | DESIGN.md tokens defined, but enforcement across 142 admin pages unclear |

---

## 1. Backend Architecture (Worker)

### 1.1 Router & Middleware Stack
```
Hono app
├── logger (structured JSON + correlation ID)
├── cors (ALLOWED_ORIGIN_PATTERNS — no wildcard)
├── errorHandler (global)
├── routes (50+ modules mounted at /api/*)
└── cron (every 5 min — SLA overdue check)
```

### 1.2 Route Organization (50+ modules)
| Category | Files | Auth Coverage |
|----------|-------|---------------|
| **Core POS** | orders-hono, products, categories, tables, checkin | ✅ requireAuth on mutations |
| **Payments** | webhook, webhook-payos, webhook-legacy, payment-links | ✅ HMAC verify + idempotency |
| **Admin** | admin-audit-logs, admin-handlers, admin-loyalty, admin-metrics, admin-qr, admin-sales | ✅ owner/staff roles |
| **Auth** | auth, auth-register, auth-session, auth-verify, auth-verify-fixed | ✅ JWT + KV revocation |
| **Analytics** | analytics-hono, loyalty, campaigns, birthday | ✅ owner role |
| **Integrations** | erpnext, dindin, cal-booking-webhook, mixpost, pretix, mautic | Varies |
| **Realtime** | broadcast, OrderBroadcaster (Durable Object) | DO auth via WebSocket handshake |

### 1.3 Durable Objects
- **OrderBroadcaster** — WebSocket fan-out for realtime order updates to KDS
- Single class, SQLite-backed, scales per order ID

### 1.4 Security Controls (Phase 4 Complete)
- **JWT verification** with `AUTH_KV` revocation check (`revoked:{token}`)
- **RBAC**: `requireAuth(['owner'])`, `requireAuth(['owner','staff'])`, `requireAuth(['owner','staff','manager'])`
- **Rate limits**: AUTH (20/5min), ORDER (5/10min), webhook (provider-limited)
- **CORS**: `ALLOWED_ORIGIN_PATTERNS` restricts to prod domains, preview, localhost
- **Audit log**: Full schema — actor_id, actor_name, action, resource_type, resource_id, details, ip_address, created_at
- **Input validation**: Zod schemas on all mutations (`createProductSchema`, `updateProductSchema`, etc.)
- **Headers**: X-Request-ID correlation on all routes

---

## 2. Database (D1) — Schema & Operations

### 2.1 Core Tables (42 total)
| Domain | Tables | Row Counts (prod) |
|--------|--------|-------------------|
| **Menu** | categories (10), products (49), cafe_tables | Verified via backup |
| **Orders** | orders (89), order_items, payments (14), refunds | Verified via backup |
| **Users** | users (6 seeded), staff_shifts (4), audit_logs (0) | Fresh seed |
| **Loyalty** | customers (20), loyalty_transactions, loyalty_tiers | Verified via backup |
| **Inventory** | inventory_items, inventory_movements, supplier_orders | Verified via backup |
| **System** | settings, cron_jobs, webhook_logs, idempotency_keys | Verified via backup |

### 2.2 Backup & Restore (Phase 5 Complete)
- **Primary**: D1 Time Travel (30-day PITR) — bookmark `0000064a-...` captured
- **Secondary**: SQL export via `scripts/backup-d1.sh` (156KB, 42 tables)
- **Restore**: `scripts/restore-d1.sh` with confirmation prompt
- **Runbooks**: `docs/runbook-d1-backup-restore.md`, `docs/runbook-deploy-rollback.md`
- ⚠️ **Residual**: Staging DB quota limit — restore drill pending

### 2.3 Migrations
- 13 migration files in `migrations/` (numbered 0001–0013)
- Applied via `wrangler d1 migrations apply fnb-caffe-db --remote`

---

## 3. Frontend Architecture

### 3.1 Stack
| Layer | Technology | Version |
|-------|------------|---------|
| Framework | React | 19.2.17 |
| Build | Vite | 8.0.3 |
| Styling | Tailwind CSS | 4.3.2 |
| Routing | React Router | 7.x (in routes/) |
| State | TanStack Query | 5.101.2, Zustand |
| i18n | i18next + react-i18next | Latest |
| Icons | Lucide React | Latest |
| Testing | Vitest + Playwright | 4.1.9 / 1.60.0 |

### 3.2 Page Structure (57+ pages)
```
src/pages/
├── Public (11 pages): index, menu, checkout, success, failure, loyalty, track-order, kds, table-reservation, about, contact
├── Auth (account/): Login, Register, Profile, ForgotPassword, ResetPassword
├── Admin (142 files under admin/): Dashboard, Orders, Products, Categories, Tables, Users, Analytics, Settings, Loyalty, Campaigns, etc.
└── [locale]/: vi, en locale routing
```

### 3.3 Component Organization
```
src/components/
├── ui/ (33 files) — Button, Card, Input, Modal, Toast, etc. (shadcn-style)
├── layout/ — Header, Footer, Sidebar, Navigation
├── admin/ — Admin-specific components
├── pos/ — POS-specific components
├── kds/ — Kitchen Display System components
└── common/ — Shared utilities
```

### 3.4 Build Configuration
- **Chunking**: vendor-react, vendor-i18n, vendor-ui, vendor-query
- **Minification**: terser (mangle: true, drop_console: false)
- **Output**: `dist/` with `_redirects` and `_headers` copied for Cloudflare Pages
- **CSP**: Configured via `_headers` for Pages deployment

---

## 4. UI/UX Design System (DESIGN.md)

### 4.1 Theme: "AURA CAFE — Industrial Luxury"
- **Mode**: Dark (primary)
- **Primary**: `#b8c7e2` (Silver-blue) — Material 3 primary
- **Secondary**: `#c6c6c7` (Chrome/silver metallic)
- **Tertiary**: `#efbd8a` (Warm bronze) — CTAs, highlights
- **Surface**: `#14181f` (Dark charcoal) — cards, containers
- **Background**: `#0a0d12` (Near-black) — page background

### 4.2 Material 3 Compliance
- Color tokens follow M3 palette (primary, secondary, tertiary, error, surface, background)
- Typography scale: display/headline/title/body/label (CSS custom properties)
- Shape tokens: corner-small/medium/large/extra-large/full
- Elevation: level-1 through level-5 (box-shadow tokens)

### 4.3 Glassmorphism System
- `glass-surface`: `rgba(20, 24, 31, 0.8)` + `blur(20px)` + border
- `glass-card`: Same with subtle shadow
- `glass-nav`: Navigation-specific variant

### 4.4 Spacing & Layout
- Base unit: 8px rhythm (`space-1` through `space-24`)
- Container max-widths: sm(640), md(768), lg(1024), xl(1280), 2xl(1536)
- Breakpoints: mobile(320), tablet(768), desktop(1024), wide(1440)

### 4.5 Do/Don't Enforcement
| Do | Don't |
|----|-------|
| Dark backgrounds + chrome accents | Bright/light backgrounds |
| Glassmorphism on cards/containers | Stacked glass surfaces |
| Lucide/SVG icons | Emoji for icons |
| Gradient mesh hero backgrounds | Heavy shadows |
| Generous whitespace | Overuse bronze accent |

---

## 5. Gaps & Risks

### 5.1 Frontend — High Priority
| Issue | Impact | Effort | Recommendation |
|-------|--------|--------|----------------|
| **142 admin page files** — potential duplication, inconsistent patterns | Maintenance burden, bug surface | High | Audit admin/ tree; consolidate shared patterns; enforce component library |
| **Duplicate files** — `TableOrder*.tsx`, `TableReservation*.tsx` split across files | Code splitting unclear, testing gaps | Medium | Reassess component boundaries; unify or document pattern |
| **No visual regression testing** — Playwright configured but no baseline screenshots | UI drift undetected | Medium | Add Playwright visual tests for critical pages (menu, checkout, KDS, admin dashboards) |
| **DESIGN.md token enforcement** — no automated check (e.g., stylelint, tailwind config sync) | Design drift | Low | Add `stylelint` with custom rules mapping to DESIGN.md tokens |

### 5.2 Backend — Medium Priority
| Issue | Impact | Effort | Recommendation |
|-------|--------|--------|----------------|
| **50+ route files** — some overlap (auth-verify vs auth-verify-fixed) | Confusion, potential inconsistency | Low | Consolidate auth-verify variants; deprecate `.bak` files |
| **Integration routes** (erpnext, dindin, mixpost, pretix, mautic) — varying auth patterns | Security surface | Medium | Standardize integration auth; add to audit log |
| **Cron jobs** — 5 auto-post functions in single cron handler | Single point of failure | Low | Split into independent cron triggers |

### 5.3 Cross-Cutting — Low Priority
| Issue | Impact | Effort | Recommendation |
|-------|--------|--------|----------------|
| **No API contract docs** — OpenAPI/Swagger missing | Frontend-backend sync risk | Medium | Generate OpenAPI from Hono/Zod schemas |
| **E2E test coverage** — Playwright exists but limited scenarios | Deployment confidence | Medium | Expand Playwright to cover: order flow, payment, admin CRUD, KDS realtime |
| **Internationalization** — i18n configured but only vi/en, some hardcoded strings | Localization gaps | Low | Audit for hardcoded Vietnamese strings |

---

## 6. Test & Quality Status

| Suite | Status | Coverage |
|-------|--------|----------|
| **Backend (Vitest)** | ✅ 1533/1533 pass | Unit + integration (orders, payments, auth, webhooks) |
| **Frontend (Vitest)** | ✅ Component tests exist | Components, hooks, utils |
| **E2E (Playwright)** | ⚠️ Configured, limited specs | Smoke only |
| **Lint** | ✅ ESLint clean | TypeScript strict |
| **Typecheck** | ✅ `tsc --noEmit` passes | Strict mode |

---

## 7. Deployment Readiness

| Gate | Status | Evidence |
|------|--------|----------|
| Preflight checks | ✅ | `scripts/deploy.sh` — Node, Wrangler, git, secrets, D1 binding |
| Typecheck | ✅ | `npm run build` includes `tsc --noEmit` |
| Unit tests | ✅ | 1533/1533 pass |
| Health check | ✅ | `/api/health?db=1` retries 10×3s |
| Smoke tests | ✅ | 12 checks (health, version, menu, auth, orders, payment, webhook, CORS, correlation ID) |
| Rollback | ✅ | `scripts/deploy-rollback.sh` (Worker), `wrangler pages rollback` (Pages) |
| Runbooks | ✅ | `docs/runbook-deploy-rollback.md`, `docs/runbook-d1-backup-restore.md` |

---

## 8. Recommendations Priority Matrix

```
HIGH (Do before next deploy):
├── 1. Audit admin/ page tree — consolidate, remove duplicates, enforce component library
├── 2. Add visual regression tests for critical user flows
├── 3. Generate OpenAPI spec from Hono routes + Zod schemas

MEDIUM (Next sprint):
├── 4. Standardize integration route auth patterns
├── 5. Split cron jobs into independent triggers
├── 6. Add stylelint with DESIGN.md token rules

LOW (Backlog):
├── 7. Full i18n audit — replace hardcoded strings
├── 8. Deprecate auth-verify-fixed.ts, auth-verify.ts.bak
├── 9. Document component library in Storybook or similar
```

---

## 9. Compliance with Production Readiness Phases

| Phase | Requirement | Met? | Evidence |
|-------|-------------|------|----------|
| 1. Baseline & SLOs | SLO definitions, inventory | ✅ | `phase-01-baseline-and-slos.md` |
| 2. Observability | Correlation ID, logging, alerts, health degraded | ✅ | `phase-02-observability-and-diagnostics.md` |
| 3. Payment Reliability | Idempotent, atomic webhook, race guards | ✅ | `phase-03-payment-reliability.md` |
| 4. Security Controls | Auth, RBAC, rate limits, CORS, audit, Zod | ✅ | `phase-04-security-controls.md` |
| 5. Backup/Restore | Time Travel, scripts, runbook, integrity | ✅ | `phase-05-backup-restore.md` |
| 6. Release Gates | Deploy script, smoke tests, rollback, runbooks | ✅ | `phase-06-release-and-rollback.md` |
| 7. Final Review | Evidence-based PASS, risks documented | ✅ | `phase-07-final-readiness-review.md` |

---

## 10. Next Steps

1. **Immediate**: Run production deploy — `cd worker && bash scripts/deploy.sh`
2. **Week 1**: Execute HIGH-priority frontend audit (admin/ tree consolidation)
3. **Week 2**: Add visual regression tests + OpenAPI generation
4. **Month 1**: Complete MEDIUM items; schedule monthly restore drill

---

**Report Location:** `plans/reports/architecture-ui-ux-audit-260825-2236-report.md`  
**Plan Dir:** `plans/260825-2236-architecture-ui-ux-audit/`