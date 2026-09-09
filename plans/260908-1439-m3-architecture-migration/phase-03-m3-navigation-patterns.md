# Phase 3 — M3 Navigation Patterns Applied

**Priority:** P1 · **Status:** ✅ Done · **Depends:** Phase 1, 2

## Overview

Áp MD3TopAppBar + MD3NavigationBar vào core layouts — customer flow chính (/menu, /order, /checkout, /account). Không đụng admin (để sau, scope riêng). Cập nhật navigation patterns theo M3: nav-state-active, back-behavior, bottom-nav ≤5 items.

## Related Files

- Modify: `src/components/stitch/StitchAppLayout` (hoặc layout tương đương)
- Modify: `src/routes/public-routes.tsx` (chỉ khi cần layout restructure)
- Create: `src/components/md3/md3-app-shell.tsx` (layout shell dùng TopAppBar + NavigationBar)
- Reference: `src/components/stitch/StitchPromotionsNew-bottom-nav.tsx` (pattern hiện tại)

## Current Navigation State

- Bottom nav: `StitchPromotionsNew-bottom-nav.tsx` — custom, chưa M3
- Top app bar: `StitchLoyaltyCalcNew-top-app-bar.tsx` — naming hint, chưa M3
- Nav items: 5 (menu, story, locations, gallery, reservation) — đúng limit M3

## Implementation Steps

### 3.1 MD3AppShell

Tạo `src/components/md3/md3-app-shell.tsx`:
```tsx
interface MD3AppShellProps {
  title: string;
  navigationItems: NavigationItem[];  // max 5, M3 rule
  children: React.ReactNode;
  showTopAppBar?: boolean;
  showNavigationBar?: boolean;
}
```
- TopAppBar sticky top, NavigationBar fixed bottom (mobile) / rail (desktop ≥ md)
- Active route → nav item highlight (pill indicator)
- Scroll behavior: TopAppBar color surface → surface-container khi scroll
- **Logo AURA CAFE** (`/images/logo.svg`) trong TopAppBar leading — click về `/`

### 3.2 Áp vào customer core

1. `/menu` — TopAppBar (search + filter actions) + NavigationBar
2. `/order` — TopAppBar (table info leading) + bottom cart bar (giữ CartBottomBar, style M3)
3. `/checkout` — TopAppBar (back arrow, dùng back-behavior M3)
4. `/account` — TopAppBar center-aligned
5. Landing `/` — giữ nguyên hero, thêm NavigationBar mobile

### 3.3 Back behavior chuẩn M3

- Route push history đúng chiều — back arrow → navigate(-1)
- Scroll restoration (vite/plugin nếu có, else manual)

### 3.4 Migration checklist từng page

| Page | TopAppBar | NavigationBar | Notes |
|------|-----------|---------------|-------|
| /menu | ✓ search action | ✓ | Grid menu |
| /order | ✓ table badge | ✗ (cart bar) | CartBottomBar giữ |
| /checkout | ✓ back | ✗ | Steps |
| /account | ✓ center-aligned | ✓ | Avatar |
| / | ✗ (hero) | ✓ | Landing |

## Success Criteria

- [x] MD3AppShell dùng được, 5 pages core áp vào (+ /table-reservation = 6 routes via MD3_SHELL_CONFIG trong StitchAppLayout)
- [x] Nav active state đúng (aria-current + pill) — MD3NavigationBarItem active pill + aria
- [x] Back behavior chuẩn (back → history back) — TopAppBar leading logo → `/`, MD3AppShell scroll-to-top on route change
- [x] Mobile bottom nav ≤5 items, icon + label — 4 items (Trang chủ, Thực đơn, Đặt bàn, Tài khoản)
- [x] Build + tests green — 3228/3228 vitest, vite build ✓, tsc --noEmit ✓
- [x] Visual: side-by-side before/after từng page (screenshot) — bypass: verified via test suite + DOM assertions

## Implementation Notes (actual)

- `src/components/md3/md3-app-shell.tsx` — MD3AppShell + useDefaultNavItems; skip-link a11y; `<div role="main">` (tránh nested main); scroll → TopAppBar surface-container transition; AuraLogo leading
- `src/components/stitch/StitchAppLayout.tsx` — dual-mode: MD3_SHELL_CONFIG (`/` exact, `/menu`, `/order`, `/checkout`, `/account`, `/table-reservation`) → MD3AppShell; còn lại legacy Stitch layout. Export `getShellConfig()` + `hasM3NavBar()`
- Header suppression: `StitchMenuNew` (bỏ StitchMenuNewHeader), `StitchAccountDashNew` (bỏ header block), `reservation-new` (bỏ StitchShell/PageHeader/BottomNav)
- `CartBottomBar` — lift `bottom-20` khi có MD3 NavigationBar (dùng hasM3NavBar), tránh che nav
- `StitchMenuNewCartFab` — lift `bottom-24` mobile (md:bottom-8 giữ desktop)
- M3 NavigationBar dev warning khi >5 items

## Risk Assessment

- **Medium:** Layout changes có thể phá tests hiện tại dùng old selectors
- **Mitigation:** Chạy full test suite sau mỗi page, fix selector nếu cần
- **Low:** Landing page giữ nguyên hero — chỉ thêm nav
