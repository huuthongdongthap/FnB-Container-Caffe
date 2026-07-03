# Phase A: Design System Remediation & Quality Gate

**Date:** 2026-07-03
**Status:** Planned
**Priority:** P1
**Branch:** `main`
**Source Validation:** UI/UX Pro Max Audit (5/10 score, 15 validated findings)
**Production:** https://auraspace.cafe
**Current tests:** 1184 passing (116 suites)

---

## Overview

Phase A covers the 5 validated workstreams identified by the UI/UX Pro Max audit (2026-07-03) that scored the application 5/10 overall. These are the highest-priority items confirmed through comprehensive auditing — font/color/emoji/bg issues that degrade the industrial-luxury brand experience.

**Total estimated effort:** 14-20 hours

## Workstreams

| Phase | Name | Effort | Files Touched | Priority | Source |
|-------|------|--------|---------------|----------|--------|
| A1 | Design Token Consolidation | 1.5-2h | 8 modify | P1 Critical | Audit #1, #3, #5 |
| A2 | Generic Component Dark Remedy | 1.5-2h | 15+ modify | P1 Critical | Audit #2 |
| A3 | Emoji to Lucide Migration | 3-4h | 16 modify | P1 Critical | Audit #4 |
| A4 | Test Suite Stabilization & E2E | 5-6h | 5 new test files | P1 High | Post-stitch regression |
| A5 | A11y & UX Polish Sprint | 2-3h | 10+ modify | P2 High | Audit #6-10, #12 |
| **Total** | | **14-17h** | **~50 files** | | |

## Architecture Impact

- **No database changes** — all Phase A work is frontend-only
- **No API changes** — no new endpoints needed
- **No new production components** — fixes to existing components only
- **CSS architecture:** Fix token references at source (brand-tokens.css, global.css) to propagate correctly to all consumers
- **Lucide icons:** Already a dependency; no new packages needed

## Dependency Graph

```
A1 ──► A2 ──► A4
 ├────► A4 (indirect)
A3 ──► A4 (direct: emoji→icon changes may break emoji tests)
A5 (independent — can run in parallel)
```

- A1 must complete first: component fixes depend on correct `@theme` tokens
- A2 depends on A1: component backgrounds use `@theme` tokens
- A3 is independent of A1/A2: pure cosmetic substitution
- A4 runs AFTER A1, A2, A3: fixes regressions from all three
- A5 is independent: UX improvements on any timeline

## File Change Map

```
CSS Layer (A1)
  src/styles/brand-tokens.css         ─── font fix + gold alias cleanup + Google Fonts import
  src/styles/global.css               ─── @theme dark-mode rewrite + spring easing + transitions
  src/styles/stitch-tokens.css        ─── verify alignment
  src/theme/aura-tokens.ts            ─── fontFamily update
  src/theme/use-aura-theme.ts         ─── import cleanup

Pages (A1/A3/A5)
  src/pages/AboutUs.tsx               ─── font fix + emoji → Lucide
  src/pages/Contact.tsx               ─── font fix + emoji → Lucide
  src/pages/ReviewsPage.tsx           ─── font fix + emoji → Lucide
  src/pages/BrandGuideline.tsx        ─── font fix
  src/pages/home.tsx                  ─── spacing standardization
  src/pages/Checkin.tsx               ─── dark bg fix
  src/pages/admin/BroadcastPage.tsx   ─── emoji → Lucide
  src/pages/admin/CampaignsManager.tsx── emoji → Lucide
  src/pages/admin/Customers.tsx       ─── emoji → Lucide
  src/pages/admin/ChatInbox.tsx       ─── emoji → Lucide
  src/pages/admin/InvoiceHistory.tsx  ─── emoji → Lucide
  src/pages/admin/Dashboard.tsx       ─── dark bg fix
  src/pages/admin/PromotionsManager.tsx── dark bg fix
  src/pages/admin/SubscriptionsManager.tsx── dark bg fix
  src/pages/admin/GenerateQR.tsx      ─── dark bg fix

Components (A2/A3/A5)
  src/components/ui/button.tsx        ─── primary fix + active:scale-97 + touch target
  src/components/ui/modal.tsx         ─── bg fix
  src/components/ui/skeleton.tsx      ─── bg fix
  src/components/ui/badge.tsx         ─── dark variant colors
  src/components/ui/navbar.tsx        ─── active page indicator + touch targets
  src/components/ui/card.tsx          ─── spring easing
  src/components/ui/footer.tsx        ─── social icon touch targets
  src/components/menu/menu-card.tsx   ─── emoji → Lucide + touch target
  src/components/menu/menu-grid.tsx   ─── emoji → Lucide
  src/components/order/checkout-form.tsx── emoji → Lucide + dark bg
  src/components/order/payment-method-selector.tsx── emoji → Lucide
  src/components/order/delivery-info.tsx── emoji → Lucide + dark bg
  src/components/order/cart-item.tsx  ─── touch target
  src/components/home/five-zone-showcase.tsx── emoji → Lucide + spacing
  src/components/home/hero-section.tsx── emoji → Lucide
  src/components/admin/StatsCard.tsx  ─── emoji → Lucide
  src/components/auth/*.tsx           ─── dark bg fix
  src/components/kds/*.tsx            ─── dark bg fix

Infrastructure
  index.html                         ─── lang="vi"
  src/App.tsx                        ─── /reviews route
  src/styles/global.css              ─── page transitions
  DESIGN.md                          ─── canonical chrome hex

New Test Files (A4)
  tests/e2e/phase-a-visual-regression.spec.ts
  tests/e2e/phase-a-admin-flows.spec.ts
  tests/e2e/phase-a-a11y.spec.ts
  src/pages/admin/__tests__/BroadcastPage.test.tsx
  src/pages/admin/__tests__/CampaignsManager.test.tsx
  src/components/ui/__tests__/badge.test.tsx
  src/components/ui/__tests__/skeleton.test.tsx
  src/components/order/__tests__/payment-method-selector.test.tsx
```

## Detailed Plans

Each workstream has a dedicated plan document in this directory:

| Document | Workstream |
|----------|------------|
| `A1-design-token-consolidation.md` | Font + color token fix |
| `A2-generic-component-dark-remedy.md` | Dark-mode component backgrounds |
| `A3-emoji-to-lucide-migration.md` | Emoji → Lucide icon migration |
| `A4-test-suite-stabilization.md` | Test fixes + new coverage |
| `A5-a11y-ux-polish.md` | A11y + UX improvements |

## Rollback Strategy

Each phase has its own rollback documented inline. Global rollback:

```bash
# Revert ALL Phase A changes
git checkout HEAD~50 -- src/ index.html tests/ DESIGN.md
npm run build
npm test
```

## Quality Gates

- [ ] `npm run build` = 0 TypeScript errors
- [ ] `npm test` = 1184+ tests pass (0 regression; target 1200+)
- [ ] Zero `:any` types in production code
- [ ] Zero `console.log` in production code
- [ ] Zero emoji characters in production UI (Lucide only)
- [ ] No light-mode CSS tokens (`bg-white`, `bg-red-50`, etc.) in production code
- [ ] All generic components render with dark-mode compatible backgrounds
- [ ] UI/UX re-audit scores >= 8/10
- [ ] axe-core scan: 0 critical/serious violations
- [ ] `<html lang="vi">` present
- [ ] `/reviews` route functional
- [ ] Canonical chrome hex documented in DESIGN.md
