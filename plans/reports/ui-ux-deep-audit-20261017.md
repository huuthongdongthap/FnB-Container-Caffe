# Deep UI/UX Audit & Brainstorm Report — AURA CAFE (`FnB-Container-Caffe`)
**Date:** 2026-10-17
**Mode:** `/bootstrap-auto-parallel` → `/brainstorm --deep`
**Scope:** M3 Design System, Brand/Logo/Address Truth, Customer Flows & WCAG 2.1 AA, Admin/POS/KDS Ergonomics

---

## 1. Brainstorm Contract (4 Fields)

| Field | Specification |
|-------|---------------|
| **Outcome** | 100% UI/UX compliant with M3 Dark Industrial-Luxury tokens, Brand Truth (`29 Nguyễn Tất Thành` + unclipped Master Logo), WCAG 2.1 AA accessibility, and zero dead/mock controls across Customer + Admin/POS/KDS flows. |
| **Constraints** | - Preserve existing 3,228 unit tests + build green (`0 TS errors`).<br>- Strictly enforce `aura-store-address-and-logo-spec` (no circular crop on Master Logo; address `29 Nguyễn Tất Thành, Phường 1, TP. Sa Đéc, Đồng Tháp — Đối diện Khách sạn Thảo Trâm 2`).<br>- Keep Viva Star supplier provenance intact per `viva-star-supplier-brand-truth`.<br>- Keep code files modular (<200 lines where refactored). |
| **Non-goals** | - No backend DB schema changes.<br>- No payment gateway (PayOS/MoMo) contract changes.<br>- No removal of Viva Star supplier data fields. |
| **Acceptance Criteria** | 1. `0` occurrences of `39 Nguyễn Tất Thành` / `27 Nguyễn Tất Thành` / wrong wards; landmark `Đối diện Khách sạn Thảo Trâm 2` present.<br>2. `0` circular masks (`rounded-full object-cover`) on AURA Master Logo.<br>3. `npm run check:contrast` checks all 11 M3 color pairs (including `inverse-surface`, `surface-variant`, `background`) at 100% PASS.<br>4. Customer `/menu` checkout CTA, `DrinkCustomizerModal`, `/order-tracking` real data, and single-shell navigation working end-to-end.<br>5. POS VND formatting, KDS station polling (`pending,preparing,ready`), and Admin/POS/KDS dead buttons wired or removed. |

---

## 2. Executive Summary of Verified Findings (Evidence)

### P0 — Critical Functional & Security UX Bugs (Broken User Journeys)
1. **100x Currency Division Bug on Track Order & Account Reorder (`src/pages/stitch/track-order/index.tsx:58,65`, `src/components/stitch/StitchAccountDashNew-orders.tsx:76`)**:
   - Divides VND amounts (`unitPriceCents / 100`, `totalAmount / 100`), turning `45.000₫` into `450`, which `formatPrice()` in `StitchTrackOrderNew-order-summary.tsx:17-20` renders as **`$450.00`** instead of **`45.000₫`**.
   - `StitchAccountDashNew-orders.tsx:56-57` checks `order.items` while `src/pages/account/index.tsx:169-178` only populates `order.rawItems`, causing "Reorder" to always exit early.
2. **Duplicate App-Shell Headers & Bottom Bars (`src/components/stitch/CustomerShell.tsx:13-14`, `src/components/stitch/shell-config.ts:10-45`, `src/components/cart/cart-bottom-bar.tsx:19-20,49`)**:
   - `CustomerShell.tsx:13-14` defaults unconfigured routes (`/order-success`, `/events`, `/subscriptions`, `/reviews`) to `showNav = true` and `showTop = true`, while `hasM3NavBar()` in `shell-config.ts:43-45` defaults to `false`, causing `CartBottomBar` (`bottom-0 z-[60]`) to overlap `MD3NavigationBar` (`bottom-0 z-50 h-20`).
   - Duplicate top headers stack at `top-0 z-40/z-50` on `/menu` (`menu.tsx:141` `LandingNav`), `/order` (`TableOrder.tsx:300` `LandingNav` + `StitchMobileOrderNew-header.tsx:29` `OrderHeader`), `/loyalty` (`loyalty.tsx:96` `LoyaltyHeader`), `/track-order` (`StitchTrackOrderNew.tsx:66` `TopBar`), `/order-success` (`StitchOrderSuccessNew.tsx:99`), and `/table-reservation` (`reservation-new/index.tsx:167`).
   - Duplicate bottom navs stack on `/account` (`StitchAccountDashNew.tsx:102` `DashBottomNav` where Reserve/Orders/Loyalty all link to `/menu`) and `/track-order` (`StitchTrackOrderNew-bottom-nav.tsx:29,39` linking to non-existent `/orders` and `/profile` 404 routes).
