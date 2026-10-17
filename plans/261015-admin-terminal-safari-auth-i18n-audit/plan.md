# Plan: Fix Admin Terminal Safari Auth (401), Missing i18n Keys & CSS Token Leaks

## Overview
- **Status:** Ready for execution (`/fix` / `/cook`)
- **Source:** `[Image #2]` (`auraspace.cafe` Admin Terminal on macOS Safari) + Playwright WebKit/Chromium E2E Audit
- **Root Causes Identified (4 Core Clusters):**
  1. **Safari ITP Cross-Origin Cookie Block + Discarded Bearer Token (`401 Unauthorized — vui lòng đăng nhập`)**
     - `auraspace.cafe` (Pages) calls `aura-space-worker.sadec-marketing-hub.workers.dev` (Worker). WebKit/Safari ITP blocks cross-site `Set-Cookie: access_token=...; SameSite=None`.
     - `POST /api/auth/login` (`worker/src/tree/auth/login.ts:81-86`) already returns `{ user, token }` in JSON, and `getAuthToken()` (`worker/src/lib/jwt.ts:132-136`) already checks `Authorization: Bearer <token>` first.
     - However, `src/hooks/stores/use-auth-store.ts:34-46` discards `token` from the login response, and `src/lib/api-client.ts:83-86` never sends `Authorization: Bearer <token>`.
     - Worse, `src/pages/admin/Login.tsx:35-48` catches the failed `fetchMe()` on Safari, injects a fake in-memory user (`id: 'admin-01', role: 'owner'`) with no token, and routes to `/admin`, causing all 20 `/admin/*` routes to fail with `401 Unauthorized — vui lòng đăng nhập` and flood `POST /api/client-error` (`500` / `429`).
  2. **Corrupted CSS Variable String in Admin Sidebar (`Terminal var(--aura-noir-void, #050D1A)`)**
     - `src/components/stitch/StitchAdminTerminalNew.tsx:25`: bulk hex replacement corrupted `'Terminal #04'` into `terminalId = 'Terminal var(--aura-noir-void, #050D1A)'`, rendered in `StitchAdminTerminalNew-sidebar.tsx:119` and `StitchAdminTerminalNew-topbar.tsx:41`.
     - Additional broken CSS token replacements in `StitchReferralNew2-steps.tsx:84`, `StitchContactNew-form-field.tsx:48,59`, `StitchGalleryNew-gallery-card.tsx:22`, `StitchMenu2New-footer.tsx:35`.
  3. **Missing i18n Namespaces & Keys (`terminal.*`, `orderMgmt.*`, `salesReports.*`, `invoices.*`, `audit.*`)**
     - `0/39` `terminal.*` keys and `0/6` `orderMgmt.*` keys exist in `src/locales/vi.json` and `src/locales/en.json` — rendering raw keys (`terminal.managementTitle`, `terminal.searchPlaceholder`, `terminal.generateReport`, `terminal.logout`, `terminal.errorTitle`, `terminal.retry`) in `[Image #2]`.
     - Playwright DOM audit across all 20 `/admin/*` routes also caught missing keys in `salesReports.*` (24 keys), `invoices.*` (19 keys), `audit.*` (39 keys), `adminMetrics.retry`, `qrCodes.retry` namespace mismatch, `TableManagement.tsx:26` double-prefix (`admin.tableManagement.*` inside `useTranslation('admin')`), and `src/lib/i18n.ts:7-8` overwriting flat `chat.*` keys.
  4. **CSP Font Blocks & Client Error Beacon Loop**
     - `POST /api/client-error` (`src/lib/api-client.ts:49-69`) fires on every `401`/`403`, triggering `500`/`429` storms when unauthenticated.

## Phases & Checklist
- [x] **Phase 1: Safari-Proof Bearer Auth & Session Persistence**
  - [x] Persist `token` & `user` in `src/hooks/stores/use-auth-store.ts` (`localStorage` key `aura_auth_token` / `aura_auth_user`) and capture `{ token, user }` directly from `POST /api/auth/login` & `POST /api/auth/register`.
  - [x] Attach `Authorization: Bearer <token>` in `src/lib/api-client.ts` (`apiFetch`) and skip `POST /api/client-error` beacons for `401`/`403` auth statuses.
  - [x] Remove fake `admin-01` fallback on failed login in `src/pages/admin/Login.tsx:35-48`; wire Logout button in `StitchAdminTerminalNew-sidebar.tsx:123-130` to `useAuthStore.getState().logout()`.
  - [x] Hydrate auth on reload in `src/components/auth/AuthProvider.tsx` & `src/components/auth/ProtectedRoute.tsx`; unify duplicate `apiFetch` in `src/pages/admin/menu-api.ts` and `src/pages/admin/subscription-api.ts`; add `?token=` fallback in `worker/src/lib/jwt.ts` for Safari SSE (`EventSource`).
- [x] **Phase 2: Fix Corrupted CSS Token Strings (`Terminal var(--aura-noir-void, #050D1A)`)**
  - [x] Restore `terminalId = 'Terminal #04'` in `src/components/stitch/StitchAdminTerminalNew.tsx:25`.
  - [x] Fix corrupted inline CSS token syntax in `StitchReferralNew2-steps.tsx:84`, `StitchContactNew-form-field.tsx:48,59`, `StitchGalleryNew-gallery-card.tsx:22`, and `StitchMenu2New-footer.tsx:35`.
- [x] **Phase 3: Complete Admin & Stitch i18n Dictionaries (`vi.json` + `en.json` + `i18n.ts`)**
  - [x] Add all 39 `terminal.*` keys and 6 `orderMgmt.*` keys to `src/locales/vi.json` and `src/locales/en.json`.
  - [x] Add missing `salesReports.*` (24 keys), `invoices.*` (19 keys), `audit.*` (39 keys), `adminLogin.*AriaLabel` (15 keys), and `adminMetrics.retry`/`refreshing` to `src/locales/vi.json` and `src/locales/en.json`.
  - [x] Fix namespace collisions in `src/lib/i18n.ts:7-8` (merge instead of overwrite `namespaces[key]`), `src/pages/admin/TableManagement.tsx:26`, and `src/pages/admin/GenerateQR.tsx:21`.
- [x] **Phase 4: Playwright Verification & Production Readiness**
  - [x] Run unit tests + typecheck + build verification (441/441 test suites passed, 4,017/4,017 tests passed, 0 typecheck errors, 0 lint errors, build succeeded in 4.25s).
  - [x] Playwright WebKit (Mobile Safari) & Desktop Chrome E2E verification passed (6/6 tests passed).
  - [x] Short route aliases (`/admin/menu`, `/admin/tables`, `/admin/analytics`, `/admin/finance`, `/admin/marketing`, `/admin/qr`, `/admin/settings`) redirect with `<Navigate replace />`.
  - [x] CSP Google Fonts whitelisted in `_headers`; Service Worker cache bumped to `aura-static-v4` in `public/sw.js`.
