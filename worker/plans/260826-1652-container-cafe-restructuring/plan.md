# Container Cafe Sa Đéc — Full-Stack Restructuring Plan

**Date:** 2026-08-26  
**Scope:** Complete FE/BE architecture for a modern-yet-rustic container cafe at Sa Đéc  
**Status:** Planning phase  
> **UPDATE 2026-08-26:** Visual direction pivoted from dark noir (v6.0 navy) to **Bright Rustic** matching real Sa Dec cafe photos. Brand stays AURA CAFE. See [appendix-design-tokens-rustic-light.md](./appendix-design-tokens-rustic-light.md) for v6.1 Rustic Light tokens.
**Sources Analyzed:**
- Stitch exports (7 screens: landing, about, menu, checkout, order-failure, admin-terminal, order-management)
- Worker backend (Hono + D1, 50+ routes, JWT auth, PayOS payments, KDS realtime)
- Frontend (React + Vite + Tailwind v4, 57+ pages, 142 admin files)
- DESIGN.md tokens (v6.0: Navy + Forest Green + Chrome, Quicksand + Be Vietnam Pro)

---

## Executive Summary

| Layer | Current State | Target State | Effort |
|-------|---------------|--------------|--------|
| **Backend** | ✅ Production-ready | Harden + OpenAPI | Medium |
| **Database** | ✅ 42 tables, PITR | Add locality fields | Low |
| **Auth/Security** | ✅ JWT + RBAC + KV | Add device trust | Medium |
| **Frontend Architecture** | ⚠️ Fragmented (57 pages, 142 admin) | Unified Stitch component lib | High |
| **UI/UX Consistency** | ⚠️ Partial token adoption | 100% DESIGN.md enforcement | High |
| **Admin UX** | ⚠️ Duplicate pages | Single terminal per domain | High |

---

## Design System Integration (From Stitch Exports)

### Color Palette (Locked — from DESIGN.md v6.0)
> **Superseded by v6.1 Rustic Light (2026-08-26)** — same `--aura-*` names, new values. Full token block + rationale: [appendix-design-tokens-rustic-light.md](./appendix-design-tokens-rustic-light.md). Block below retained for historical reference only.
```css
/* Core — Navy + Forest + Chrome */
--aura-bg-page: #00142c;
--aura-bg-card: #061c35;
--aura-primary: #4A7C59;      /* Forest Light — PRIMARY ACTION */
--aura-secondary: #E8E8E8;    /* Chrome Light — SECONDARY */
--aura-accent-warm: #A8C5A0;  /* Forest Pale — ACCENT */
--aura-chrome-light: #E8E8E8;
--aura-chrome-mid: #8E9097;
--aura-text-primary: #D4E3FF;
--aura-text-muted: #8E9097;

/* Glass */
--aura-glass-bg: rgba(10, 26, 46, 0.75);
--aura-glass-blur: 8px;
--aura-glass-border: rgba(198, 198, 199, 0.15);

/* Status */
--aura-success: #4A7C59;
--aura-warning: #D4A843;
--aura-error: #FFB4AB;
```

### Typography (Locked)
- **Display:** Quicksand (VN subset) — headings, hero, numbers
- **Body:** Be Vietnam Pro (VN subset) — all body text, UI labels

### Spacing & Radius (Locked)
- Base unit: 4px
- Radius: 4px (inputs), 8px (buttons/chips), 12px (cards), 16px (modals)
- Glass blur: 8px (reduced from 16px for clarity)

### Component Patterns (From Stitch Exports)
| Pattern | Usage | Key Classes |
|---------|-------|-------------|
| Glass Panel | All cards, modals, sheets | `.glass-panel` |
| Chrome Border | Interactive borders, focus rings | `.chrome-border` |
| Bronze Glow | Primary CTAs, active states | `.bronze-glow` |
| Gradient Text | Hero titles, key metrics | `.chrome-text` / `.forest-text` |
| Scroll Reveal | Section entrance | `opacity-0 translate-y-10 → opacity-100` |

---

## Phase 1: Backend Hardening & API Contract (Week 1)

### 1.1 OpenAPI Spec Generation
- [ ] Generate OpenAPI 3.1 from Hono + Zod schemas
- [ ] Publish to `/api/openapi.json` endpoint
- [ ] Add Scalar/Redoc UI at `/api/docs`
- [ ] CI gate: spec must validate on every PR

