# Phase A Detailed Implementation Plan — Thiet Ke He Thong & Chat Luong

**Date:** 2026-07-03
**Total Effort:** 14-17 hours
**Priority:** P1 — Do Now
**DB Changes:** None
**API Changes:** None
**New Packages:** None

---

## A1: Design Token Consolidation / Hop Nhat Token Thiet Ke

**Effort:** 1.5-2 hours | **Source:** UI/UX Audit #1 (Color 5/10), #3 (Typography 3/10)

### Technical Design Overview / Thiet Ke Ky Thuat

The codebase has **3 conflicting font families** and a **light-mode Tailwind @theme block on a dark-only site**. Fix at 3 layers:

```
Layer 1: brand-tokens.css -> Correct font-family CSS variables (Cormorant Garamond display + Space Grotesk body)
Layer 2: global.css @theme -> Dark-mode only Tailwind tokens (#0A1A2E bg, #e8e8e8 fg)
Layer 3: Per-page overrides -> Replace inline font-[EB_Garamond,serif] with font-display
```

### Files to Create/Modify

| File | Action | Change |
|------|--------|--------|
| `src/styles/brand-tokens.css` | Modify | Replace Plus Jakarta Sans -> Cormorant Garamond (display) + Space Grotesk (body). Remove legacy gold aliases. Add Google Fonts @import. Fix headline-md from 20px to 24px. |
| `src/styles/global.css` | Modify | Rewrite @theme block with dark-mode values. Remove light-mode entries. |
| `src/styles/stitch-tokens.css` | Modify (verify) | Verify font-family vars match after fix |
| `src/theme/aura-tokens.ts` | Modify | Update darkTokens fontFamily. Remove/mark unused lightTokens |
| `src/theme/use-aura-theme.ts` | Modify | Remove unused lightTokens import |
| `src/pages/AboutUs.tsx` | Modify | Replace font-[EB_Garamond,serif] with font-display |
| `src/pages/Contact.tsx` | Modify | Same font fix |
| `src/pages/ReviewsPage.tsx` | Modify | Same font fix |
| `src/pages/BrandGuideline.tsx` | Modify | Same font fix |
| `DESIGN.md` | Modify | Document canonical chrome hex #C9D6DF |

### Tests

- Brand-token CSS var propagation test (verify --aura-font-display = Cormorant Garamond)
- `npm run build` must pass (0 CSS parse errors, 0 TS errors)
- Grep verification: zero "Plus Jakarta Sans" references remain in `src/`
- `npm test` must pass all existing 1,184 tests (0 regression)

### Acceptance Criteria / Tieu Chi Chap Nhan

- [ ] brand-tokens.css --aura-font-display = Cormorant Garamond
- [ ] brand-tokens.css --aura-font-body = Space Grotesk
- [ ] global.css @theme --color-background = #0A1A2E (dark navy)
- [ ] global.css @theme --color-foreground = #e8e8e8 (light gray)
- [ ] Zero Plus Jakarta Sans references in src/
- [ ] Zero EB Garamond font overrides in any file
- [ ] Headline-md uses 24px (not 20px)
- [ ] Chrome canonical hex #C9D6DF documented in DESIGN.md
- [ ] npm run build = 0 errors, npm test = all pass

### Estimated Hours / Uoc Tinh Gio

| Task | Hours |
|------|-------|
| brand-tokens.css font fixes + imports + gold alias removal | 0.5 |
| global.css @theme dark-mode rewrite | 0.25 |
| Theme files alignment | 0.1 |
| 4 page font overrides | 0.25 |
| DESIGN.md update | 0.1 |
| Build + test verification | 0.25 |
| **Total** | **1.5-2h** |

---

## A2: Generic Component Dark Remedy / Khac Phuc Mau Nen Component

**Effort:** 1.5-2 hours | **Dependencies:** A1 must complete first
**Source:** UI/UX Audit #2 (generic components white-on-dark)

### Technical Design Overview

