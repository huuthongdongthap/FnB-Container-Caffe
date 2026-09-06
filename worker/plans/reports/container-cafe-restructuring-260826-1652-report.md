# Container Cafe Sa Đéc — Full-Stack Restructuring Report

**Generated:** 2026-08-26 16:52  
**Scope:** Complete FE/BE architecture for modern-yet-rustic container cafe at Sa Đéc  
**Based on:** Deep analysis of Stitch exports, worker backend, frontend architecture, DESIGN.md v6.0 tokens

---

## Executive Summary

> **Updated 2026-08-26 evening:** Real cafe photos (IMG_6790–6796) show a bright, airy rustic space (lime-wash walls, cement tiles, wood + rattan, blue brew bar) — not the dark noir originally assumed. User locked: brand = **AURA CAFE** (fictional), visual direction = **bright rustic light**. Palette updated to **v6.1 Rustic Light** below; `--aura-*` variable names unchanged so all existing code refs stay valid.

This restructuring plan transforms the current fragmented codebase (57+ public pages, 142 admin files, partial token adoption) into a cohesive, production-ready platform that honors the Sa Đéc local identity while delivering modern technical excellence.

### Current State Assessment

| Layer | Status | Key Issues |
|-------|--------|------------|
| **Backend** | ✅ Production-ready | Missing OpenAPI, no device trust, payment resilience gaps |
| **Database** | ✅ Solid (42 tables, PITR) | No Sa Đéc locality fields, no bilingual content |
| **Frontend Architecture** | ⚠️ Fragmented | 57 pages, 142 admin files, unclear component boundaries |
| **UI/UX Consistency** | ⚠️ Partial | DESIGN.md tokens defined but not enforced |
| **Admin UX** | ⚠️ Duplicated | Multiple TableOrder*, POS*, OrderList* variants |
| **Real-time** | ⚠️ Polling-based | KDS needs WebSocket upgrade |
| **Offline/PWA** | ❌ Missing | No offline menu, no background sync |
| **Localization** | ⚠️ Hardcoded | Strings scattered, no i18n structure |

---

## Design System Foundation (Updated from DESIGN.md v6.0 → v6.1 Rustic Light)

### Color Palette — Bright Rustic Light + Forest Green + Wood Amber
```css
/* AURA v6.1 Rustic Light — derived from real cafe photos IMG_6790–6796 */
/* Core — NO DEVIATION ALLOWED. Variable names stay --aura-* (v6.0 compatible) */
--aura-bg-page: #F7F4EE;           /* Warm lime-wash off-white page background (light green courtyard walls) */
--aura-bg-card: #FFFFFF;           /* Card surfaces */
--aura-bg-sunken: #EFEAE0;         /* Sunken surfaces — cement-tile beige */
--aura-primary: #4A7C59;           /* Forest green — PRIMARY ACTIONS (unchanged; matches plants/pale-green walls) */
--aura-secondary: #2E5E8C;         /* Container blue — SECONDARY (blue brew bar + containers) */
--aura-accent-warm: #C08A3E;       /* Wood amber — ACCENTS (wooden tables, rattan, Edison bulbs) */
--aura-chrome-light: #E8E8E8;      /* Chrome text/icons (kept from v6.0) */
--aura-chrome-mid: #8E9097;        /* Muted chrome (kept from v6.0) */
--aura-text-primary: #2B2B26;      /* Warm charcoal on light background */
--aura-text-muted: #6E6E64;        /* Muted text */

/* Glassmorphism — DEMOTED in v6.1. Solid warm surfaces are the default;
   glass only for sticky nav over photography */
--aura-glass-bg: rgba(255, 255, 255, 0.75);
--aura-glass-blur: 8px;
--aura-glass-border: rgba(43, 43, 38, 0.10);
```

### Typography — Quicksand + Be Vietnam Pro
- **Display:** Quicksand (VN subset) — Hero, headlines, numbers
- **Body:** Be Vietnam Pro (VN subset) — All UI text, forms, body