### 1.2 Database Locality Extensions
```sql
-- Add Sa Đéc context to core tables
ALTER TABLE orders ADD COLUMN locale TEXT DEFAULT 'vi-VN';
ALTER TABLE orders ADD COLUMN location_id TEXT DEFAULT 'sa-dec-main';
ALTER TABLE categories ADD COLUMN display_name_vi TEXT, ADD COLUMN display_name_en TEXT;
ALTER TABLE menu_items ADD COLUMN is_local_specialty INTEGER DEFAULT 0;
ALTER TABLE menu_items ADD COLUMN ingredient_source TEXT; -- 'local', 'imported', 'mixed'
```

### 1.3 Device Trust & Session Hardening
- [ ] Add `device_fingerprint` to sessions table
- [ ] Implement trusted device flow (30-day remember)
- [ ] Add suspicious login alerts (email + push)
- [ ] Rotate refresh tokens on privilege change

### 1.4 Payment Resilience
- [ ] Add PayOS webhook idempotency key enforcement
- [ ] Implement payment retry with exponential backoff
- [ ] Add payment method tokenization (save card for returning customers)

---

## Phase 2: Frontend Component Library Unification (Week 2-3)

### 2.1 Create `@/components/aura` Design System Package
```
/src/components/aura/
├── primitives/           # Atomic: Button, Input, Chip, Badge, Avatar, Icon
├── composites/           # Molecular: Card, Modal, Sheet, Dropdown, Table, Tabs
├── patterns/             # Organismic: DataTable, FormWizard, Stepper, Calendar
├── layouts/              # Page shells: PageShell, AdminShell, MobileShell, LandingShell
├── tokens/               # Design tokens as TS constants + CSS vars bridge
├── hooks/                # useMedia, useReducedMotion, useToast, useScrollReveal
└── index.ts              # Public API
```

### 2.2 Migrate Existing Stitch Components → Aura Primitives
| Current Component | Target Primitive | Status |
|-------------------|------------------|--------|
| `StitchButton` variants | `Button` (variant: primary/secondary/ghost/bronze) | 🔄 |
| `glass-panel` classes | `Card` / `Surface` component | 🔄 |
| `chrome-border` | `FocusRing` / `Border` utility | 🔄 |
| Scroll reveal logic | `useScrollReveal` hook | 🔄 |
| Toast system | `useToast` + `ToastProvider` (exists) | ✅ |

### 2.3 Enforce DESIGN.md Tokens via Stylelint
```json
// .stylelintrc.json
{
  "customSyntax": "postcss-scss",
  "rules": {
    "color-no-invalid-hex": true,
    "declaration-property-value-allowed-list": {
      "color": ["var(--aura-*)", "inherit", "currentColor"],
      "background-color": ["var(--aura-*)", "transparent"],
      "border-color": ["var(--aura-*)"],
      "box-shadow": ["var(--aura-*)"]
    }
  }
}
```

---

## Phase 3: Page Consolidation & Route Restructuring (Week 3-4)

### 3.1 Public Routes (Customer-Facing)
| Route | Component | Stitch Source | Notes |
|-------|-----------|---------------|-------|
| `/` | `LandingPage` | `luxury-landing-hero` + `luxury-cafe-1` | Hero + features + CTA |
| `/menu` | `DigitalMenu` | `digital-menu` (v2) | Category tabs, search, cart |
| `/about` | `AboutPage` | `our-story` + `StitchAbout` | Story, timeline, values, zones |
| `/checkout` | `CheckoutFlow` | `premium-checkout` | Multi-step: info → payment → confirm |
| `/order/success/:id` | `OrderSuccess` | `order-success` | Receipt + loyalty prompt |
| `/order/failure/:id` | `OrderFailure` | `order-failure` | Retry + alternatives + support |
| `/loyalty` | `LoyaltyDashboard` | `loyalty-rewards` | Tiers, points, referrals |
| `/reserve` | `ReservationFlow` | `referral-rewards-1` (adapt) | Zone picker, time slots |
| `/track/:code` | `OrderTracker` | New | Real-time via KDS WebSocket |

