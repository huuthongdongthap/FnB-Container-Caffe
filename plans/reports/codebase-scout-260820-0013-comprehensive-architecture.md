# AURA CAFE — Comprehensive Architecture Scan

**Date:** 2026-08-20 | **Scout:** codebase-scout | **Scope:** Full codebase audit

---

## 1. EXECUTIVE SUMMARY

AURA CAFE is a full-stack F&B management system for a container cafe in Sa Dec, Vietnam. It is a **monorepo** with two deployment targets: Cloudflare Pages (frontend) and Cloudflare Workers (backend). The codebase is **massive** — 141,000+ LOC across frontend + backend, with 261K LOC of tests.

| Metric | Value |
|--------|-------|
| Total src LOC (frontend) | 89,315 |
| Total worker LOC (backend) | 51,613 |
| Total test LOC | 261,186 |
| Frontend files (TS/TSX) | 1,180 |
| Worker files (TS/JS) | 362 |
| Test files | 1,443 |
| Zustand stores | 28 (customer + admin) |
| TanStack Query calls | 108 |
| Lazy-loaded routes | 86 |
| i18n keys | ~4,300 lines (vi + en) |
| DB schema | 583 SQL (D1/SQLite) |
| DB migrations | 11 files |

---

## 2. PROJECT STRUCTURE

```
FnB-Container-Caffe/
├── src/                          # Frontend (Vite + React 19 + TS + Tailwind v4)
│   ├── App.tsx                   # Root — QueryClient + AuthProvider + Router
│   ├── main.tsx                  # Entry — StrictMode, SW, web-vitals, brand-theme
│   ├── routes/                   # 4 route files (public, admin, stitch, mobile)
│   ├── pages/                    # Page-level components (admin/, stitch/, mobile/, etc.)
│   ├── components/               # 31 component directories
│   │   ├── stitch/               # 403 files, 30,115 LOC — LARGEST module
│   │   ├── admin/                # 45 files, 2,933 LOC
│   │   ├── ui/                   # 18 files, 1,048 LOC
│   │   └── ... (29 more dirs)
│   ├── hooks/                    # Custom hooks + Zustand stores
│   │   ├── stores/               # 17 files — customer stores
│   │   │   └── admin/            # 11 files — admin stores
│   │   └── (25 custom hook files)
│   ├── lib/                      # Shared utilities (api-client, i18n, offline-db, etc.)
│   ├── locales/                  # vi.json (2159 lines), en.json (2168 lines)
│   ├── styles/                   # brand-tokens.css (1528 lines), global.css (120 lines)
│   ├── config/                   # brand-theme.ts, brand-types.ts
│   └── __tests__/                # 4 integration test files
├── worker/                       # Backend (Hono + Cloudflare Workers + D1)
│   ├── src/
│   │   ├── index.ts              # 635 LOC — unified Hono router entry
│   │   ├── routes/               # 28 route files + 3 subdirs (18,303 LOC total)
│   │   ├── middleware/            # 12 files (auth, CORS, rate-limit, audit, tenant, etc.)
│   │   ├── lib/                  # 29 files (jwt, validators, erpnext-mapper, etc.)
│   │   ├── tree/                 # 18 domain modules (7,314 LOC) — business logic layer
│   │   ├── clients/              # 9 files (ERPNext, Frigate, TastyIgniter, etc.)
│   │   ├── types/                # Env type definitions
│   │   └── do/                   # Durable Object (OrderBroadcaster)
│   ├── schema.sql                # 583 LOC — D1 schema
│   ├── migrations/               # 11 SQL migration files
│   └── seed.sql                  # 17.4K seed data
├── tests/                        # E2E/integration tests (Playwright + Vitest)
├── docs/                         # 24 documentation files (43.7K architecture doc)
└── plans/                        # Plans and reports
```

---

## 3. FRONTEND ARCHITECTURE

### 3.1 Tech Stack
- **React 19** + TypeScript (ES2022, strict mode, `noUncheckedIndexedAccess`)
- **Vite 8** with Terser minification, manual chunk splitting (vendor-react, vendor-i18n, vendor-ui, vendor-query)
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin)
- **React Router DOM** — 4 route definition files, 86 lazy-loaded routes
- **TanStack React Query v5** — 108 query/mutation calls
- **Zustand** — 28 stores (17 customer-facing, 11 admin)
- **i18next** — vi/en with namespace auto-building from JSON
- **react-helmet-async** — SEO meta management
- **PWA** — Service worker registration, install prompt, offline banner
- **web-vitals** — LCP, CLS, INP, TTFB, FCP sent to `/api/vitals`

