# Frontend Bug Scan Report

**Date:** 2026-08-19  
**Scope:** `/Users/mac/mekong-cli/FnB-Container-Caffe/src` (React SPA)  
**Tools:** `npx tsc --noEmit`, `npx vite build`, manual grep analysis

---

## Summary

- **TypeScript errors:** 0
- **Build:** Passes cleanly (3.37s)
- **Critical runtime bugs:** 0
- **Medium findings:** 4
- **Low findings:** 5

---

## Medium Severity (4)

### M1. Missing AbortController in fetch useEffect hooks
**Files:**
- `src/hooks/use-mobile-auth.tsx:73-78` — `refreshToken()` called on mount, no cleanup
- `src/pages/admin/use-notification-settings.ts:20-29` — fetch in useEffect, no abort
- `src/pages/admin/staff-list-tab.tsx:19` — fetch in useEffect, no abort
- `src/pages/admin/staff-shifts-tab.tsx:55` — fetch in useEffect, no abort

**Risk:** If component unmounts before fetch resolves, state update on unmounted component (React warning, potential memory leak). Low real-world impact in SPA but violates React best practice.

---

### M2. `as any` type escape in production code
**File:** `src/hooks/stores/use-order-store.ts:105`
```ts
return useOrderStore(sel as any);
```
**Risk:** Bypasses type safety. Could mask type mismatches at runtime. Other `as any` instances are in test files only (acceptable).

---

### M3. Error boundary coverage gap
**File:** `src/App.tsx:39-48`  
ErrorBoundary wraps `StitchAppLayout` but admin routes and mobile routes are inside the same Suspense boundary without their own ErrorBoundary. A crash in admin pages (e.g., `Dashboard`, `POS`) propagates to the root.

**Risk:** Unhandled errors in admin/mobile routes crash the entire SPA instead of showing a fallback UI.

---

### M4. `console.warn` in production code
**File:** `src/hooks/use-offline-sync.ts:71`
```ts
console.warn('[OfflineSync] Conflict on', item.localId, '- keeping in queue');
```
**Risk:** Leaks internal state to browser console. Should use the project's `logger` utility (`src/lib/logger.ts`).

---

## Low Severity (5)

### L1. eslint-disable react-hooks/exhaustive-deps (6 suppressions in prod code)
**Files:**
- `src/hooks/use-mobile-auth.tsx:77`
- `src/pages/admin/use-notification-settings.ts:28`
- `src/pages/loyalty.tsx:41`
- `src/pages/referral.tsx:55`
- `src/pages/mobile/mobile-login.tsx:93,106`
- `src/components/stitch/StitchOrderSuccessNew-tracking.tsx:111`

All are mount-only effects (`[]` or `[isAuthenticated]`). Legitimate but worth noting — if deps change semantics, these won't re-fire.

---

### L2. eslint-disable @typescript-eslint/no-explicit-any (1 suppression)
**File:** `src/hooks/stores/use-order-store.ts:104`  
Related to M2 above.

---

### L3. `window.navigator.standalone` accessed via `as any`
**File:** `src/components/pwa/PwaInstallBannerEnhanced.tsx:33`
```ts
(window.navigator as any).standalone === true
```
**Risk:** Safari-specific API. The `as any` is needed because TypeScript doesn't include `standalone` in `Navigator` type. Functional but type-unsafe.

---

### L4. Hardcoded phone number in anchor href
**Files:**
- `src/components/home/location-map.tsx:42` — `href="tel:0946013633"`
- `src/components/ui/footer.tsx:74` — `href="tel:0946013633"`

**Risk:** Should come from config/env for maintainability.

---

### L5. No SSR guards on localStorage access
**Files:** 10 files with direct `localStorage` access (all in `src/hooks/stores/`, `src/pages/`, `src/components/`)

**Risk:** Current app is SPA-only so no real risk. If SSR is ever added, these will crash. Defensive pattern: `typeof window !== 'undefined'` check.

---

## No Issues Found

- Missing imports or undefined references: **None**
- Broken component props or type mismatches: **None** (tsc clean)
- Dead imports or unused variables: **None** (build clean, no warnings)
- Null ref access patterns: **All safe** (optional chaining used correctly)
- JSON.parse without try-catch: **None** (all guarded)

---

## Unresolved Questions

1. Is the `as any` in `use-order-store.ts:105` intentional for Zustand selector typing, or can it be replaced with proper generic?
2. Should admin routes get their own ErrorBoundary wrapper?