### 3.2 Admin Routes (Staff-Facing) — **Consolidate from 142 → ~12 pages**
| Route | Component | Consolidates |
|-------|-----------|--------------|
| `/admin` | `AdminDashboard` | Dashboard, metrics, quick actions |
| `/admin/orders` | `OrderManagementTerminal` | All TableOrder*, OrderList*, POS* |
| `/admin/menu` | `MenuManagement` | ProductList, CategoryList, variants |
| `/admin/staff` | `StaffManagement` | Users, shifts, tips, performance |
| `/admin/inventory` | `InventoryControl` | Stock, suppliers, waste log |
| `/admin/finance` | `FinancialTerminal` | Sales, payouts, tax, PayOS reconciliation |
| `/admin/loyalty` | `LoyaltyAdmin` | Tiers, campaigns, referrals |
| `/admin/settings` | `SettingsPanel` | General, integrations, webhooks |
| `/admin/audit` | `AuditLogViewer` | Existing (keep) |
| `/admin/kds` | `KitchenDisplaySystem` | Existing KDS (keep) |

### 3.3 Mobile Routes (QR Ordering)
| Route | Component | Notes |
|-------|-----------|-------|
| `/m/:tableId` | `MobileMenu` | Table-scoped menu, auto-cart |
| `/m/:tableId/cart` | `MobileCart` | Slide-up sheet |
| `/m/:tableId/checkout` | `MobileCheckout` | Simplified, PayOS + COD |
| `/m/:tableId/track` | `MobileTracker` | WebSocket order status |

---

## Phase 4: Real-Time & Offline Features (Week 4-5)

### 4.1 KDS WebSocket Integration (Durable Objects)
- [ ] Upgrade `worker/src/tree/kds/` to Durable Object per location
- [ ] Client: `useKDS` hook with auto-reconnect, message ordering
- [ ] Optimistic UI for order status transitions
- [ ] Offline queue for order submissions (IndexedDB + Background Sync)

### 4.2 PWA Enhancement
- [ ] Full offline menu browsing (service worker cache-first)
- [ ] Background sync for pending orders
- [ ] Push notifications for order ready / promotions
- [ ] Install prompt optimization (A2HS criteria)

### 4.3 Real-Time Admin Updates
- [ ] Live order dashboard via WebSocket (no polling)
- [ ] Staff presence indicators
- [ ] Inventory low-stock push alerts

---

## Phase 5: Sa Đéc Localization & Content (Week 5)

### 5.1 i18n Content Model
```typescript
// src/locales/sa-dec/{vi,en}.json structure
{
  "brand": {
    "name": "AURA CAFE",
    "tagline_vi": "Nghệ Thuật Của Ly Đổ Đêm",
    "tagline_en": "The Art of the Nocturnal Pour",
    "address": "39 Nguyễn Tất Thành, Sa Đéc, Đồng Tháp",
    "phone": "+84 277 382 XXXX"
  },
  "menu": {
    "categories": [
      { "id": "ca-phe", "name_vi": "Cà Phê Bản Địa", "name_en": "Local Coffee" },
      { "id": "tra", "name_vi": "Trà & Sức Khỏe", "name_en": "Tea & Wellness" },
      { "id": "banh", "name_vi": "Bánh Mộc Mạc", "name_en": "Rustic Pastries" }
    ]
  },
  "zones": [
    { "id": "bar", "name_vi": "Quầy Pha Chế", "name_en": "Brew Bar" },
    { "id": "rooftop", "name_vi": "Sân Thượng", "name_en": "Rooftop" },
    { "id": "quiet", "name_vi": "Góc Yên Tĩnh", "name_en": "Quiet Corner" },
    { "id": "sofa", "name_vi": "Khu Sofa", "name_en": "Sofa Lounge" },
    { "id": "private", "name_vi": "Phòng Riêng", "name_en": "Private Room" }
  ]
}
```

### 5.2 Local Content Integration
- [ ] Replace all hardcoded strings with i18n keys
- [ ] Add Vietnamese diacritic-safe slugs
- [ ] Local imagery: container architecture photos, Sa Đéc river scenes
- [ ] Menu items with local ingredient stories (cà phê robusta Cao Lãnh, trà ô long Sa Đéc)

---

## Phase 6: Testing, Visual Regression & Deploy Gates (Week 6)

### 6.1 Test Strategy
| Layer | Tool | Coverage Target |
|-------|------|-----------------|
| Unit | Vitest | 80%+ (hooks, utils, stores) |
| Integration | Vitest + MSW | All API routes |
| E2E | Playwright | 10 critical flows |
| Visual | Playwright + pixelmatch | All Stitch pages + admin terminals |
| Accessibility | axe-core | WCAG 2.1 AA |