Components use hardcoded light-mode backgrounds (`bg-white`, `bg-green-100`, `bg-gray-50`, `bg-red-50`) rendering incorrectly on dark navy (#0A1A2E). Fix at component source level using CSS custom properties.

Key issues:
- Button primary: `bg-primary` -> `bg-accent text-black` (invisible -> chrome silver)
- Modal: `bg-white` -> `bg-[var(--aura-bg-elevated)]`
- Skeleton: `bg-muted/30` -> `bg-[var(--aura-bg-high)]/30`
- Badge variants: `bg-green-100` -> `bg-green-500/15`, etc.

### Files to Modify

| File | Change |
|------|--------|
| `src/components/ui/button.tsx` | Primary variant: bg-primary -> bg-accent |
| `src/components/ui/modal.tsx` | bg-white -> bg-[var(--aura-bg-elevated)] |
| `src/components/ui/skeleton.tsx` | bg-muted/30 -> bg-[var(--aura-bg-high)]/30 |
| `src/components/ui/badge.tsx` | All variant bg colors to dark-compatible (+ text colors) |
| `src/components/order/checkout-form.tsx` | bg-white -> bg-[var(--aura-bg-input)] |
| `src/components/order/delivery-info.tsx` | bg-white -> bg-[var(--aura-bg-input)] |
| `src/pages/admin/Dashboard.tsx` | bg-red-50 -> bg-red-500/10, bg-white/80 -> bg-[var(--aura-bg-surface)]/80 |
| `src/pages/admin/PromotionsManager.tsx` | Multiple bg fixes |
| `src/pages/admin/SubscriptionsManager.tsx` | Multiple bg fixes |
| `src/pages/admin/GenerateQR.tsx` | bg-red-50 -> bg-red-500/10, bg-white -> bg-surface |
| `src/pages/admin/InvoiceHistory.tsx` | bg-red-50 -> bg-red-500/10 |
| `src/pages/Checkin.tsx` | Error box colors |
| `src/components/auth/RegisterForm.tsx` | bg-red-50 -> bg-red-500/10 |
| `src/components/auth/LoginForm.tsx` | bg-red-50 -> bg-red-500/10 |
| `src/components/kds/TicketQueue.tsx` | bg-gray-50 -> bg-surface, bg-white -> bg-elevated |
| `src/components/kds/OrderTicket.tsx` | bg-red-50 -> bg-red-500/10 |

### Tests

- Add badge variant tests for dark-mode classes
- Button primary variant class assertion update
- Visual check: navigate every admin page, verify no white boxes on dark bg

### Acceptance Criteria

- [ ] Button primary visible (chrome accent, not invisible dark navy)
- [ ] Modal uses bg-[var(--aura-bg-elevated)]
- [ ] Skeleton uses bg-[var(--aura-bg-high)]/30
- [ ] Badge variants use dark-compatible colors
- [ ] Zero bg-red-50 / bg-green-50 / bg-gray-50 in production files
- [ ] Zero bg-white on components that render on dark page bg
- [ ] npm run build = 0 errors, npm test = all pass

### Estimated Hours

| Task | Hours |
|------|-------|
| Button primary fix | 0.1 |
| Modal + Skeleton bg fix | 0.1 |
| Badge variant colors | 0.15 |
| Checkout/delivery inputs | 0.15 |
| Admin pages (5 pages) | 0.4 |
| Auth + KDS components | 0.2 |
| Build + test verification | 0.15 |
| **Total** | **1.5-2h** |

---

## A3: Emoji to Lucide Migration / Di Chuyen Emoji Sang Lucide

**Effort:** 3-4 hours | **Source:** UI/UX Audit #4 (30+ emoji violations)

### Technical Design Overview

30+ emoji used as icons across the app. Replace 1:1 with Lucide icon components (already in dependencies, `lucide-react: ^1.22.0`).

Key mapping table shows ~35 emoji replaced with `<IconName size={n} aria-hidden="true" />` pattern.

### Files to Modify (16 files)

| # | File | Main Changes |
|---|------|-------------|
| 1 | `src/pages/admin/BroadcastPage.tsx` | Channel option icons (MessageCircle, Smartphone, etc.) |
| 2 | `src/pages/admin/CampaignsManager.tsx` | Trigger emoji -> Lucide component refs |
| 3 | `src/pages/admin/Customers.tsx` | Users icon for empty state |
| 4 | `src/pages/admin/ChatInbox.tsx` | MessageCircle icon |
| 5 | `src/pages/admin/InvoiceHistory.tsx` | FileText icon |
| 6 | `src/pages/AboutUs.tsx` | Heavy emoji usage (~10 emoji) |
| 7 | `src/pages/Contact.tsx` | Remaining emoji |
| 8 | `src/pages/ReviewsPage.tsx` | Coffee icon |
| 9 | `src/components/menu/menu-card.tsx` | Category icons (~12 emoji) |
| 10 | `src/components/menu/menu-grid.tsx` | Search icon |
| 11 | `src/components/order/checkout-form.tsx` | Zap, Calendar, Lock |
| 12 | `src/components/order/payment-method-selector.tsx` | DollarSign, Landmark |
| 13 | `src/components/order/delivery-info.tsx` | Verify no remaining emoji |
| 14 | `src/components/home/five-zone-showcase.tsx` | Zone icons (Leaf, Sunrise, etc.) |
| 15 | `src/components/home/hero-section.tsx` | Badge emoji |
| 16 | `src/components/admin/StatsCard.tsx` | Icon prop fix |

**Type changes needed:**
- CampaignsManager: `TRIGGER_EMOJI: Record<Trigger, string>` -> `Record<Trigger, React.ComponentType<{size?: number}>>`
- BroadcastPage: `CHANNEL_OPTIONS icon: string` -> `icon: LucideIcon`

### Tests

- BroadcastPage unit: verify channel icons render as Lucide components
- CampaignsManager: verify trigger icons render as Lucide
- PaymentMethodSelector: verify payment icons as Lucide
- Emoji detection grep: zero emoji unicode characters in src/

### Acceptance Criteria

- [ ] Zero emoji characters in production code (src/)
- [ ] All emoji replaced with Lucide icon components
- [ ] All decorative icons have aria-hidden="true"
- [ ] npm run build = 0 errors
- [ ] npm test = all pass
- [ ] Grep check returns 0 matches (excluding node_modules)

### Estimated Hours

| Task | Hours |
|------|-------|
| BroadcastPage migration | 0.5 |
| CampaignsManager trigger icons | 0.25 |
| Customers, ChatInbox, InvoiceHistory | 0.15 |
| AboutUs (heaviest) | 0.5 |
| Contact, ReviewsPage | 0.15 |
| Menu card category icons | 0.3 |
| Checkout form, payment, delivery | 0.3 |
| Five zone showcase icons | 0.25 |
| Hero section + StatsCard | 0.2 |
| Build + test + emoji scan | 0.25 |
| **Total** | **3-4h** |

---

## A4: Test Suite Stabilization & Coverage / On Dinh Bo Test

**Effort:** 5-6 hours | **Dependencies:** A1, A2, A3 (run AFTER all three)

### Technical Design Overview

Phase A changes (CSS token overhaul, component bg fixes, emoji substitutions) may cause regressions in snapshot tests, bg assertions, and emoji-related tests. Fix regressions, then add new coverage.

**6-phase approach:**
1. Baseline validation (before A1-A3) -> capture 1184/1184
2. Run after A1 -> fix CSS class reference tests
3. Run after A2 -> fix bg class assertions
4. Run after A3 -> fix emoji-related assertions
5. New tests for changed components
6. Add E2E coverage gaps

### Files to Create (New Tests)

| File | What It Tests |
|------|---------------|
| `src/pages/admin/__tests__/BroadcastPage.test.tsx` | Channel rendering, Lucide icons, form validation |
| `src/pages/admin/__tests__/CampaignsManager.test.tsx` | Trigger icons, campaign rendering |
| `src/components/ui/__tests__/badge.test.tsx` | All 5 dark variant classes |
| `src/components/ui/__tests__/skeleton.test.tsx` | 3 variants, aria-hidden |
| `src/components/order/__tests__/payment-method-selector.test.tsx` | Payment icons as Lucide |
| `tests/e2e/phase-a-visual-regression.spec.ts` | Screenshot comparisons for key pages |
| `tests/e2e/phase-a-admin-flows.spec.ts` | Broadcast form flow, campaign toggle |
| `tests/e2e/phase-a-a11y.spec.ts` | axe-core scan on Home, Menu, Admin |

### Files to Modify (Existing Tests)

- Button test: update `bg-primary` assertion to `bg-accent`
- Modal test: update `bg-white` assertion to `bg-[var(--aura-bg-elevated)]`
- Card test: verify glass-panel class propagated
- Checkout test: update emoji text assertions to expect Lucide SVG
- Menu card test: update category icon assertions

### Acceptance Criteria

- [ ] npm test = 1184+ tests passing (target 1200+)
- [ ] npm run build = 0 errors
- [ ] All existing tests pass with assertion updates (no removal)
- [ ] New BroadcastPage unit test covers channels, form validation
- [ ] New CampaignsManager test covers trigger icons, campaign rendering
- [ ] New Badge test covers all 5 variant colors
- [ ] E2E: visual regression passes, axe-core 0 critical/serious violations
- [ ] No :any types in test files

### Estimated Hours

| Task | Hours |
|------|-------|
| Identify and fix regressions from A1-A3 | 1.5 |
| BroadcastPage unit tests | 0.75 |
| CampaignsManager unit tests | 0.5 |
| Badge + Skeleton + Menu icon tests | 0.5 |
| PaymentMethodSelector test | 0.25 |
| E2E visual regression + admin flows | 1.25 |
| E2E a11y spec + full suite run | 0.5 |
| **Total** | **5-6h** |

---

## A5: A11y & UX Polish Sprint / Cai Thien Truy Cap & Trai Nghiem

**Effort:** 2-3 hours | **Dependencies:** None (parallel to A1-A4)

### Technical Design Overview

Address remaining accessibility and UX issues from audit findings #6-15.

**Priority order:**
1. Add `<html lang="vi">` (30s, high a11y impact)
2. Add `/reviews` route (fix broken nav link)
3. Navbar active page indicator with `aria-current="page"`
4. Touch targets >= 44px (WCAG 2.5.5 compliance)
5. Container padding: px-4 -> px-6 on desktop
6. Page transitions (CSS fade-in, 200ms)
7. Spring easing on card hover
8. Button press state `active:scale-[0.97]`

### Files to Modify

| File | Change |
|------|--------|
| `index.html` | Add `<html lang="vi">` |
| `src/App.tsx` | Add /reviews route -> ReviewsPage |
| `src/components/ui/navbar.tsx` | Active page indicator via useLocation() + aria-current |
| `src/components/ui/button.tsx` | active:scale-[0.97], min-h-11 touch target |
| `src/components/menu/menu-card.tsx` | Add button min-h-11 min-w-11 |
| `src/components/order/cart-item.tsx` | +/- buttons min-h-11 min-w-11 |
| `src/components/ui/footer.tsx` | Social icon min-h-11 min-w-11 |
| `src/pages/home.tsx` | Section padding py-20 -> py-12, px-4 -> px-6 |
| `src/styles/global.css` | Add @view-transition, spring easing vars, fade animation |
| `src/components/ui/card.tsx` | Spring easing on hover: scale-[1.02] |
| `src/components/home/five-zone-showcase.tsx` | Section padding fix |

### Acceptance Criteria

**Accessibility:**
- [ ] `<html lang="vi">` present
- [ ] /reviews route works (not 404)
- [ ] Navbar shows active page with aria-current="page"
- [ ] All icon buttons >= 44x44px touch targets
- [ ] axe-core scan: 0 critical/serious violations

**UX Polish:**
- [ ] Card hover uses spring easing cubic-bezier(0.34, 1.56, 0.64, 1)
- [ ] Buttons have active:scale-[0.97] press state
- [ ] Page transitions: fade-in on route change
- [ ] Section spacing consistent at py-12 (48px)
- [ ] Desktop container padding = px-6 (24px)

**Quality:**
- [ ] npm run build = 0 errors
- [ ] npm test = all pass
- [ ] UI/UX re-audit score >= 8/10

### Estimated Hours

| Task | Hours |
|------|-------|
| lang="vi" + /reviews route | 0.1 |
| Navbar active indicator + aria-current | 0.3 |
| Touch targets (button, cart, menu-card, footer) | 0.3 |
| Section spacing + container padding | 0.3 |
| Spring easing on card + page transitions | 0.3 |
| active:scale press state | 0.1 |
| Build + test verification | 0.25 |
| **Total** | **2-3h** |

---

## Phase A Quality Gates Summary / Tong Cong

| Gate | Standard |
|------|----------|
| Build | `npm run build` = 0 TypeScript errors |
| Tests | `npm test` = 1184+ passing, target 1200+ |
| Types | Zero `:any` types |
| Logs | Zero `console.log` in production |
| Emoji | Zero emoji characters in production UI |
| Colors | Zero light-mode CSS tokens (bg-white, bg-red-50, etc.) |
| A11y | axe-core: 0 critical/serious violations |
| HTML | `<html lang="vi">` |
| Re-audit | UI/UX score >= 8/10 |
| DESIGN.md | Canonical chrome hex documented |
| Design Tokens | Single source of truth: brand-tokens.css -> global.css -> components |
| Touch Targets | All interactive elements >= 44px |
