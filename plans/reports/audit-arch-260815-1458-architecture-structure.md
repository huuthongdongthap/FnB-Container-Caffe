# Architecture Audit Report — AURA CAFE

**Date:** 2026-08-15
**Scope:** Full `src/` directory structure, naming, imports, dead code, file sizes
**Total files:** 1181 TS/TSX | ~90K LOC

---

## Audit Findings

### [HIGH] Dual Store Architecture — Stores Spread Across 3 Locations

- Files: `src/stores/`, `src/hooks/stores/`, `src/tree/`
- Issue: Zustand stores live in 3 different directories with no clear convention:
  - `src/stores/` — Empty (only test file `cart-store.test.ts`)
  - `src/hooks/stores/` — 16 stores (auth, cart, order, loyalty, etc.)
  - `src/hooks/stores/admin/` — 10 admin stores
  - `src/tree/analytics/` — 6 analytics store files (types, constants, setters, fetchers, utils + main store)
  - `src/tree/audit/` — 1 audit store
  - `src/tree/payments/` — 1 refund store
- Impact: Confusing for new contributors. 73 files import from `@/hooks/stores/`, 5 import from `@/tree/`, 0 from `@/stores/`.
- Recommendation: Consolidate all stores into `src/stores/` (or `src/hooks/stores/` if that's the chosen location). Migrate `tree/` stores. Remove empty `src/stores/` or repurpose it.

---

### [HIGH] `src/tree/` Directory — Non-Standard Naming

- Files: `src/tree/analytics/`, `src/tree/audit/`, `src/tree/payments/`
- Issue: `tree` is not a recognized architectural term in React codebases. Contains stores + types + fetchers. Only 3 consumers import from it (all in `pages/admin/` AuditLogViewer).
- Impact: Unclear purpose. Violates standard project structure conventions.
- Recommendation: Rename to `src/stores/analytics/`, `src/stores/audit/`, `src/stores/payments/` (or flatten into stores root).

---

### [MEDIUM] Stitch Pages Directory — 47 Subdirectories Under `src/pages/stitch/`

- Path: `src/pages/stitch/`
- Issue: 47 page subdirectories + `StitchBase.tsx` at root level. Many stitch pages are lazy-loaded and serve as "screen prototypes" (e.g., `luxury-cafe-1`, `luxury-cafe-2`, `luxury-landing`, `mobile-ordering`, `referral-rewards-1`, `referral-rewards-2`).
- Impact: `stitch/` now contains 403 component files (in `components/stitch/`) and 187 page files. This is the largest section by far.
- Recommendation: Audit which stitch pages are actually routed vs. dead prototypes. Archive or remove unused variants (e.g., `referral-rewards-1` vs `referral-rewards-2`).

---

### [MEDIUM] Legacy Pages Coexist With Stitch Pages

- Files: `src/pages/home.tsx`, `src/pages/menu.tsx`, `src/pages/checkout.tsx`, `src/pages/loyalty.tsx`, `src/pages/referral.tsx`, `src/pages/events.tsx`, `src/pages/order-success.tsx` + stitch equivalents
- Issue: Both old-style pages (`src/pages/home.tsx`) and new stitch pages (`src/pages/stitch/home/`) exist. Routes (`public-routes.tsx`) import old pages, while `stitch-routes.tsx` imports stitch pages.
- Impact: Dual page systems running in parallel. Old pages import directly from `@/components/stitch/` for some components.
- Recommendation: Determine if old pages are deprecated. If so, remove them and consolidate routing to stitch variants.

---

### [MEDIUM] Root-Level Pages Mix PascalCase and kebab-case

- Files: `src/pages/AboutUs.tsx`, `src/pages/KDS.tsx`, `src/pages/TVMenu.tsx` vs `src/pages/brand-voice-section.tsx`, `src/pages/loyalty-calculator.tsx`, `src/pages/loyalty-header.tsx`
- Issue: 6 PascalCase files + 14 kebab-case files directly in `src/pages/`. Also: `ReviewsPage.tsx`, `ReviewsPage-pagination.tsx`, `ReviewsPage-write-review-form.tsx` — mixed PascalCase-kebab hybrid.
- Impact: Inconsistent file naming in the same directory. Grep/find results are harder to parse.
- Recommendation: Standardize to kebab-case for all files. PascalCase only for React component files that are default-exported (optional, but pick one).

---

### [MEDIUM] `as any` Type Assertions — 3 Files

- Files:
  - `src/pages/mobile/mobile-login.tsx` — `as any`
  - `src/components/pwa/PwaInstallBannerEnhanced.tsx` — `as any`
  - `src/hooks/stores/use-order-store.ts` — `as any`
- Issue: TypeScript strict mode is enabled (`tsconfig.json`: `"strict": true`), but 3 files use `as any` escape hatches.
- Impact: Defeats type safety at those points.
- Recommendation: Replace `as any` with proper types. Use `unknown` + type narrowing where the type is genuinely dynamic.

---

### [MEDIUM] Files Near or At 200 LOC Limit

- Files (200+ LOC):
  - `src/hooks/stores/admin/use-admin-shifts-store.ts` — 200 LOC
  - `src/components/staff/notification-settings.tsx` — 200 LOC
  - `src/pages/ReviewsPage-write-review-form.tsx` — 199 LOC
  - `src/pages/subscriptions/index.tsx` — 198 LOC
  - `src/pages/stitch/referral-rewards-1/index.tsx` — 198 LOC
  - `src/components/ui/navbar.tsx` — 198 LOC
- Issue: 2 files hit 200 LOC (the limit), 4 more at 198-199. These are at threshold.
- Impact: Borderline — acceptable but should be monitored.
- Recommendation: Consider splitting `use-admin-shifts-store.ts` and `notification-settings.tsx` if they grow further.

---

### [MEDIUM] Barrel Export Size — Stitch Index

- File: `src/components/stitch/index.ts` (120+ lines)
- Issue: Exports 30+ components + their types from a single barrel file. Every import from `@/components/stitch` pulls from this.
- Impact: Barrel imports can cause tree-shaking issues and increase bundle if consumers import from barrel rather than direct paths. Also, 30+ re-exports makes this file a merge conflict magnet.
- Recommendation: Keep barrel for commonly used components only (StitchHeader, StitchFooter, StitchAppLayout). Remove rarely-used screen components from barrel — import directly from component files.

---

### [LOW] `src/stores/` Directory Contains Only Test File

- File: `src/stores/__tests__/cart-store.test.ts`
- Issue: `src/stores/` exists but contains no actual store files — only a test. The real stores live in `src/hooks/stores/`.
- Impact: Misleading directory structure. Developers looking for stores will check `src/stores/` first and find nothing.
- Recommendation: Either move `cart-store.test.ts` to `src/hooks/stores/__tests__/` (where other store tests live) and remove `src/stores/`, or consolidate all stores into `src/stores/`.

---

### [LOW] Relative Import From `stitch-screen-gallery` to Sibling `stitch/`

- File: `src/pages/stitch-screen-gallery/index.tsx:5`
- Issue: `import { StitchShell, StitchNav } from '../stitch/StitchBase'` — crosses directory boundary with relative import.
- Impact: Fragile import path. If `stitch/` is reorganized, this breaks.
- Recommendation: Use path alias: `import { StitchShell } from '@/pages/stitch/StitchBase'`.

---

### [LOW] Context Providers in hooks/ Instead of components/

- Files: `src/hooks/use-mobile-auth.tsx`, `src/hooks/use-table-context.tsx`
- Issue: Files ending in `.tsx` with `createContext`/`useContext` live in `hooks/`. Conventionally, context providers live in `components/` or `contexts/`.
- Impact: Minor convention violation. Works fine but inconsistent with component hierarchy.
- Recommendation: Move context providers to `src/components/auth/` or a dedicated `src/contexts/` directory.

---

### [INFO] `console.log` Usage — Only 3 Files

- Files:
  - `src/hooks/use-offline-sync.ts`
  - `src/lib/logger.ts` (expected — it's a logger)
  - `src/pages/stitch/reservation-new/index.tsx`
- Issue: Only 2 non-logger files use `console.log` directly.
- Impact: Minimal. The logger.ts is expected.
- Recommendation: Replace direct `console.log` in `reservation-new/index.tsx` with the project's logger utility.

---

### [INFO] No Circular Dependencies Detected

- Scan: No files import from `../../` (triple-nested relative). Only 1 file uses double relative (`brand-types.ts`).
- All other imports use `@/` path aliases consistently.
- Status: Clean.

---

### [INFO] Dependency Audit — `three` and `@types/three` Present

- Dependencies: `three: ^0.185.1`, `@types/three: ^0.185.0`
- Issue: 3D library present in package.json. Verify if actively used or leftover from a removed feature.
- Recommendation: Check if `three` is imported anywhere. If not, remove both packages.

---

### [INFO] `web-push` as Production Dependency

- Dependency: `web-push: ^3.6.7`
- Issue: Server-side push notification library listed as a production dependency. In a Vite/React frontend, this is unusual — typically used server-side only.
- Recommendation: Verify if this is needed client-side. If server-only, move to devDependencies or remove.

---

### [INFO] 26 Test Directories Across Codebase

- Count: 26 `__tests__/` directories spread across components, hooks, stores, pages, lib.
- Issue: Tests are co-located with source (good pattern), but some directories have tests while similar directories don't.
- Recommendation: Consider adding tests for under-tested modules: `src/components/saas/`, `src/components/chat/`, `src/components/events/`, `src/components/loyalty/`.

---

### [INFO] Well-Structured Areas

- `src/components/ui/` — Clean barrel export, 11 UI primitives
- `src/hooks/stores/admin/` — Well-organized admin stores with types/constants/utils split
- `src/lib/` — Small, focused utility modules (8 files)
- `src/config/` — Brand types and theme tokens separated
- `src/locales/` — i18n files properly placed
- `src/routes/` — Route files properly split by concern (public, stitch, mobile, admin)
- Path aliases (`@/*`) used consistently — no triple-nested relative imports

---

## Summary

| Severity | Count | Key Issues |
|----------|-------|-----------|
| HIGH | 2 | Stores in 3 locations; `tree/` non-standard dir |
| MEDIUM | 5 | 47 stitch pages; dual page systems; mixed naming; `as any`; files at 200 LOC |
| LOW | 3 | Empty stores dir; relative import crossing boundary; context providers in hooks/ |
| INFO | 6 | Console.log; no circular deps; dependency questions; test coverage gaps; well-structured areas |

## Priority Actions

1. **Consolidate stores** — Pick one location, migrate `tree/` stores there
2. **Audit stitch pages** — Identify and remove unused prototypes
3. **Standardize file naming** — Pick kebab-case or PascalCase for pages root
4. **Remove `as any`** — Fix 3 files with type escape hatches
5. **Check `three`/`web-push`** — Remove if unused

---

## Unresolved Questions

1. Are the stitch pages (referral-rewards-1, referral-rewards-2, luxury-cafe-1, luxury-cafe-2, etc.) actual features or design prototypes? Need stakeholder confirmation before removal.
2. Is the old pages system (`src/pages/home.tsx`, etc.) deprecated or still the primary routing?
3. What is the intended purpose of `src/tree/` — was this a planned architectural pattern that was abandoned?