3. **`DrinkCustomizerModal` State Persistence Bug & Bypassed Customization (`src/components/menu/DrinkCustomizerModal.tsx:41-46,86-90`, `src/components/menu/recommendation-section.tsx:81-83,106`)**:
   - `sweetness`, `ice`, `size`, `selectedToppings`, `notes`, and `quantity` are never reset via `useEffect` when `item` or `open` changes.
   - `RecommendationSection` calls `addItem(...)` directly instead of `onSelectItem`, bypassing customization.
4. **Order Success Hardcoded Progress & Three.js Resize Listener Leak (`src/pages/order-success.tsx:144-160`, `src/components/stitch/StitchOrderSuccessNew-summary.tsx:132-135`, `src/components/stitch/StitchOrderSuccessNew-tracking.tsx:26-99`)**:
   - `order-success.tsx` subscribes to SSE order updates but never passes `currentOrder.status` to `StitchOrderSuccessNew`, leaving progress hardcoded at step 1 (`PREPARING`).
   - `ThreeRingOverlay` (`StitchOrderSuccessNew-tracking.tsx:99`) calls `window.removeEventListener('resize', () => {})` with a new anonymous function, leaking the resize listener.
5. **PWA `SWUpdatePrompt` Dismiss Button Reloads Page (`src/components/pwa/SWUpdatePrompt.tsx:48`)**:
   - Clicking `"Để sau"` (Later/Dismiss) calls `window.location.reload()` instead of dismissing the banner.
6. **KDS Orders Disappear After "START PREP" (`src/hooks/use-kds.ts:104-106`, `src/components/stitch/stitch-kds-order-card.tsx:45,175-179`)**:
   - Polling query fetches `/api/admin/orders?status=pending` only — `preparing` and `ready` tickets vanish on refresh/station filter.
   - Overdue `"PRIORITY COMPLETE"` button (`line 175`) calls `onStart(ticket.id)` instead of `onComplete(ticket.id)`.
7. **POS Renders VND Prices as USD `$45000.00` & Overlaps Admin Sidebar (`src/components/stitch/StitchPOSNew-menu-item-card.tsx:43`, `StitchPOSNew-cart-sidebar.tsx:106,140,151`, `src/routes/admin-routes.tsx:44,63`)**:
   - Formats VND values with `$${price.toFixed(2)}`.
   - Hardcodes `MENU_CATEGORIES = ['Coffee', 'Tea', ...]` (`StitchPOSNew-types.ts:49`), filtering out Vietnamese categories from D1.
   - Mounted inside `AdminShell` so `w-72` left sidebar + `w-96` right POS cart crush tablet viewports to `352px`.
8. **Admin Login Client-Side Owner Bypass (`src/pages/admin/Login.tsx:46-62`)**:
   - `handleGuestLogin` injects `{ id: 'guest-admin', role: 'owner' }` directly into `useAuthStore` without server auth.

---

### P0 — Brand Truth: Store Address & Master Logo Violations
1. **Circular Crop on Master Logo (6 Violations of `aura-store-address-and-logo-spec`)**:
   - `src/components/md3/md3-app-shell.tsx:82-89` (`rounded-full ... object-cover`)
   - `src/components/home/hero-section.tsx:122-133` (`rounded-full ... overflow-hidden ... object-cover`)
   - `src/components/stitch/StitchLayout.tsx:31-38` (`rounded-full ... object-cover`)
   - `src/components/stitch/StitchLandingNew-nav.tsx:71-78` (`rounded-full ... object-cover`)
   - `src/components/stitch/StitchLandingNew-footer.tsx:27-34` (`rounded-full ... object-cover`)
   - `src/pages/SystemHub.tsx:411-418` (`rounded-full ... object-cover`)
