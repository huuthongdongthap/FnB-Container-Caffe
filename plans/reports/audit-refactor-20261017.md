# Comprehensive Codebase Audit & Refactor Report (`FnB-Container-Caffe`)

- **Date:** 2026-10-17
- **Scope:** Frontend (`src/`), Edge Worker (`worker/src/`), Domain Packages (`packages/domain/`), M3 Design Tokens (`src/styles/`), and CI/CD Quality Gates.
- **Commands:** `/audit` + `/refactor`

---

## 1. Security Audit (OWASP Top 10 & Secrets)

| Check | Status | Findings & Action Taken |
|-------|--------|-------------------------|
| **Client-Side Auth Bypass (`/admin/login`)** | **FIXED (P0)** | `handleGuestLogin` in `src/pages/admin/Login.tsx:46-72` dual-guarded behind `import.meta.env.DEV \|\| import.meta.env.MODE === 'test'` and stripped (`onGuestLogin={undefined}`) in production builds. |
| **DOM XSS Sinks (`dangerouslySetInnerHTML`)** | **REFACTORED (P1)** | Removed both `dangerouslySetInnerHTML` occurrences in `src/components/brand/BaziExplanation.tsx:88,107` by refactoring to pure React JSX (`renderWithHexBadges`). Remaining 2 uses in `src/pages/home.tsx:55` and `src/components/shared/Breadcrumbs.tsx:32` serialize static `JSON.stringify(jsonLd)` inside `<script type="application/ld+json">`. |
| **Dynamic Code Execution (`eval`, `new Function`)** | **PASS** | `0` occurrences across `src/`, `worker/src/`, and `packages/`. |
| **Hardcoded Secrets / Credentials** | **PASS** | `0` leaked credentials in `src/` or `public/`. Worker secrets (`JWT_SECRET`, `PAYOS_*`, `SENDGRID_API_KEY`) are bound strictly via Cloudflare Worker `Env`. |

---

## 2. Performance Audit (Bundle Size, Rendering & Polling)

| Metric / Component | Status | Details |
|--------------------|--------|---------|
| **Production Build (`vite v8.0.3`)** | **PASS (`3.74s`)** | `dist/index.html` (`1.22 kB` gzip), CSS (`48.73 kB` gzip), lazy-loaded route chunks (`0.5 kB – 33 kB` gzip). |
| **Image Format & Fallback (`AuraImage.tsx`)** | **FIXED** | Removed `.png/.jpg -> .webp` regex rewrite that broke native `/photos/*.webp` assets; added `loading="lazy"` and `decoding="async"`. |
| **WebGL / Window Listener Cleanup** | **FIXED** | `ThreeRingOverlay` (`src/pages/stitch/luxury-landing/index.tsx`) now properly removes `window` resize listener on unmount. |
| **KDS Realtime SSE + Polling Fallback** | **FIXED** | `use-kds.ts` merges SSE `/api/kds/orders/stream` snapshots with 5s polling while retaining in-flight `preparing` and `ready` orders in query cache. |

---

## 3. Compliance Audit (M3 Strict, WCAG 2.1 AA, Brand Truth & Type Safety)

| Dimension | Before | After | Status |
|-----------|--------|-------|--------|
| **Store Address Consistency (`29 Nguyễn Tất Thành, Phường 1, TP. Sa Đéc, Đồng Tháp`)** | 39 stale occurrences (`39`/`27 Nguyễn Tất Thành`, `Ward 2`, etc.) | **0 stale occurrences** across `src/`, `public/`, `index.html`, `README.md` | **PASS (100%)** |
| **Master Logo Unclipped Plaque (`rounded-xl`/`2xl` + `object-contain`)** | 7 circular `rounded-full object-cover` crops | **0 circular crops** (all 7 converted to rectangular M3 plaques) | **PASS (100%)** |
| **WCAG 2.1 AA Token Contrast (`scripts/contrast-check.mjs`)** | 8 pairs checked; 3 dark-theme M3 pairs inverted (`1:1`) | **11/11 pairs PASS** (`17.09:1` bg, `10.72:1` surface-variant, `17.09:1` inverse-surface) | **PASS (11/11)** |
| **Undefined `--aura-*` CSS Custom Properties** | 67 undefined variable references | **0 undefined** (all bridged in `src/styles/aura-tokens.css`) | **PASS** |
| **Explicit `: any` / `as any` in `src/` Production Code** | 18 occurrences across 10 files | **0 occurrences** (refactored to typed interfaces in `use-promotions.ts`, `use-admin.ts`, `use-menu.ts`, `use-menu-store.ts`, `use-admin-recruitment-store.ts`, `use-admin-orders-store.ts`, `use-kds.ts`, `StitchCheckoutNew.tsx`, `PwaInstallBannerEnhanced.tsx`, `mobile-login.tsx`) | **PASS (0 `: any` / `as any`)** |
| **Production `console.log` Statements in `src/`** | 0 in `src/` (1 in `worker/src/middleware/logger.ts` structured JSON logger) | **0 in `src/`** | **PASS** |
| **Unit & Integration Test Suite (`vitest`)** | 3 failing tests after route/address updates | **441/441 test files passed (`4,019/4,019` tests)** | **PASS (100%)** |

---

## 4. Architecture & Refactor Summary

### Refactors Executed in This Pass
1. **`src/components/brand/BaziExplanation.tsx`**: Replaced `dangerouslySetInnerHTML` regex HTML injection with `renderWithHexBadges(text)` returning safe React `<code>` elements.
2. **`src/components/stitch/StitchPOSNew.tsx` & `src/components/stitch/StitchPOSNew-menu-section.tsx`**: Refactored category tabs to dynamically union `MENU_CATEGORIES` with distinct `menuItems[].category` values so Vietnamese DB categories render as interactive filter tabs without breaking English default categories.
3. **Strict Type Refactoring Across 10 Frontend Modules**:
   - `src/hooks/use-promotions.ts` (`RawPromotion`, `PromotionsResponse`, `SinglePromotionResponse`, `mapRawPromotion`)
   - `src/hooks/use-menu.ts` (`RawMenuItemPayload`, `RawMenuListResponse`, `RawMenuItemResponse`, `mapRawMenuItem`)
   - `src/hooks/stores/use-menu-store.ts` (`RawStoreMenuItem`, `RawMenuStoreResponse`, `mapRawStoreMenuItem`)
   - `src/hooks/use-admin.ts` (typed `Record<string, unknown>` normalizers for orders and customers)
   - `src/hooks/stores/admin/use-admin-orders-store.ts` & `use-admin-recruitment-store.ts`
   - `src/hooks/use-kds.ts`, `src/components/stitch/StitchCheckoutNew.tsx`, `src/components/pwa/PwaInstallBannerEnhanced.tsx`, `src/pages/mobile/mobile-login.tsx`

### Large File Candidates (>500 LOC — Requires User Zone Selection Before Structural Split per `CLAUDE.md` §2)
- `src/pages/SystemHub.tsx` (`804 LOC`)
- `src/pages/RecruitmentPage.tsx` (`640 LOC`)

---

## Unresolved Questions
- None. All quality gates (`npm run check:contrast`, `npx tsc --noEmit`, `npm run build`, `npx vitest run`) are 100% green.
