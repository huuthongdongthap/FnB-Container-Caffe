# AURA OS — Shell Matrix & Experience Boundary Audit

This document defines the 3 authoritative Experience Shells of AURA OS, audits existing shell implementations, and resolves structural defects.

---

## 1. Multi-Shell Architecture Overview

```
                      ┌───────────────────────────────┐
                      │        AURA Application       │
                      │         (src/App.tsx)         │
                      └───────────────┬───────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  CustomerShell   │         │     OpsShell     │         │    AdminShell    │
│ (src/components/ │         │ (src/components/ │         │ (src/components/ │
│  stitch/         │         │  stitch/         │         │  stitch/         │
│  CustomerShell)  │         │  OpsShell)       │         │  AdminShell)     │
├──────────────────┤         ├──────────────────┤         ├──────────────────┤
│ • Mobile/PWA M3  │         │ • KDS/POS/TV     │         │ • HQ Admin/ERP   │
│ • 5 Canonical    │         │ • High-contrast  │         │ • Navigation     │
│   Tabs           │         │   Dark (Noir)    │         │   Drawer (M3)    │
│ • CartBottomBar  │         │ • ZERO Customer  │         │ • High-density   │
│   (Owned HERE)   │         │   Navigation     │         │   Data Grids     │
│ • Luxury Navy    │         │ • ZERO Cart Bar  │         │ • Pearl Surface  │
└──────────────────┘         └──────────────────┘         └──────────────────┘
```

---

## 2. Shell Specification & Boundary Comparison

| Specification | CustomerShell | OpsShell | AdminShell | Orphan: MobileLayout |
|---|---|---|---|---|
| **Target Role** | Guest, Customer, Member | Barista, Chef, Cashier, Station | Manager, HQ Admin, Finance | Waiter / Floor Staff |
| **Primary Form Factor** | Mobile PWA (360–430px), Tablet | Fixed Wall TV, Tablet Landscape (10–12") | Desktop (1280–1920px), Laptop | Mobile Phone |
| **Base Surface Token** | `--md-sys-color-surface` / `--aura-bg-page` | `--aura-noir-void` (`#050814`) | `--aura-pearl-50` (`#FAFAF8`) | Hardcoded inline `#0B132B` |
| **Primary Accent** | Chrome `--aura-chrome-500` / Bronze `--aura-bronze-500` | High-vis Status (Blue/Amber/Emerald/Crimson) | Chrome Navy `--aura-navy-700` | Hardcoded hexes |
| **Top Bar** | `MD3TopAppBar` (Dynamic title/variant via `shell-config.ts`) | OpsStationHeader (Station ID, clock, audio toggle) | AdminTopBar (Breadcrumbs, search, store picker, user) | Custom inline header |
| **Primary Navigation** | `MD3NavigationBar` (5 bottom tabs) | **None** (Full screen station view) | `MD3NavigationDrawer` (Collapsible sidebar) | Custom bottom tab bar |
| **CartBottomBar** | **Active (Owned)** | **FORBIDDEN (Zero leak)** | **FORBIDDEN (Zero leak)** | Forbidden |
| **Density Setting** | Comfortable (Touch ≥ 48dp) | Touch-optimized Operational (Large cards) | Compact / High-density data (`density.css`) | Inline styles |
| **Auth Requirement** | Optional / Guest allowed | Station Token / Staff Pin | ProtectedRoute (Admin role) | Token in localStorage |

---

## 3. Shell Audit & Identified Defects

### Defect 1: CartBottomBar Leaks Outside CustomerShell
- **Location:** `src/App.tsx:68`
- **Root Cause:** `<CartBottomBar />` is mounted directly under `<BrowserRouter>` outside `<Routes>`. It uses `useLocation()` to compute vertical offset via `hasM3NavBar(pathname)` but relies solely on `totalItems() > 0` to decide visibility.
- **Consequence:** If a user adds an item to cart and navigates to `/kds`, `/tv-menu`, or `/admin/orders`, the green/chrome floating Customer Cart Bar renders on top of the operational interface.
- **Remediation (Phase 1):** Move `<CartBottomBar />` directly inside `CustomerShell.tsx` as a child element of `CustomerShell`. Completely isolate `OpsShell` and `AdminShell`.

### Defect 2: AdminShell Duplication & Bypass
- **Location:** `src/components/stitch/AdminShell.tsx` vs `src/pages/admin/AdminLayout.tsx` vs `src/routes/admin-routes.tsx`
- **Root Cause:**
  - `AdminShell.tsx` contains 5 lines delegating to `AdminLayout`.
  - `AdminLayout.tsx` contains 11 lines delegating to `StitchAdminTerminalNew`.
  - `admin-routes.tsx` directly imports `AdminLayout` from `@/pages/admin/AdminLayout`, completely bypassing `AdminShell.tsx`!
- **Consequence:** Violates `Shell ≠ Route ≠ Page`. A page acts as a layout, and the declared shell is unused.
- **Remediation (Phase 1):** Move the canonical admin layout logic into `src/components/stitch/AdminShell.tsx` (using `StitchAdminTerminalNew` or unified M3 Drawer). Update `admin-routes.tsx` to wrap its routes in `<AdminShell />`. Deprecate `AdminLayout.tsx`.

### Defect 3: OpsShell Visual Under-Specification
- **Location:** `src/components/stitch/OpsShell.tsx`
- **Root Cause:**
  ```tsx
  <div className="min-h-screen bg-[var(--md-sys-color-surface-container-lowest)] text-[var(--md-sys-color-on-surface)]">
    <ErrorBoundary>{children ?? <Outlet />}</ErrorBoundary>
  </div>
  ```
  `--md-sys-color-surface-container-lowest` evaluates to near-white in light mode. Ops stations (KDS, TV Menu) demand permanent dark mode with `--aura-noir-void` (`#050814`) to prevent screen burn-in and maintain high legibility in bright kitchen lighting.
- **Remediation (Phase 1):** Update `OpsShell.tsx` to explicitly enforce `bg-[var(--aura-noir-void)] text-white dark` and include station connectivity/status chrome.

### Defect 4: Orphaned `MobileLayout`
- **Location:** `src/pages/mobile/mobile-layout.tsx`
- **Root Cause:** Staff mobile routes (`/mobile/kds`, `/mobile/orders`, `/mobile/tables`) run on a detached layout with inline React styles (`style={wrap}`) rather than MD3 or Tailwind tokens.
- **Remediation (Phase 4):** Standardize mobile staff routes under `OpsShell` (or dedicated mobile responsive view within `OpsShell`) using standard M3 primitives.