2. **Forbidden Outdated Store Addresses (58 Total Occurrences)**:
   - `39 Nguyễn Tất Thành`: 37 occurrences (`README.md:3`, `src/styles/brand-tokens.css:5`, `public/brand-tokens.css:5`, `src/locales/vi.json:81,95,632,1349,1372,1379,1460,1637`, `src/locales/en.json:81,95,1370,1377`, `public/locales/vi/translation.json:244`, `public/locales/en/translation.json:244`, `src/pages/stitch/our-story/our-story-hero.tsx:20`, `src/pages/stitch/contact-new/index.tsx:21,55`, `public/stitch-designs/*.html:362`, plus 15 test assertions/fixtures).
   - `27 Nguyễn Tất Thành`: 2 occurrences (`public/translations.json:51,117`).
   - Wrong ward/street/typo: `Ward 2` (`src/locales/en.json:1458`), `Phường Sa Đéc` (`src/components/contact/LocationMap.tsx:9-11`), `29 Nguyen Tat Than` + `(000) 000-0000` (`src/components/stitch/StitchContactNew-contact-info.tsx:22-33`), `Đường Nguyễn Sinh Sắc, Phường 2` (`src/pages/stitch/luxury-landing/index.tsx:112`), `đường Hùng Vương` (`public/translations.json:17,19,59,83,85,125`).
   - Missing landmark: `Đối diện Khách sạn Thảo Trâm 2` is currently `0` occurrences across the codebase.
3. **Broken Image References & `AuraImage` Fallback Bug**:
   - `src/components/ui/AuraImage.tsx:42-58`: Rewrites `.webp` `<img src>` to non-existent `.png` files, and `.jpg` `<source srcSet>` to non-existent `.webp` files.
   - Missing `/images/night-4k.webp` (`src/components/seo/HelmetHead.tsx:12`, `src/pages/home.tsx:41`) and `/icons/mask-icon.svg` (`index.html:16`).

---

### P1 — M3 Design System, Tokens & CSS Architecture Defects
1. **Inverted Dark-Theme M3 Tokens (`src/styles/aura-tokens.css:115-128`)**:
   - `--md-sys-color-background: var(--aura-pearl-50)` (`#FAFAF8` light) with `--md-sys-color-on-background: #F5F5F5` → **1.04:1 contrast (FAIL)**.
   - `--md-sys-color-surface-variant: var(--aura-chrome-100)` (`#E8ECEF` light) with `--md-sys-color-on-surface-variant: #C9D6DF` → **1.19:1 contrast (FAIL)**.
   - `--md-sys-color-inverse-surface: var(--aura-noir-void)` (`#050814` dark) with `--md-sys-color-inverse-on-surface: #0A1A2E` (dark) → **1.13:1 contrast (FAIL)** — breaks `src/components/md3/md3-snackbar.tsx:53`.
2. **67 Undefined CSS Custom Properties Referenced in Code**:
   - `src/styles/global.css:57,74-80,202-205`: `--aura-on-primary`, `--aura-radius-{sm,md,lg,xl,2xl}`, `--aura-duration-fast`, `--aura-glass-blur`, `--aura-glass-border`.
   - `src/components/ui/drawer.tsx:36`: `--aura-bg-elevated`, `--aura-shadow-lg` (causes transparent Drawer background).
   - `src/components/ui/adapters/SkeletonAdapter.tsx:25`: `--aura-bg-high`.
3. **Duplicate `brand-tokens.css` Load (1,182 Lines Loaded Twice)**:
   - Bundled via `src/styles/global.css:3` AND linked via `index.html:23` (`/brand-tokens.css`).
4. **Runtime Font Override & Unloaded Fonts**:
   - `src/config/brand-theme.ts:16` (`injectBrandTheme` in `src/main.tsx:25`) overwrites `--aura-font-display` (`Quicksand`) with `'Be Vietnam Pro'` at runtime.
   - `src/pages/Menu.tsx:196,269` uses `Space_Grotesk` and `Plus_Jakarta_Sans` which are not loaded in `index.html`.
5. **Raw Hex / `bg-white` / Banned Gold Hex**:
   - 701 raw hex occurrences outside `var()` across 85 files (concentrated in legacy `TableReservation.tsx`, `RoasteryPage.tsx`, `Menu.tsx`, `CustomerDisplay.tsx`, `KDSScreen.tsx`).
   - Banned Gold/Amber (`#D4AF37`, `#FFD700`) still in `TableReservation.tsx:78,224`, `CustomerDisplay.tsx:87`, `PointsToast.tsx:58`, `OrderSuccess.tsx:22`, `RecommendationCarousel.tsx:86`.
   - Light-mode `bg-white border-gray-200` cards inside dark Admin pages (`src/pages/admin/Analytics.tsx:244`, `Bookings-calendar-view.tsx:84`).

---