### Spacing & Motion
- Base unit: 4px
- Radius: 4/8/12/16px (input/button/card/modal)
- Duration: 150-300ms micro, ≤400ms complex
- Easing: ease-out enter, ease-in exit
- Stagger: 30-50ms per item

---

## Six-Phase Implementation Plan

### Phase 1: Backend Hardening & API Contract (Week 1)
**Owner:** Backend Team | **Dependencies:** None

| Deliverable | Details |
|-------------|---------|
| **OpenAPI 3.1 Spec** | Auto-generated from Hono + Zod, served at `/api/docs` (Scalar UI) |
| **DB Locality Extensions** | `locale`, `location_id` on orders; bilingual categories/items; `locations` table |
| **Device Trust** | Fingerprinting, 30-day trusted devices, suspicious login alerts, session revocation |
| **Payment Resilience** | PayOS idempotency keys, exponential backoff retry, card tokenization, reconciliation job |

**Key Files:** `worker/src/schemas/`, `worker/db/migrations/20260826_01_*.sql`, `worker/src/lib/openapi.ts`

---

### Phase 2: Frontend Component Library Unification (Week 2-3)
**Owner:** Frontend Core | **Dependencies:** Phase 1.1 (OpenAPI types)

| Deliverable | Details |
|-------------|---------|
| **`@/components/aura` Package** | 30+ primitives (Button, Card, Input, Chip, Badge, Modal, Sheet, Table, Tabs, Toast, Skeleton...) |
| **Composites** | DataTable, FormWizard, Stepper, Calendar, CommandPalette |
| **Patterns (Shells)** | PageShell, AdminShell, MobileShell, LandingShell, MenuShell, CheckoutFlow |
| **Design Token Enforcement** | Stylelint rules blocking raw hex/rgb/hsl; only `var(--aura-*)` allowed |
| **Storybook** | 100% primitive coverage with a11y addon |

**Migration Strategy:** Build primitives → composites → patterns → migrate pages incrementally → delete old Stitch components

**Key Files:** `src/components/aura/**`, `.stylelintrc.json`, `.storybook/main.ts`

---

### Phase 3: Page Consolidation & Route Restructuring (Week 3-4)
**Owner:** Feature Teams | **Dependencies:** Phase 2 (shells stable)

#### Public Routes: 57 → 12 Pages
| Route | Shell | Stitch Source |
|-------|-------|---------------|
| `/` | LandingShell | luxury-landing-hero + luxury-cafe-1 |
| `/menu` | MenuShell | digital-menu v2 |
| `/about` | PageShell | our-story + StitchAbout |
| `/checkout` | PageShell | premium-checkout (multi-step) |
| `/order/success/:id` | PageShell | order-success |
| `/order/failure/:id` | PageShell | order-failure |
| `/loyalty` | PageShell | loyalty-rewards |
| `/reserve` | PageShell | adapted from referral-rewards-1 |
| `/track/:code` | PageShell | New (KDS WebSocket) |
| `/events` | PageShell | events-promotions-1 |
| `/promotions` | PageShell | promotions |
| `/contact` | PageShell | contact-new |

#### Admin Routes: 142 → 12 Pages
| Route | Consolidates |
|-------|--------------|
| `/admin` | Dashboard, Metrics, QuickActions |
| `/admin/orders` | All TableOrder*, OrderList*, POS*, OrderManagement* |
| `/admin/menu` | ProductList, CategoryList, Variants, Modifiers |
| `/admin/staff` | Users, Shifts, Tips, Performance, Birthdays |
| `/admin/inventory` | Stock, Suppliers, WasteLog, PurchaseOrders |
| `/admin/finance` | Sales, Payouts, Tax, PayOS Reconciliation |
| `/admin/loyalty` | Tiers, Campaigns, Referrals, PointsConfig |
| `/admin/settings` | General, Integrations, Webhooks, Branding |
| `/admin/audit` | AuditLogViewer (keep) |
| `/admin/kds` | KitchenDisplaySystem (keep) |
| `/admin/analytics` | Analytics, Reports, Exports |
| `/admin/promotions` | Broadcast, Campaigns, Coupons |