### 3.2 Routing Architecture
4 route definition files, all using `React.lazy()` for code-splitting:

| Route File | Lazy Imports | Purpose |
|------------|-------------|---------|
| `public-routes.tsx` | 31 | Customer-facing pages (home, menu, checkout, loyalty, etc.) |
| `admin-routes.tsx` | 28 | Admin panel (dashboard, orders, POS, KDS, customers, etc.) |
| `stitch-routes.tsx` | 22 | Stitch-designed premium UI variants |
| `mobile-routes.tsx` | 5 | Mobile staff interface (KDS, waiter orders, table manager) |

**Route pattern:** `App.tsx` wraps everything in `AuthProvider > ToastProvider > StitchAppLayout > Routes` with `CartBottomBar` and `OfflineBanner` as persistent UI.

### 3.3 Component Architecture (31 directories)

**Top 5 by LOC:**

| Directory | Files | LOC | Purpose |
|-----------|-------|-----|---------|
| `stitch/` | 403 | 30,115 | Premium UI redesign components (Stitch design system) |
| `admin/` | 45 | 2,933 | Admin panel components |
| `order/` | 22 | 1,655 | Order flow components |
| `loyalty/` | 16 | 1,165 | Loyalty/rewards components |
| `ui/` | 18 | 1,048 | Shared UI primitives |

**Stitch component pattern:** Flat file structure with naming convention `Stitch{Feature}.tsx` + companion files `Stitch{Feature}-{sub}.tsx` (hooks, types, constants, sub-components). 248 top-level files in stitch/ — a single massive flat directory.

### 3.4 State Management

**Zustand Stores (28 total):**

Customer stores (17 files in `stores/`):
- `use-order-store.ts` (113 LOC) — offline queue, SSE streaming, order lifecycle
- `use-cart-store.ts` (130 LOC) — localStorage persistence, migration from old format
- `use-loyalty-store.ts` (131 LOC) — tier, points, cashback, rewards
- `use-menu-store.ts` (154 LOC) — menu fetch, search, category extraction
- `use-auth-store.ts` (81 LOC) — httpOnly cookie auth, no client-side tokens
- Plus: referral, reservation, refund, contact, checkin, favorites, payment stores

Admin stores (11 files in `stores/admin/`):
- Admin orders, customers, dashboard, staff, shifts, reservations, metrics, performance, audit

**TanStack Query (108 calls):** Used primarily in custom hooks (`use-subscriptions`, `use-campaigns-admin`, `use-analytics-data`, `use-reviews`, `use-kds`, etc.) for server state management.

**State split pattern:** Zustand for client state (cart, auth, UI state). TanStack Query for server state (menu, orders, analytics). Some overlap exists.

### 3.5 API Client

`api-client.ts` (75 LOC) provides:
- `apiFetch<T>()` — centralized fetch wrapper with automatic auth headers
- Cookie-based auth (httpOnly `access_token`)
- Error interceptor pattern
- Error reporting via `sendBeacon`
- API base URL from `VITE_API_BASE` env var

---

## 4. BACKEND ARCHITECTURE

### 4.1 Tech Stack
- **Hono** — lightweight web framework on Cloudflare Workers
- **Cloudflare D1** — SQLite-based database
- **Cloudflare KV** — Auth token revocation
- **Cloudflare Durable Objects** — OrderBroadcaster (realtime fan-out)
- **Zod v4** — input validation
- **web-push** — Push notifications
- **Cron triggers** — SLA overdue check (every 5 min)

### 4.2 Worker Entry (`index.ts` — 635 LOC)
Unified Hono router mounting ~40 route modules. This is a **God Router** — a single file that imports and mounts every route. Route mounting includes:
- Public routes: `/api/menu`, `/api/orders`, `/api/auth/*`
- Protected routes: `/api/admin/*`, `/api/staff/*`
- Webhook routes: `/api/webhooks/*`
- Integration routes: ERPNext, Home Assistant, TastyIgniter, Frigate

### 4.3 Route Organization

**123 route files, 18,303 LOC total.** Largest:

| File | LOC | Purpose |
|------|-----|---------|
| `orders-hono.ts` | 463 | Order CRUD, KDS, checkout flow |
| `reports.ts` | 413 | Analytics, sales reports |
| `dindin.ts` | 361 | DinDin integration |
| `analytics-hono.ts` | 310 | Analytics endpoints |
| `payments.ts` | 276 | PayOS + COD payment processing |
| `staff-auth.ts` | 270 | Mobile staff authentication |
| `campaigns.ts` | 265 | Marketing campaigns |
| `promotions.ts` | 260 | Promotions/discount management |

### 4.4 Tree Directory (Domain Logic Layer)

18 domain modules, 100 files, 7,314 LOC. This is the **business logic layer** between routes and DB:

| Module | Files | LOC | Purpose |
|--------|-------|-----|---------|
| `campaigns/` | 15 | 1,064 | Marketing campaign execution |
| `orders/` | 11 | 1,025 | Order processing pipeline |
| `subscriptions/` | 8 | 867 | Subscription management |
| `loyalty/` | 8 | 697 | Loyalty points/tier logic |
| `auth/` | 12 | 640 | Authentication flows |
| `mautic/` | 12 | 640 | Mautic CRM integration |
| `analytics/` | 6 | 449 | Analytics computation |

### 4.5 Middleware Stack

12 middleware files:
- `auth.ts` — JWT verification + role-based access (customer/staff/waiter/manager/owner)
- `cors.ts` — CORS configuration
- `rate-limit.ts` + `rate-limit-login.ts` — Request throttling
- `audit-log.ts` — Audit logging
- `tenant.ts` — Multi-tenant isolation
- `error-handler.ts` — Global error handler
- `logger.ts` — Request logging
- `request-metrics.ts` — Performance metrics
- `staff-auth.ts` — Mobile staff auth
- `tier-gate.ts` — Feature gating by tier

### 4.6 External Integrations (Clients)

9 client files in `clients/`:
- ERPNext: `erpnext-client.ts` (440 LOC), `erpnext-crm-client.ts`, `erpnext-accounting-client.ts`, `erpnext-product-client.ts`
- Mautic: `mautic-client.ts` (429 LOC)
- Frigate: `frigate-client.ts` (NVR/camera integration)
- TastyIgniter: `tastyigniter-client.ts`
- Mixpost: `mixpost-client.ts`
- Pretix: `pretix-client.ts`

### 4.7 Database

- **D1 (SQLite)** — 583-line schema with 20+ tables
- Core tables: `orders`, `order_items`, `customers`, `products`, `categories`, `cafe_tables`, `payments`, `reservations`
- Advanced tables: `loyalty_points`, `loyalty_tier_config`, `referrals`, `subscriptions`, `invoices`, `promotions`, `campaigns`, `checkin_rewards`, `reviews`, `chat_messages`, `audit_logs`, `staff_shifts`
- 11 migration files

---

## 5. TESTING ARCHITECTURE

| Category | Files | LOC |
|----------|-------|-----|
| Total test files | 1,443 | 261,186 |
| Frontend unit/integration | 52 (in src/__tests__) | 12,788 |
| Admin tests | 62 | — |
| Stitch tests | 132 | — |
| Worker tests (in worker/src/__tests__) | ~1,200+ | ~200K+ |

**Test frameworks:** Vitest (unit), Playwright (E2E), Testing Library (component)

**Coverage concern:** Test-to-source ratio is very high (261K test vs 141K source), suggesting extensive test generation. Many tests may be auto-generated or cover very granular scenarios.

---

## 6. KEY ARCHITECTURE DECISIONS

### 6.1 Positives

1. **Cookie-based auth** — httpOnly cookies, no client-side JWT storage. Secure pattern.
2. **Code splitting** — All 86 routes are lazy-loaded via `React.lazy()`. Good for initial load.
3. **Manual chunk splitting** — Vite config separates vendor bundles (react, i18n, ui, query).
4. **Offline-first order flow** — Order store queues to IndexedDB when offline, syncs when online.
5. **Web Vitals tracking** — Built-in performance monitoring sent to backend.
6. **Domain layer (tree/)** — Business logic separated from route handlers. Clean layering.
7. **SSE for order updates** — Real-time order status via Server-Sent Events.
8. **Durable Objects** — OrderBroadcaster for realtime order fan-out (Cloudflare-native).
9. **Multi-tenant support** — Tenant middleware in backend.
10. **Cron-based SLA monitoring** — Automatic overdue order detection every 5 minutes.

### 6.2 Anti-Patterns & Concerns

#### CRITICAL

