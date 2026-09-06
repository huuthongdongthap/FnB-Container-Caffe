# Architecture Audit — AURA CAFE (FnB-Container-Caffe)

**Command:** `arch --audit` · **Date:** 2026-08-25 · **Scope:** Frontend-heavy architecture review (owner concern: "còn rất nhiều lỗi liên quan kiến trúc FE")
**Stack:** Vite 8 + React 19 + TS + Tailwind 4 + react-router v7 + zustand + @tanstack/react-query + i18next (FE, `src/`) · Hono on Cloudflare Workers (BE, `worker/src/`) · Cloudflare D1 · vitest

---

## Executive Summary

The frontend has **solid micro-foundations** — strict TypeScript (`strict` + `noUncheckedIndexedAccess`), `@` path aliases wired in both Vite and tsconfig, lazy-loaded routes with per-route ErrorBoundaries, a clean `apiFetch` wrapper, and **no god-components** (largest production file is 218 lines). However, the macro-architecture is compromised by five structural problems:

1. **~46% of the frontend is Stitch design-tool leftover code** (567 files / ~41K LOC) that is partially *load-bearing* — even the AdminLayout renders inside a Stitch component — and 21 `/stitch/*` routes (including fake admin terminals) are publicly routable with hardcoded mock data.
2. **Auth architecture is broken at two points**: session is not restored after refresh (no store persistence, bootstrap gated on already-set user), and `ProtectedRoute` checks only user existence — the `role` field (`customer|staff|owner`) exists but is **never enforced**, so any logged-in customer passes every `/admin` guard client-side.
3. **Two parallel API layers**: `apiFetch` (89 files) coexists with raw `fetch()` (22+ files, including the payment-request call in checkout), with divergent error handling; 126 unique endpoint string literals are scattered across 112 files with no registry.
4. **Domain types are duplicated everywhere** (`MenuItem` defined ≥12×, `Order` ≥4× in FE alone) with zero shared contract between `src/` and `worker/src/types/models.ts`.
5. **Zero linting on the entire frontend** — the only lint script targets `worker/src/`, which explains how inconsistent patterns accumulated.

**Health scores: FE 5/10 · BE 7/10.**

---

## Architecture Diagram (text)

```
                        ┌───────────────────────────────────────────────┐
                        │                  main.tsx                     │
                        │  HelmetProvider > App (QueryClient>Router)    │
                        └──────────────────────┬────────────────────────┘
                                               ▼
        ┌────────────────────────────────── App.tsx ──────────────────────────────────┐
        │  AuthProvider ─ ToastProvider ─ OfflineBanner/QueueIndicator                │
        │  StitchAppLayout ◄── ⚠ wraps EVERYTHING; chrome toggled by exact-path Set   │
        │  <Routes>{public}{stitch}{mobile}{admin}</Routes>  (lazy + ErrorBoundary)   │
        └───────┬──────────────┬───────────────┬──────────────┬────────────────────────┘
                ▼              ▼               ▼              ▼
         public-routes   stitch-routes    mobile-routes   admin-routes
         (33 routes)     (21 routes ⚠     (staff shell,   (28 routes behind
         no role guard   mock data,       ProtectedRoute  ProtectedRoute ⚠
                         no guard)        no ROLE check)  no ROLE check)
                │              │               │              │
                └──────────────┴───────┬───────┴──────────────┘
                                       ▼
   src/pages/** (feature pages, flat admin dir 140 files, [locale]/ oddity)
        │ imports ▼                          ▲ imported-by (tests only)
   src/components/{ui,shared,payment,payments,stitch(404 files!),domain-*}
        │                                    │
   src/hooks/  ◄─ ⚠ BOTH server-state (use-checkout via react-query)
      ├─ use-*.ts (40+)                    AND client-state live here:
      └─ stores/use-*-store.ts (10 zustand)  "hooks/stores" conflates layers
        │
   src/lib/{api-client,logger,offline-db,i18n,...}   src/config, src/theme
        │ apiFetch ─────────────────────────────► worker/src (Hono)
                                                     ├─ routes/ (81 files; .bak leftovers)
                                                     ├─ middleware/ do/ lib/ utils/
                                                     ├─ tree/{zalo,mautic,pretix,mixpost,…}
                                                     └─ types/{models,api,env}.ts ◄─ ⚠ no shared
                                                                                        DTOs with FE
   Cross-layer rule violations found: components→pages = 0 ✅ ; pages→pages = 1 (locale/order→TableOrder) ;
   pages→components/stitch barrel = yes (AdminLayout) — legal direction but couples prod admin to design leftovers.
```