#### Mobile Routes: 4 Pages (QR Ordering)
| Route | Purpose |
|-------|---------|
| `/m/:tableId` | Mobile menu with floating cart |
| `/m/:tableId/cart` | Slide-up cart sheet |
| `/m/:tableId/checkout` | Simplified checkout (PayOS/COD) |
| `/m/:tableId/track` | Real-time order tracking |

---

### Phase 4: Real-Time & Offline Features (Week 4-5)
**Owner:** Realtime Team | **Dependencies:** Phase 3 (terminal pages functional)

| Feature | Implementation |
|---------|----------------|
| **KDS WebSocket** | Durable Object per location (`sa-dec-main`); auth, claim, update, complete via WS |
| **Client `useKDS` Hook** | Auto-reconnect, message queue, optimistic UI, station filtering |
| **Optimistic UI** | Zustand store with `optimisticClaim`, `optimisticUpdateItem`, `rollback` |
| **Offline Queue** | IndexedDB (idb) + Background Sync API; queue orders, sync on reconnect |
| **PWA** | Workbox SW: stale-while-revalidate menu, cache-first images, background sync orders |
| **Push Notifications** | VAPID web-push: order ready, payment failed, promo expiry, tier upgrade |
| **Admin Realtime** | Separate DO: live orders, staff presence, low-stock alerts |

---

### Phase 5: Sa Đéc Localization & Content (Week 5)
**Owner:** Content + Frontend | **Dependencies:** Phase 2 (i18n infrastructure)

| Content Area | Structure |
|--------------|-----------|
| **Brand** | Name, tagline, address, hours, story (vi/en) |
| **Navigation** | All nav labels, common actions (vi/en) |
| **Menu** | 4 categories, 15+ items with local stories, ingredient sources, allergens |
| **Zones** | 5 zones (Bar, Rooftop, Quiet, Sofa, Private) with features, capacity, vibe |
| **Imagery** | 30+ optimized images (WebP/AVIF, responsive srcset, blur placeholders) |
| **Slugs** | Diacritic-safe: `ca-phe-ban-dia`, `midnight-espresso`, `khu-sofa` |

**i18n Config:** React-i18next with namespaces (common, brand, nav, menus, zones, auth, checkout, loyalty, admin), localStorage persistence, SSR-compatible.

---

### Phase 6: Testing, Visual Regression & Deploy Gates (Week 6)
**Owner:** QA + DevOps | **Dependencies:** Phases 1-5 complete

| Test Layer | Tool | Target |
|------------|------|--------|
| Unit | Vitest | 80%+ hooks/utils/stores/primitives |
| Integration | Vitest + MSW | 100% API routes |
| E2E | Playwright | 10 critical flows |
| Visual | Playwright + pixelmatch | 0 diff vs Stitch baselines (12 pages × 2 viewports) |
| Accessibility | axe-core | 0 violations (WCAG 2.1 AA) |
| Performance | Lighthouse CI | Perf ≥ 90, A11y ≥ 95, CLS < 0.1 |

**Deploy Pipeline Gates (sequential, all must pass):**
1. TypeScript strict (worker + frontend)
2. Stylelint DESIGN.md tokens
3. Vitest unit + integration
4. Playwright E2E on staging
5. Visual regression
6. Lighthouse CI
7. Production build
8. Cloudflare deploy (Worker + Pages)
9. 12-endpoint smoke tests
10. Health check

**Rollback:** One-command rollback script tested monthly.

---

## Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Admin consolidation breaks workflows | Medium | High | Parallel run old/new 1 sprint; feature flags |
| DESIGN.md token enforcement breaks legacy | High | Medium | Incremental migration + allowlist during transition |
| WebSocket scaling on CF free tier | Low | High | Durable Objects + connection pooling; monitor |
| i18n content gaps at launch | Medium | Medium | Content audit checklist; English fallback |
| Visual regression flakiness | Medium | Low | Stable test data; snapshot approval workflow |