1. **God Router (worker/src/index.ts — 635 LOC)** — All 40+ route modules imported and mounted in a single file. Should be split into domain-specific routers imported by a thin orchestrator.

2. **Stitch flat monolith (403 files in one directory)** — `src/components/stitch/` is a flat directory with 403 files and 30K LOC. No subdirectory organization. The naming convention (`Stitch{Feature}-{sub}.tsx`) attempts to compensate but a directory-per-feature structure is needed.

3. **File size violations** — Several files exceed the 200 LOC guideline:
   - `worker/src/index.ts`: 635 LOC (God Router)
   - `worker/src/lib/erpnext-mapper.ts`: 702 LOC
   - `worker/src/lib/validators.ts`: 639 LOC
   - `worker/src/lib/alert-dispatcher.ts`: 474 LOC
   - `worker/src/routes/orders-hono.ts`: 463 LOC
   - Frontend: `src/pages/checkout.tsx` (218), `src/hooks/use-mobile-auth.tsx` (206), `src/components/ui/navbar.tsx` (205)

4. **Dual state management overlap** — Zustand stores and TanStack Query coexist with unclear boundaries. Some data is fetched via `apiFetch` in Zustand stores (loyalty, order, menu) while other data uses TanStack Query hooks. This creates two competing patterns for server state.

#### HIGH

5. **`any` type usage (78 occurrences in frontend)** — Despite strict TypeScript config, 78 `any` usages persist (26 in stores alone). Should use proper types.

6. **localStorage proliferation (44 usages)** — Heavy direct `localStorage` access across the codebase without a centralized storage abstraction. Cart, auth, loyalty, theme, locale all read/write localStorage directly.

7. **Worker routes under-abstracted** — Routes directly call D1 SQL or import tree modules. No shared route utilities for common patterns (pagination, error responses, input validation).

8. **Mixed file naming** — Admin pages use flat PascalCase files (`Dashboard.tsx`, `Orders.tsx`) while Stitch pages use directory-per-feature with `index.tsx`. Inconsistent patterns.

#### MEDIUM

9. **No shared UI component library** — `src/components/ui/` has only 18 files (1,048 LOC). For 89K LOC of frontend, the shared component layer is thin. Many components are likely duplicated across stitch/admin/page directories.

10. **brand-tokens.css at 1,528 lines** — A single CSS file with all brand tokens. Consider splitting into logical groups (colors, typography, spacing, animations).

11. **Test file bloat** — 1,443 test files generating 261K LOC is disproportionately high. Many test files may be auto-generated stubs with low signal-to-noise ratio.

12. **No API contract validation on frontend** — `apiFetch` does not validate response shapes. Backend uses Zod for input validation, but frontend trusts response types via TypeScript assertions.

13. **Backup file in codebase** — `worker/src/routes/birthday.ts.bak` should not be in version control.

---

## 7. DEPENDENCY MAP

### Frontend Key Dependencies
- React 19, React Router DOM, TanStack React Query v5
- Zustand (state), i18next + react-i18next (i18n)
- Lucide React (icons), clsx (classnames)
- Three.js, @react-three/fiber (3D features)
- Framer Motion (animations)
- react-helmet-async (SEO)
- PWA: service worker, web-push

### Backend Key Dependencies
- Hono (web framework)
- Zod v4 (validation)
- web-push (push notifications)
- qrcode (QR generation)
- @cloudflare/workers-types (CF types)

---

## 8. UNRESOLVED QUESTIONS

1. **Stitch migration status** — Is the Stitch redesign replacing the old pages or coexisting? Some old pages (checkout.tsx, menu.tsx) and Stitch variants both exist. What is the migration plan?

2. **Admin page split** — Admin pages (155 files, 12,502 LOC) are flat files without subdirectory structure. Should these be modularized like Stitch pages?

3. **DinDin integration** — `dindin.ts` is 361 LOC in routes + client files. Is this a core feature or experimental?

4. **ERPNext depth** — 4 ERPNext client files (erpnext-client, erpnext-crm-client, erpnext-accounting-client, erpnext-product-client) totaling 30+K LOC. Is ERPNext a required dependency or optional integration?

5. **Mobile staff interface** — Only 5 routes for mobile. Is this feature complete or early stage?

6. **SaaS multi-tenancy** — `src/pages/saas/` exists with onboard flows. Is this a separate product line or internal tooling?

7. **Test generation methodology** — The 261K LOC of tests vs 141K LOC source suggests automated test generation. What tool/process generated these tests?