### 6.2 Critical E2E Flows (Playwright)
1. **Happy Path:** Landing → Menu → Cart → Checkout (PayOS) → Success → Loyalty enroll
2. **Failure Recovery:** Checkout → Payment fail → Retry with COD → Success
3. **Admin Order Flow:** New order → KDS notify → Staff claim → Prepare → Ready → Serve
4. **Reservation:** Pick zone/time → Confirm → Check-in → Table service
5. **Offline:** Load menu offline → Add to cart → Reconnect → Sync order

### 6.3 Deploy Pipeline Enhancement
```bash
# scripts/deploy.sh additions
1. TypeScript strict check (both worker + frontend)
2. Stylelint DESIGN.md token enforcement
3. Vitest unit + integration (must pass 100%)
4. Playwright E2E on staging (10 flows)
5. Visual regression vs baseline (threshold: 0.1% pixel diff)
6. Lighthouse CI: Performance ≥ 90, Accessibility ≥ 95
7. Deploy to Cloudflare Pages + Workers
8. Smoke tests (12 endpoints)
9. Rollback on any failure
```

---

## Risk Assessment & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Admin consolidation breaks existing workflows | Medium | High | Parallel run old/new for 1 sprint; feature flags |
| DESIGN.md token enforcement breaks legacy pages | High | Medium | Incremental migration + allowlist during transition |
| WebSocket scaling on Cloudflare free tier | Low | High | Durable Objects + connection pooling; monitor |
| i18n content gaps at launch | Medium | Medium | Content audit checklist; fallback to English |
| Visual regression flakiness | Medium | Low | Stable test data; snapshot approval workflow |

---

## Acceptance Criteria (Definition of Done)

### Backend
- [ ] OpenAPI spec at `/api/docs` with all 50+ routes documented
- [ ] All migrations applied to D1 (local + staging + prod)
- [ ] 1533/1533 tests passing + new contract tests
- [ ] PayOS webhook idempotency verified with duplicate payloads

### Frontend
- [ ] `@/components/aura` exports 30+ primitives with Storybook stories
- [ ] 0 stylelint violations (DESIGN.md tokens enforced)
- [ ] 12 consolidated public pages (from 57)
- [ ] 12 consolidated admin pages (from 142)
- [ ] All Stitch designs implemented as Aura compositions
- [ ] Playwright visual regression: 0 pixel diff vs Stitch exports

### UX
- [ ] Lighthouse: Perf ≥ 90, A11y ≥ 95, Best Practices ≥ 90
- [ ] WCAG 2.1 AA: contrast, focus, ARIA, keyboard nav
- [ ] Mobile-first: 375px baseline, works at 320px
- [ ] Offline: menu browsable, cart persists, orders sync on reconnect

### Localization
- [ ] 100% Vietnamese strings externalized
- [ ] English fallback for all keys
- [ ] Local content (menu, zones, story) populated from CMS/JSON

---

## File Ownership Matrix (for Parallel Execution)

| Phase | Files | Owner |
|-------|-------|-------|
| 1.1-1.4 | `worker/src/routes/*.ts`, `worker/schema.sql`, `worker/db/migrations/*.sql` | Backend |
| 2.1-2.3 | `src/components/aura/**`, `.stylelintrc.json`, `src/styles/brand-tokens.css` | Frontend Core |
| 3.1 | `src/pages/stitch/*/index.tsx`, `src/routes/stitch-routes.tsx` | Frontend Pages |
| 3.2 | `src/pages/admin/**` (consolidate), `src/routes/admin-routes.tsx` | Admin UX |
| 3.3 | `src/pages/stitch/mobile-ordering/**`, `src/routes/mobile-routes.tsx` | Mobile |
| 4.1-4.3 | `worker/src/tree/kds/**`, `src/hooks/use-kds.ts`, `worker/src/lib/websocket.ts` | Realtime |
| 5.1-5.2 | `src/locales/**`, `src/components/aura/patterns/LocalizedContent.tsx` | Content |
| 6.1-6.3 | `playwright.config.ts`, `tests/e2e/**`, `scripts/deploy.sh` | QA/DevOps |

---

## Next Steps

1. **Review this plan** — confirm scope, priorities, timeline
2. **Approve Phase 1 start** — backend hardening can begin immediately
3. **Assign owners** — map phases to team members
4. **Set up tracking** — create phase files with detailed TODOs

---

**Plan Location:** `plans/260826-1652-container-cafe-restructuring/plan.md`  
**Report Location:** `plans/reports/container-cafe-restructuring-260826-1652-report.md`