---

## Acceptance Criteria (Definition of Done)

### Backend
- [ ] OpenAPI spec at `/api/docs` with all 50+ routes
- [ ] All migrations applied (local + staging + prod)
- [ ] 1533/1533 tests passing + new contract tests
- [ ] PayOS webhook idempotency verified

### Frontend
- [ ] `@/components/aura` exports 30+ primitives with Storybook
- [ ] 0 Stylelint violations
- [ ] 12 public pages (from 57), 12 admin pages (from 142)
- [ ] All Stitch designs implemented as Aura compositions
- [ ] Visual regression: 0 pixel diff

### UX
- [ ] Lighthouse: Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 90
- [ ] WCAG 2.1 AA: contrast, focus, ARIA, keyboard nav
- [ ] Mobile-first: works at 320px
- [ ] Offline: menu browsable, cart persists, orders sync

### Localization
- [ ] 100% strings externalized
- [ ] English fallback for all keys
- [ ] Local content populated from JSON/CMS

---

## File Ownership Matrix (Parallel Execution Safe)

| Phase | Files | Owner |
|-------|-------|-------|
| 1.1-1.4 | `worker/src/routes/*.ts`, `worker/schema.sql`, `worker/db/migrations/*.sql` | Backend |
| 2.1-2.3 | `src/components/aura/**`, `.stylelintrc.json`, `src/styles/brand-tokens.css` | Frontend Core |
| 3.1 | `src/pages/stitch/*-page/`, `src/routes/stitch-routes.tsx` | Public Team |
| 3.2 | `src/pages/admin/**`, `src/routes/admin-routes.tsx` | Admin Team |
| 3.3 | `src/pages/stitch/mobile-*-page/`, `src/routes/mobile-routes.tsx` | Mobile Team |
| 4.1-4.3 | `worker/src/tree/kds/**`, `src/hooks/use-kds.ts`, `src/lib/offline-queue.ts` | Realtime |
| 5.1-5.2 | `src/locales/**`, `src/components/aura/patterns/*` (localized) | Content |
| 6.1-6.3 | `tests/**`, `playwright.config.ts`, `scripts/deploy.sh` | QA/DevOps |

---

## Timeline

```
Week 1:  ████ Phase 1 (Backend)
Week 2:  ██████ Phase 2 (Components)
Week 3:  ██████████ Phase 2 + Phase 3 (Pages)
Week 4:  ██████████ Phase 3 + Phase 4 (Realtime)
Week 5:  ████████ Phase 4 + Phase 5 (Content)
Week 6:  ██████████ Phase 6 (Testing + Deploy)
```

---

## Next Steps

1. **Review & Approve** — Confirm scope, priorities, timeline with stakeholders
2. **Assign Owners** — Map phases to team members
3. **Kickoff Phase 1** — Backend hardening can start immediately
4. **Set Up Tracking** — Create GitHub Projects/Linear issues for each phase task
5. **Weekly Sync** — Monday planning, Friday demo/retro

---

## References

- **Plan Directory:** `plans/260826-1652-container-cafe-restructuring/`
- **Phase Details:**
  - `phase-01-backend-hardening.md`
  - `phase-02-frontend-component-library.md`
  - `phase-03-page-consolidation.md`
  - `phase-04-realtime-offline.md`
  - `phase-05-localization-content.md`
  - `phase-06-testing-deploy.md`
- **Design Tokens:** `src/styles/brand-tokens.css` (v6.0)
- **Stitch Exports:** `stitch-exports/stitch_aura_cafe/`
- **Previous Audit:** `plans/reports/architecture-ui-ux-audit-260825-2236-report.md`

---

**Report Location:** `plans/reports/container-cafe-restructuring-260826-1652-report.md`