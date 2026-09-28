# Phase 4 — Shell & Route Architecture Specification

**Status:** APPROVED FOR EXECUTION  
**Date:** 2026-09-20  
**Scope:** Strict 3-Shell Governance, Route Isolation, CartBottomBar Boundary, and Admin/Ops Chrome Standardization

---

## 1. The 3 Authoritative Shell Boundaries

Every production UI surface in the application MUST belong to exactly ONE of the three authoritative shells:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           AURA OS SHELLS                                │
├─────────────────────────┬─────────────────────────┬─────────────────────┤
│ 1. CustomerShell        │ 2. OpsShell             │ 3. AdminShell       │
│    (Public / Customer)  │    (Station / KDS / POS)│    (HQ / Management)│
├─────────────────────────┼─────────────────────────┼─────────────────────┤
│ • Mobile-first PWA      │ • Permanent Noir Dark   │ • High-density HQ   │
│ • 5-Tab Customer IA     │ • Station tablet / TV   │ • Sidebar drawer nav│
│ • MD3 NavigationBar     │ • No customer nav bar   │ • No customer nav   │
│ • MD3 TopAppBar         │ • No CartBottomBar      │ • No CartBottomBar  │
│ • CartBottomBar ONLY    │ • Offline indicator     │ • Role-protected    │
│ • Light/Dark responsive │ • Touch-optimized tiles │ • Table data views  │
└─────────────────────────┴─────────────────────────┴─────────────────────┘
```

---

## 2. Shell Isolation & Route Ownership Matrix

### 2.1 CustomerShell Routes (`src/routes/public-routes.tsx` + `src/routes/stitch-routes.tsx`)
- `/` (Home)
- `/container`, `/about`, `/contact`, `/brand`, `/gallery`
- `/menu`, `/menu/:id` (M4-B Customer DTO)
- `/table-reservation`, `/events`
- `/account`, `/loyalty`, `/referral`, `/subscriptions`
- `/checkout`, `/checkin`, `/track-order`, `/order-success`, `/order-failure`
- `/stitch/*` (Customer landing & showcase pages)

### 2.2 OpsShell Routes (`src/App.tsx` + `src/routes/mobile-routes.tsx`)
- `/kds` (Kitchen Display System)
- `/tv-menu` (Signage / TV Menu)
- `/pos/table/:tableId` (Table POS)
- `/stitch/order-management` (Ops Order Terminal)
- `/mobile/*` (`/mobile/kds`, `/mobile/orders`, `/mobile/tables`, `/mobile/notifications`, `/mobile/profile`)

### 2.3 AdminShell Routes (`src/routes/admin-routes.tsx`)
- `/admin` (Protected root via `ProtectedRoute`)
- `/admin/dashboard`, `/admin/metrics`, `/admin/orders`, `/admin/pos`
- `/admin/customers`, `/admin/staff`, `/admin/reservations`, `/admin/table-management`
- `/admin/manage-menu`, `/admin/promotions`, `/admin/campaigns`, `/admin/subscriptions`
- `/admin/sales-reports`, `/admin/invoice-history`, `/admin/audit-logs`
- `/admin/devices`, `/admin/generate-qr`, `/admin/notification-settings`, `/admin/erpnext-sync`
- `/admin/dindin/*` (B2B / Catering flows)

---

## 3. Core Architectural Rules

1. **CartBottomBar Isolation:** `CartBottomBar` is rendered ONLY inside `CustomerShell`. It is strictly absent from `OpsShell` and `AdminShell`.
2. **Offline Resilience:** `OpsShell` maintains its station-level network status monitoring (`data-testid="ops-offline-indicator"`) and Noir Void background (`bg-[var(--aura-noir-void)]`).
3. **Protected Boundary:** All `AdminShell` routes are wrapped with `ProtectedRoute` requiring staff/manager/owner roles.
4. **Shell Configuration:** `getShellConfig(pathname)` in `src/components/stitch/shell-config.ts` controls top app bar and navigation bar visibility per route.

---

## 4. Verification Gate

- `npx tsc --noEmit` — 0 errors.
- `npx vitest run src/components/stitch/__tests__/shells.test.tsx` — 100% green.
- `npx vitest run` — all 3,480 tests pass.
- `npm run build` — Vite build succeeds.