---

## Findings

| ID | Severity | Area | Description | Evidence | Recommendation |
|----|----------|------|-------------|----------|----------------|
| ARCH-FE-01 | **P0** | Routing/Auth | Route guards check authentication but **not authorization**. Any customer-role user can render all 28 admin screens client-side. | `src/components/auth/ProtectedRoute.tsx:9-16` — only `if (!user)` redirect; `AuthUser.role: 'customer'\|'staff'\|'owner'` declared at `src/hooks/stores/use-auth-store.ts:14` but `role ===` never referenced anywhere in `src/components/auth/`. | Add `<ProtectedRoute roles={['staff','owner']}>`; read role from `/api/auth/me`; keep BE enforcement as source of truth (verify worker middleware does too). |
| ARCH-FE-02 | **P1** | State/Auth | **Session lost on refresh.** `AuthProvider` hydrates only `if (user)` — impossible after reload because the zustand auth store has no persist and nothing calls `fetchMe()` on cold start despite valid httpOnly cookie. Comment claims localStorage hydration that doesn't exist. | `src/components/auth/AuthProvider.tsx:16-19` (`if (user) { fetchMe(); }`, `[]` deps); `rg persist/localStorage` in `use-auth-store.ts` → none. | Always call `fetchMe()` once on mount (or add zustand `persist` for user snapshot + silent revalidation). Add integration test: reload-with-cookie keeps admin session. |
| ARCH-FE-03 | **P1** | Dead weight / Boundaries | **Stitch legacy ≈46% of FE**: 567 files / 40,983 LOC in `src/components/stitch` (404 files) + `src/pages/stitch` (163 files). Includes 21 publicly routable mock screens (fake POS products "$6.50 espresso", hardcoded event data) and naming artifacts (`use-stitch-container-new2-default-data.ts`). Prod `AdminLayout` wraps content in `StitchAdminTerminalNew` from this barrel. | File counts above; mock data e.g. `src/pages/stitch/admin-pos/index.tsx:10-13`; `src/pages/admin/AdminLayout.tsx:5-7`; routes `src/routes/stitch-routes.tsx:32-54`. | Triage per screen: (a) delete unused variants, (b) promote keepers into real feature folders (`pages/admin`, `pages/menu`) stripping mock constants, (c) gate remaining showcase routes behind flag or remove from bundle. Target: stitch dirs ≤10% of FE. |
| ARCH-FE-04 | **P1** | API layer | **Dual HTTP patterns.** `apiFetch` (typed errors, interceptor, analytics beacon) used by 89 files, but raw `fetch()` persists in 22+ files including money-critical flows — these bypass `ApiClientError`, error interceptor, and error reporting. | `src/lib/api-client.ts` vs raw callers: `src/pages/checkout.tsx:127` (`fetch(\`${API_BASE}/api/payments/payment-request\`)`), `src/pages/TableOrder-hooks.ts`, `src/pages/mobile/mobile-login.tsx`, `src/components/payment/apple-google-pay.tsx`, `src/hooks/use-mobile-auth.tsx`, … | Forbid raw `fetch` outside `lib/` via ESLint `no-restricted-syntax`; migrate the 22 files to `apiFetch`; keep low-level escape hatch as exported `rawFetch` if truly needed (SW/beacon). |
| ARCH-FE-05 | **P1** | API layer | **No endpoint registry**: 126 unique `'/api/…'` literals duplicated across 112 files (`api/orders` ×13 spellings-contexts, `api/menu` ×8, `api/admin/orders` ×5…). Renames/versioning are grep-driven. | `rg -o 'api/[a-z0-9/_-]+' src --no-filename \| sort -u \| wc -l` → 126; files → 112. | Create `src/lib/api/endpoints.ts` (or per-domain `api/*.ts`) exporting typed path builders + response types; migrate incrementally starting with orders/menu/admin. |
| ARCH-FE-06 | **P1** | Types | **Duplicated DTOs, no FE↔BE contract.** `MenuItem` defined in ≥12 places (`src/hooks/use-tv-menu.ts`, `src/hooks/stores/use-menu-store.ts`, `src/pages/menu.tsx`, 8 stitch variants…) and `worker/src/types/models.ts`; `Order` in 4 FE locations. Drift is inevitable (e.g., stitch menus carry USD `$6.50` strings vs VND ints). | `rg -ln '(interface\|type) MenuItem' src worker/src` → 12 hits; Order → 4 hits. | Introduce `src/types/domain.ts` mirroring worker models (or generate from Zod schemas in `worker/src` via `z.infer` + shared package). Single import site per concept. |
| ARCH-FE-07 | **P1** | Tooling | **Frontend is completely unlinted**: `npm run lint` = `eslint worker/src/ --ext .ts`; `eslint.config.js` contains zero `files:` entries for `src/`. 88K LOC of TSX ships unchecked (this is why dual patterns/dead code accumulated silently). | `package.json:7-8`; `eslint.config.js:112-137` (worker-only overrides). | Extend flat config to `src/**/*.{ts,tsx}` with `typescript-eslint` + `react-hooks` + `import/no-restricted-paths` (enforce layers); wire into CI alongside `tsc --noEmit` (already in build ✓). |
| ARCH-FE-08 | **P2** | State layering | Zustand stores live under **`src/hooks/stores/`** (10 client stores + `admin/` sub-stores) while server state uses react-query hooks directly in `src/hooks/`. There is no top-level `stores/` directory; location implies stores are "hooks internals". Consumer count: 60 files. | Directory listing `src/hooks/stores/` (use-auth/cart/order/payment/loyalty/…); `src/App.tsx:2` QueryClient; 60 files importing `@/hooks/stores/`. | Move to `src/stores/*.ts` (update ~15 import sites mechanically); document rule: *server cache = react-query hooks, cross-feature client state = zustand store, ephemeral UI = local state*. |
| ARCH-FE-09 | **P2** | Component domains | Payment domain split across **two sibling folders**: `components/payment/` (1 file: apple-google-pay.tsx) and `components/payments/` (RefundModal family, 9 files). Confusing import paths for future contributors. | `ls src/components/payment` vs `src/components/payments/RefundModal*`. | Merge under `src/components/payments/` (or better: `features/payments/`); move `apple-google-pay.tsx` usage next to its checkout consumer. |
| ARCH-FE-10 | **P2** | Layout/Routing | Global app chrome switched by **exact pathname match against a Set** — `'/admin'` entry cannot match `'/admin/orders'`, so behavior differs per admin subroute; relies on each child layout self-hiding. Also contains a duplicated comment line and mixes nav concerns into a "stitch" component. | `src/components/stitch/StitchAppLayout.tsx:11-23` (`PAGES_WITH_OWN_HEADER.has(location.pathname)`). | Replace with nested layouts: `<Route element={<StitchShell/>}>` for public chrome, `<Route element={<AdminShell/>}>` under `/admin/*` prefix matching; delete the Set. |
| ARCH-FE-11 | **P2** | Config/env | Hardcoded URLs in FE: production Worker fallback baked into client bundle; dozens of external `lh3.googleusercontent.com/aida-public/...` asset URLs pasted into constants (stitch/events/loyalty); support phone/Zalo link inline. No central `config/site.ts`. | `src/lib/api-client.ts:3` (fallback `https://aura-space-worker.…workers.dev`); `src/pages/order-failure.tsx:170` (zalo.me/0946…); `src/pages/loyalty-constants.ts:16-18`; `src/components/seo/HelmetHead.tsx:11`. | Fail build if `VITE_API_BASE` unset (throw in `api-client`); hoist brand assets to `public/images` + `config/site.ts`; env-var the share/support links. |
| ARCH-FE-12 | **P2** | Routing | `guarded()` helper copy-pasted into **all 4 route files**; route arrays are JSX elements spread into `<Routes>` (`{...routes}`), mixing declaration styles and preventing type-safe route composition. | Identical function in `src/routes/public-routes.tsx:6`, `admin-routes.tsx:7`, `mobile-routes.tsx:6`, `stitch-routes.tsx:5`; `App.tsx:42-45`. | Extract `wrapWithErrorBoundary` to `src/routes/route-utils.tsx`; consider migrating arrays to `createBrowserRouter` objects (v7 idiom) for typed nesting + loaders later. |
| ARCH-FE-13 | **P2** | Feature organization | `src/pages/admin/` = **140 flat files** using `PageName-suffix` convention (AuditLogViewer-table.tsx, Devices-hooks.ts, …). Consistent, but flat namespace + suffix-as-folder makes ownership/refactor tooling noisy; same pattern repeats for TableOrder*, TableReservation*, ReviewsPage*, loyalty-*. | `ls src/pages/admin \| wc -l` → 140. | Adopt folder-per-page (`admin/devices/{index,hooks,types,table}.tsx`) opportunistically when touching each feature; no big-bang needed. |
| ARCH-FE-14 | P2 (positive) | Components | **No god-components**: largest non-test FE file = 218 LOC (`pages/checkout.tsx`); largest overall is a test (349). Decomposition discipline is genuinely good. | `wc -l` sort head (see Metrics). | Keep; codify ≤300-line soft cap in ESLint `max-lines` once linting lands (ARCH-FE-07). |
| ARCH-BE-01 | P2 | BE hygiene | Legacy artifacts inside production worker routes: `birthday.ts.bak`, `payments.ts.bak`, `tables.ts.bak`, plus `auth-verify-fixed.ts` alongside `auth-verify.ts` ("fixed" naming = unresolved duplication risk at auth surface). | `ls worker/src/routes/` → 81 files incl. 3 `.bak`; `auth-verify-fixed.ts`. | Delete `.bak`s (git history preserves); diff & merge `auth-verify-fixed` into canonical module; rename or remove. |
| ARCH-BE-02 | P2 | BE structure | Otherwise clean layering (`routes/ middleware/ do/ lib/ utils/ types/ tree/ integrations/`), 146 backend test files; minor: root `package.json` carries runtime-ish deps (`web-push`, `hono`) in devDependencies — deployment boundary between SPA and Worker is implicit. | `package.json` devDeps; `find worker/src -maxdepth 1 -type d`. | Give worker its own manifest/wrangler scope (it likely has one — confirm) so SPA bundle can't accidentally import server deps like `web-push`. |
| HYG-01 | P2 | Repo hygiene | Root littered with one-off scripts/artifacts: 10× `fix_*.py`/`repair_index.py`, 3× `test-phase*.sh`, `.tmp_fix_redirects.py`, `check-routes.mjs`, `test-patch.mjs`, `all-results.json` (188KB), `test-output.log` (38KB), `CEO-HANDOVER.md.bak`, `__pycache__/`, `_dist_backup/`, stray `~/mekong-cli` dir, committed `coverage/`+`dist/` outputs, `stitch-exports/`. | Repo root listing; counts in Metrics. | Move scripts→`scripts/archive/` or delete; gitignore `coverage/ dist/ __pycache__ *.log *.bak all-results.json`; delete stray `~/` dir; archive `stitch-exports/` out of repo. |
| SEC-NOTE | Info | Config | `.env` present locally (contents withheld by policy) while `.env.example` documents payment-gateway secrets (VNPAY/MoMo/PayOS/SendGrid) — those belong to **worker-side secrets** (`wrangler secret put`), must never be prefixed `VITE_`. Verified no `VITE_` secret beyond optional GA/pixel IDs in example. | `.env.example:1-44`. | Keep `VITE_*` limited to public config; add CI guard grepping bundle for key-shaped strings. |

