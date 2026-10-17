# Plan: Wave 2 UI/UX, Mobile Staff App, i18n, Admin Contracts & Release Gates

**Date**: 2026-10-17
**Work Context**: `/Users/mac/mekong-cli/FnB-Container-Caffe`
**Mode**: `/bootstrap-auto-parallel` → `/brainstorm --deep` → `/plan`
**Status**: Completed (`/cook`)

---

## 1. Deep Brainstorm Summary (`/brainstorm --deep`)

| Track | Root Cause Identified | Strategic Decision |
| :--- | :--- | :--- |
| **Track 1: Mobile Staff App** | `MobileAuthProvider` unmounted; `mobile-login.tsx` uses `window.location.hash` under `BrowserRouter`; `staff` role missing from `ROLE_ACCESS.kds`/`orders`; `mobile-layout-notifications.tsx` reads wrong fields (`title`/`message`/`read` vs `title_vi`/`body_vi`/`read_at`); light `#f8f7f4`/`#ffffff` + banned orange `#F97316` inside dark `OpsShell`. | Mount `MobileAuthProvider` on `/mobile/*`; navigate via `useNavigate()`; unify `aura_auth_token`; add `staff` role to `ROLE_ACCESS`; map notification fields; convert all mobile styles to AURA M3 Dark tokens (`--aura-*` / `--md-sys-color-*`). |
| **Track 2: i18n, Brand & Routes** | 264 flat dot-keys appended at bottom of `vi.json` & `en.json` overwrite nested translations with raw camelCase keys (`"account.error.retry": "retry"`); `DEFAULT_OG_IMAGE` points to missing `/photos/IMG_6691.webp`; dead links (`/about-us`, `/signup`, `/login`, `/dashboard`, `/referrals`); dummy phone `+84 277 123 456` & HCMC location in `events.manifestoLocation`. | Strip/replace corrupted flat dot-keys in `vi.json`/`en.json` and add missing namespaces (`promotions`, `checkin`, `reservations`, `chat`, `common`); point `DEFAULT_OG_IMAGE` to existing `/photos/space-exterior-overview.webp`; fix all dead routes and unify phone `0946 013 633` & Sa Đéc address. |
| **Track 3: Customer Contrast & Data** | White-on-white (`bg-white text-foreground`) in `ReservationForm`, `TableMap`, `TimeSlotPicker`, `OrderTimeline`, `StatusBadge`, `QRCodeOverlay`; nested `<div role="button"><button>` WCAG 4.1.2 violations; `use-promotions.ts` shows inactive/expired promos; `use-loyalty-store.ts` divides `cashbackRate` by `100` twice. | Replace light surfaces with M3 dark surface tokens; remove nested interactive wrappers; add `aria-pressed`/`aria-label`; filter active/unexpired promos; fix cashback calculation (`amount * cashbackRate` when rate `< 1`). |
| **Track 4: Admin UX, Contracts & Gates** | `bg-white text-foreground` across 15 Admin modals/tables (`Customers`, `CustomerModal`, `product-modal`, `range-selector`, `ChatInbox`, `BroadcastPage`, `OrderTicket`); `Customers.tsx` filters by `VIP/LOYAL` instead of `bronze/silver/gold/platinum` and lacks `POST/PATCH/DELETE /api/admin/customers`; `use-admin-orders-store.ts` overwrites `items` array with count; `lint-d1-migrations.mjs` has a Catch-22 on `.down.sql` `DROP TABLE`. | Convert all Admin light cards/selects to M3 dark tokens; align customer tiers + mount CRUD handlers; preserve `itemsList` in `use-admin-orders-store.ts`; fix `Cart.tsx` stale `itemId`; align `deploy-rollback.sh` defaults (`fnb-caffe-container`, `fnb-caffe-db`). |

---

## 2. Parallel Execution Phases & File Ownership

| Phase | File | Scope | File Ownership (Strict Non-Overlapping) | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Phase 01** | [phase-01-mobile-staff-auth-routing-m3-dark.md](phase-01-mobile-staff-auth-routing-m3-dark.md) | Mobile Staff App Auth, Routing, API Contracts & M3 Dark Theme | `src/pages/mobile/**`, `src/routes/mobile-*.tsx`, `src/hooks/use-mobile-auth.tsx`, `vite.config.js` | Completed |
| **Phase 02** | [phase-02-i18n-locales-brand-contact-dead-routes.md](phase-02-i18n-locales-brand-contact-dead-routes.md) | i18n Flat-Key Corruption Fix, Missing Namespaces, OG Asset & Dead Routes | `src/locales/*.json`, `src/lib/i18n.ts`, `config/brand.json`, `src/components/seo/HelmetHead.tsx`, `src/pages/home.tsx`, `src/components/home/five-zone-showcase.tsx`, `src/pages/register/index.tsx`, `src/pages/verify-email/index.tsx`, `src/components/stitch/StitchReferralNew1-layout.tsx`, `src/pages/stitch/luxury-landing/index.tsx`, `src/pages/stitch/order-failure/index.tsx` | Completed |
| **Phase 03** | [phase-03-customer-public-dark-contrast-a11y.md](phase-03-customer-public-dark-contrast-a11y.md) | Customer/Public Dark Contrast, WCAG 4.1.2/ARIA & Promo/Loyalty Math | `src/components/reservation/**`, `src/components/tracking/**`, `src/components/tv-menu/**`, `src/pages/Checkin.tsx`, `src/pages/TableCheckin.tsx`, `src/pages/subscriptions/**`, `src/pages/loyalty.tsx`, `src/hooks/use-promotions.ts`, `src/hooks/stores/use-loyalty-store.ts`, `src/components/stitch/StitchPOSNew-menu-item-card.tsx`, `src/components/stitch/loyalty-reward-card.tsx`, `src/pages/stitch/gallery-new/index.tsx`, `src/pages/stitch/reservation-new/**` | Completed |
| **Phase 04** | [phase-04-admin-dark-cards-store-contracts-gates.md](phase-04-admin-dark-cards-store-contracts-gates.md) | Admin M3 Dark Cards/Modals, Customer/Order/Cart Contracts & Rollback Gate | `src/pages/admin/**`, `src/components/admin/**`, `src/components/kds/**`, `src/hooks/stores/admin/**`, `worker/src/routes/admin-handlers.ts`, `worker/src/routes/features-router.ts`, `scripts/deploy-rollback.sh`, `scripts/lint-d1-migrations.mjs` | Completed |
| **Phase 05** | [phase-05-verification-tests-build-gate.md](phase-05-verification-tests-build-gate.md) | Full Test Suite, Contrast Gate, Typecheck & Production Bundle Verification | `src/**/__tests__/**`, `tests/**` | Completed |