### P2 — WCAG 2.1 AA Accessibility & Mobile Touch Target Gaps
1. **Modals & Off-Screen Drawers Missing Dialog Semantics / Focus Trap / Inert State (`WCAG 2.1.1, 2.1.2, 2.4.3, 4.1.2`)**:
   - `src/components/menu/DrinkCustomizerModal.tsx:86-90`: Missing `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `Escape` key handler, and focus trap.
   - `src/components/ui/drawer.tsx:33-58` & `src/components/stitch/StitchLandingNew-nav.tsx:163-240`: Remain mounted in the DOM with `role="dialog" aria-modal="true"` when closed (`translate-x-full`) without `inert` or `aria-hidden={!open}`, leaving hidden buttons in keyboard Tab order.
   - `src/components/chat/ChatWidget.tsx:76-159`: Missing `role="dialog"`, `Escape` handler, and `role="log" aria-live="polite"`.
   - `src/components/menu/ItemDetailDrawer.tsx:113-128`, `src/components/loyalty/PointsRedeemModal.tsx:47-166`, `src/components/order/SplitBillModal.tsx:59`, `src/pages/stitch/gallery-new/index.tsx:243-249`: Missing dialog roles / Escape / focus trap.
2. **Invalid Landmarks, Roles & Missing Form Error Associations (`WCAG 1.3.1, 3.3.1, 4.1.2`)**:
   - Nested `<main>` inside `div[role="main"]` (`src/components/md3/md3-app-shell.tsx:163-166` vs child `<main>` tags; `StitchMobileOrderNew.tsx:99,113`).
   - `src/components/md3/md3-navigation-bar.tsx:43,78`: Uses `role="tab"` directly inside `<nav role="navigation">` without `role="tablist"` (should use `aria-current="page"`).
   - `src/components/md3/md3-top-app-bar.tsx:51-57`: Hardcodes `aria-label="Navigation menu"` on the leading AURA logo button that navigates to `/`.
   - `src/pages/TableOrder-components.tsx:73-90` (`GuestInfoForm`): Inputs rely only on `placeholder` with no `<label>` or `aria-label`.
   - `src/components/stitch/StitchCheckoutNew-field.tsx:38-55` & `StitchCheckoutNew.tsx:353,402,423`: Inputs lack `aria-invalid` and `aria-describedby` linking to validation errors.
   - Clickable `<div onClick>` cards without `role="button" tabIndex={0} onKeyDown` in `src/pages/stitch/reservation-new/zone-selector.tsx:42-49` and `src/pages/stitch/gallery-new/index.tsx:207-211`.
3. **Sub-44px Touch Targets (`WCAG 2.5.5`) & Missing `env(safe-area-inset-bottom)`**:
   - `StitchMenuNew-search-bar.tsx:33-39` (`16×16px` clear button), `DrinkCustomizerModal.tsx:114-121,271-290` (`36×36px` close, `28×28px` `-/+`), `StitchCheckoutNew-order-summary.tsx:94-157` (`28×28px` delete, `36×36px` `-/+`), `StitchMobileOrderNew-header.tsx:38-64` (`20×20px` back/cart), `StitchTrackOrderNew-top-bar.tsx:18-24` (`24×24px` back), `StitchPOSNew-menu-item-card.tsx:47-75` (`28×28px` `-/+`), `kds-toolbar.tsx:18-33` (`28×28px` sound/fullscreen).
   - Fixed bottom bars (`src/components/md3/md3-navigation-bar.tsx:46`, `src/components/cart/cart-bottom-bar.tsx:48`, `src/components/pwa/OrderQueueIndicator.tsx:79`) lack `pb-[env(safe-area-inset-bottom)]`.

---

## 3. Strategic Approaches (Max 3)

| Approach | Scope | Pros | Cons |
|----------|-------|------|------|
| **A. Surgical High-Impact Remediation (Recommended — YAGNI/KISS)** | Fix all P0 (Customer/POS/KDS broken flows + Brand Address/Logo + missing assets), P1 (M3 inverted tokens + 67 undefined CSS vars + duplicate CSS + contrast gate), and P2 (WCAG AA dialogs, `aria-label`, >=44px touch targets, mobile widget collision) across active routes. | Fixes 100% of user-visible bugs, brand rules, contrast failures, and a11y gaps in 1 focused sprint without risky churn in unused legacy files. | Leaves raw hex inside unrouted legacy files (`src/pages/Menu.tsx`) unless cleaned up or removed. |
| **B. Full Sweep Including Legacy File Purge & 701 Raw Hex Migration** | Everything in Approach A + migrate all 701 raw hex values across 85 files + split all 14 files >200 lines. | 100% static grep purity across every file in `src/`. | Touches 90+ files; higher regression surface on secondary admin screens. |
| **C. Design-System-Only Patch** | Fix only `aura-tokens.css`, `global.css`, logo crops, and `29 Nguyễn Tất Thành` address strings. | Fastest (~15 mins). | Leaves broken `/menu` checkout CTA, POS `$` currency bug, and KDS polling bug unfixed. |

---

## 4. Recommendation

**Choose Approach A (Surgical High-Impact Remediation in 4 Parallel Workstreams):**
1. **Workstream 1 — Brand Truth, Address & Assets (`aura-store-address-and-logo-spec`):**
   - Replace all 58 outdated/wrong address occurrences (`39`/`27 Nguyễn Tất Thành`, `Ward 2`, `Phường Sa Đéc`, `Nguyen Tat Than`, `Nguyễn Sinh Sắc`, `Hùng Vương`) with `29 Nguyễn Tất Thành, Phường 1, TP. Sa Đéc, Đồng Tháp (Đối diện Khách sạn Thảo Trâm 2)` + update matching unit tests.
   - Replace circular `rounded-full object-cover` masks on all 6 logo components (`md3-app-shell.tsx`, `hero-section.tsx`, `StitchLayout.tsx`, `StitchLandingNew-nav.tsx`, `StitchLandingNew-footer.tsx`, `SystemHub.tsx`) with M3 rectangular plaque (`rounded-xl object-contain p-1`) preserving 100% of AURA flourishes.
   - Fix `AuraImage.tsx` `.webp`/`.png` broken rewrite logic and `HelmetHead.tsx` / `home.tsx` OG image path.
2. **Workstream 2 — M3 Token & CSS Architecture Integrity:**
   - Fix inverted dark-theme tokens in `src/styles/aura-tokens.css:115-128` (`--md-sys-color-background`, `--md-sys-color-surface-variant`, `--md-sys-color-inverse-surface`, `--md-sys-color-inverse-on-surface`) and add those pairs to `scripts/contrast-check.mjs`.
   - Define the missing CSS token aliases (`--aura-on-primary`, `--aura-radius-*`, `--aura-glass-blur`, `--aura-glass-border`, `--aura-bg-elevated`, `--aura-bg-high`, `--aura-shadow-lg`) in `aura-tokens.css` / `global.css`.
   - Remove duplicate `<link rel="stylesheet" href="/brand-tokens.css" />` from `index.html:23` and fix `injectBrandTheme()` font conflict.
   - Replace remaining banned Gold hex (`#D4AF37`, `#FFD700`) and dark-admin `bg-white` cards (`Analytics.tsx`, `Bookings-calendar-view.tsx`).