---

## Prioritized Recommendations

**Sprint 1 — correctness & safety (high leverage, small diffs)**
1. ARCH-FE-01: role-aware `ProtectedRoute` (≈20 LOC) + verify worker-side role middleware covers `/api/admin/*`.
2. ARCH-FE-02: unconditional `fetchMe()` on mount in `AuthProvider` + regression test.
3. ARCH-BE-01/HYG-01: delete `.bak`/dead scripts; gitignore build outputs.

**Sprint 2 — consistency**
4. ARCH-FE-07: enable ESLint for `src/` (incl. `no-restricted-imports` layer rules, `max-lines`, ban raw `fetch`) → immediately surfaces ARCH-FE-04 violations mechanically.
5. ARCH-FE-04: migrate the 22 raw-fetch files to `apiFetch` (start with checkout payment-request).
6. ARCH-FE-11: make `VITE_API_BASE` mandatory; centralize site config.

**Sprint 3 — structural debt**
7. ARCH-FE-03: stitch triage program (delete/promote/gate) with a measurable target (≤10% of FE LOC).
8. ARCH-FE-06: single-source domain types shared FE↔BE (Zod-inferred).
9. ARCH-FE-08/09/12: mechanical moves — `stores/` dir, merge `payment(s)/`, extract `route-utils`.
10. ARCH-FE-10/13: nested-layout shells; folder-per-page migration opportunistically.

