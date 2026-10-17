# Phase 01: Mobile Staff App Auth, Routing, API Contracts & M3 Dark Theme

## Context Links
- Overview Plan: `plans/20261017-mobile-admin-i18n-contrast-wave2/plan.md`
- Tokens Reference: `src/styles/aura-tokens.css` (`[data-shell="ops"]`)

## Overview
- **Priority**: P0 (Blocker for Staff Mobile PWA)
- **Current Status**: Pending
- **Description**: Eliminate the split-brain theme/auth architecture in the Mobile Staff App (`/mobile/*`) by mounting `MobileAuthProvider`, fixing `BrowserRouter` navigation, unifying token storage keys, unlocking `staff` role access on KDS/Orders, fixing notification field mapping, and migrating all light-theme/orange `#F97316` inline styles to AURA M3 Dark Industrial-Luxury tokens.

## Key Insights
1. `MobileAuthProvider` (`src/hooks/use-mobile-auth.tsx:85`) is never mounted; `mobile-login.tsx:135` sets `window.location.hash = '#/mobile'` under `BrowserRouter`, leaving staff stuck on `/mobile/login#/mobile`.
2. `staff-auth.ts:229` normalizes kitchen device roles to `'staff'`, but `ROLE_ACCESS.kds` and `ROLE_ACCESS.orders` in `src/pages/mobile/mobile-layout-constants.ts:4-5` omit `'staff'`, locking kitchen staff out of KDS.
3. `src/pages/mobile/mobile-layout-notifications.tsx:24-30` reads `nb.title`, `nb.message`, `nb.read` whereas `GET /mobile/notifications` returns `title_vi`, `title_en`, `body_vi`, `body_en`, `read_at`.
4. `mobile-login.tsx`, `table-manager.tsx`, `waiter-orders-constants.ts`, `mobile-layout-styles.ts`, and `mobile-layout-profile.tsx` hardcode light `#f8f7f4`/`#ffffff` surfaces and banned `#F97316` orange inside dark `OpsShell` (`#050814`).

## Requirements
- **Functional**:
  - Mount `MobileAuthProvider` in `src/routes/mobile-routes.tsx` (or `mobile-route-hosts.tsx`).
  - Use `useNavigate()` in `mobile-login.tsx` to navigate to `/mobile` on login and `/mobile/login` on logout.
  - Keep `aura_auth_token` and `mobile_token` synchronized in `use-mobile-auth.tsx` so `apiFetch` always sends the freshest token.
  - Add `'staff'` to `ROLE_ACCESS.kds` and `ROLE_ACCESS.orders` in `mobile-layout-constants.ts`.
  - Map `title_vi || title_en || title`, `body_vi || body_en || message`, and `Boolean(read_at) || Boolean(read)` in `mobile-layout-notifications.tsx`.
  - Fetch orders unconditionally in `waiter-orders.tsx` even if `tables` is empty, and check all `order.items` in `kitchen-display.tsx` `deriveStation()`.
- **Non-Functional**:
  - Zero `#F97316`, `#f8f7f4`, or `#ffffff` background cards in `src/pages/mobile/*` and `src/routes/mobile-route-hosts.tsx`.

## Related Code Files
- `src/hooks/use-mobile-auth.tsx`
- `src/routes/mobile-routes.tsx`
- `src/routes/mobile-route-hosts.tsx`
- `src/pages/mobile/mobile-login.tsx`
- `src/pages/mobile/mobile-layout-constants.ts`
- `src/pages/mobile/mobile-layout-styles.ts`
- `src/pages/mobile/mobile-layout-profile.tsx`
- `src/pages/mobile/mobile-layout-notifications.tsx`
- `src/pages/mobile/table-manager.tsx`
- `src/pages/mobile/waiter-orders.tsx`
- `src/pages/mobile/waiter-orders-constants.ts`
- `src/pages/mobile/waiter-orders-new-order-modal.tsx`
- `src/pages/mobile/kitchen-display.tsx`
- `src/pages/mobile/kitchen-display-order-card.tsx`
- `vite.config.js`

## Implementation Steps
1. Update `src/hooks/use-mobile-auth.tsx` to write both `mobile_token` and `aura_auth_token` (and `aura_user_data`, `aura_device_token`) on login and refresh, and clear both on logout.
2. Wrap mobile routes in `<MobileAuthProvider>` inside `src/routes/mobile-routes.tsx` and update `MobileProfilePage` logout handler in `src/routes/mobile-route-hosts.tsx` to navigate to `/mobile/login`.Replace `text-[#F97316]` in `mobile-route-hosts.tsx:55` with `text-[var(--md-sys-color-primary)]`.
3. Update `src/pages/mobile/mobile-login.tsx` to call `useNavigate()('/mobile', { replace: true })` and replace all light-theme/orange styles with AURA M3 dark tokens (`var(--aura-noir-void)`, `var(--aura-noir-mid)`, `var(--md-sys-color-primary)`, `var(--md-sys-color-on-surface)`).
4. Add `'staff'` to `ROLE_ACCESS.kds` and `ROLE_ACCESS.orders` in `src/pages/mobile/mobile-layout-constants.ts`.
5. Fix notification payload normalization in `src/pages/mobile/mobile-layout-notifications.tsx` (`title_vi`/`body_vi`/`read_at`) and wire mark-as-read (`POST /mobile/notifications/:id/read`).
6. Migrate `mobile-layout-styles.ts`, `mobile-layout-profile.tsx`, `table-manager.tsx`, and `waiter-orders-constants.ts` from light `#f8f7f4`/`#ffffff`/`#F97316` to M3 Dark Industrial-Luxury tokens.
7. Fix `waiter-orders.tsx` so `fetchOrders()` runs on mount regardless of `tables.length`, and update `deriveStation()` in `kitchen-display.tsx` to inspect all items in an order.

## Todo List
- [ ] Sync `aura_auth_token` + `mobile_token` in `use-mobile-auth.tsx` and mount `MobileAuthProvider`
- [ ] Fix `mobile-login.tsx` router navigation and M3 dark styling
- [ ] Add `'staff'` to `ROLE_ACCESS` in `mobile-layout-constants.ts`
- [ ] Fix `mobile-layout-notifications.tsx` field mapping (`title_vi`, `body_vi`, `read_at`)
- [ ] Convert `mobile-layout-styles.ts`, `mobile-layout-profile.tsx`, `table-manager.tsx`, `waiter-orders-constants.ts` to M3 dark tokens
- [ ] Fix `waiter-orders.tsx` initial fetch and `kitchen-display.tsx` multi-item station detection

## Success Criteria
- Zero `#F97316` or `#f8f7f4` occurrences in `src/pages/mobile/` and `src/routes/mobile-route-hosts.tsx`.
- Logging in on `/mobile/login` navigates cleanly to `/mobile` under `BrowserRouter`.
- Notifications display `title_vi`/`body_vi` and unread indicator accurately.