3. **Workstream 3 — Customer Flow & WCAG 2.1 AA Accessibility:**
   - Wire `onCheckout={() => navigate('/checkout')}` and `DrinkCustomizerModal` into `src/pages/menu-page.tsx` & `StitchMenuNew.tsx`.
   - Resolve double TopAppBar / BottomNavBar between `MD3AppShell` and Stitch full-page layouts + fix mobile bottom-right widget overlap (`LiveChatWidget`, `FloatingOrderBar`, `BackToTop`, `MD3NavigationBar` safe-area).
   - Wire real order data + cancel/lookup state into `StitchOrderTrackingNew.tsx`.
   - Add `role="dialog"`, `aria-modal="true"`, Escape key, `aria-label`, `htmlFor`/`id`, and `>=44px` (`min-h-11 min-w-11`) touch targets on customer controls.
4. **Workstream 4 — Admin, POS & KDS Operational UX:**
   - Fix POS VND price formatting (`formatVND` instead of `$${price.toFixed(2)}`), category filtering (`All` + Vietnamese DB categories), card body `onClick={onAdd}`, cart reset on checkout, and `/admin/pos` layout collision with `AdminShell`.
   - Fix KDS polling query (`status=pending,preparing,ready`), overdue button handler (`onComplete`), elapsed prop sync, and touch target sizes (`>=44px`).
   - Remove or gate `handleGuestLogin` owner bypass in `src/pages/admin/Login.tsx` and wire/clean up dead buttons in Admin Shell & Orders.

---

## 5. Unresolved Questions

1. **Legacy Unrouted Pages (`src/pages/Menu.tsx`, `src/components/kds/TicketQueue.tsx`):** Should we keep them in tree or archive/delete them so they no longer contribute raw hex noise?
2. **Double Navigation Chrome (`MD3AppShell` vs Stitch Page Headers/BottomNavs):** Should `MD3AppShell` be the single unified shell (hiding redundant Stitch internal top/bottom navs when inside `MD3AppShell`), or should Stitch pages bypass `MD3AppShell`? *(Recommendation: Keep `MD3AppShell` as single source of truth and suppress duplicate inner navs).*