---

## Metrics

| Metric | Value |
|---|---|
| FE source files (`src/**/*.ts(x)`) | 1,160 files / **88,254 LOC** |
| — of which stitch legacy (`components/stitch` + `pages/stitch`) | **567 files / 40,983 LOC (46.4%)** |
| — non-stitch FE | 52,369 LOC |
| BE (`worker/src/**/*.ts`) | 391 files / 54,224 LOC (incl. 146 test files) |
| FE test files | 148 |
| Pages: `src/pages/admin` | 140 entries (flat, suffix convention) |
| Routes | public 33 · stitch 21 · mobile 4(+index) · admin 29 |
| `apiFetch` adopters | 89 files |
| Raw `fetch()` callers (non-lib) | 22+ files |
| Unique `'/api/…'` endpoint literals | 126 across 112 files |
| Zustand stores | 10 (+`stores/admin/*`) · 60 consuming files |
| React-query hook users | 28 files |
| `any` occurrences | 78 in 28 files (**mostly tests**; worst: tests/Dashboard.test 13, `use-admin-shifts-store` 4, `use-order-store` 3) |
| `@ts-ignore` / `@ts-expect-error` | **0** ✅ |
| `console.*` in prod code | 3 (logger adopted elsewhere) ✅ |
| i18n adoption | 339 files use `useTranslation` |
| Largest production files (LOC) | checkout.tsx 218 · use-mobile-auth.tsx 206 · ui/navbar.tsx 205 · staff/notification-settings.tsx 200 · ReviewsPage-write-review-form.tsx 199 |
| Largest file overall | `src/__tests__/order-flow-integration.test.tsx` 349 |
| TS config | `strict: true`, `noUncheckedIndexedAccess: true`, `@/*` alias (vite+tsconfig aligned) ✅ |
| Lint coverage | worker/src only — **src/ = 0%** ❌ |

### Layer-boundary violation scan (quantified)
- `components → pages`: **0 files** ✅
- `pages → pages` (non-test): 1 — `src/pages/[locale]/order.tsx:6` re-exports `TableOrder`
- `pages → components/stitch`: present (`AdminLayout.tsx`, several pages) — legal direction, unhealthy coupling (see ARCH-FE-03)

---

*Report generated by `arch --audit` pipeline · read-only analysis; no source files modified.*
