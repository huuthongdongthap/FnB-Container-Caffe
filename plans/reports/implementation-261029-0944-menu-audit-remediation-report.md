# Menu Audit Remediation & Modularization Report (261029-0944)

## Summary
All 6 P2 findings (`F01`–`F06`), both test coverage gaps (`T01`–`T02`), the deploy verification gate issue (`R01`), and `< 200 LOC` modularization across the Menu module are complete and verified.

## Changes Implemented
- **Catalog Fail-Closed UI (`src/pages/menu.tsx`, `src/components/menu/menu-catalog-unavailable-state.tsx`):** Removed orderable `DEFAULT_ITEMS` fallback when `/api/menu` errors or returns an empty catalog; added `MenuCatalogUnavailableState` with retry (`refetch`) and `MenuTableBanner`.
- **Vietnamese Search Normalization (`src/components/stitch/use-stitch-menu-new.ts`, `worker/src/routes/customer-menu.ts`):** Added NFD combining-mark stripping, `đ/Đ → d` normalization, and whitespace trimming in both client search and Worker `GET /api/menu?search=`.
- **Modal Keyboard Focus Trap (`src/components/menu/DrinkCustomizerModal.tsx`, `src/components/menu/use-dialog-focus-trap.ts`, `src/components/menu/DrinkOptionGroup.tsx`):** Extracted `useDialogFocusTrap` to manage initial focus, DOM-ordered `Tab`/`Shift+Tab` wrapping, `Escape` dismissal, and trigger focus restoration; added `aria-pressed` to option chips.
- **Menu API Filtering & Pagination (`worker/src/routes/customer-menu.ts`):** Implemented `available`, `include_unavailable`, `search`, `limit`, and `offset` while preserving pre-slice `totalMatched` in `data.totalItems` and `pagination.total`.
- **Cache Control Scoping (`_headers`):** Scoped `immutable` caching to `/menu/aura-drinks/*.webp` and `*.avif`; set `public, max-age=0, must-revalidate` on `collection.json` and `preview.html`.
- **Frontend ESLint & Deploy Verification (`eslint.config.js`, `package.json`, `deploy-cloudflare.sh`):** Enabled ESLint v9 flat config on `src/**/*.{ts,tsx}` and scoped post-deploy Worker/Pages SHA checks to `--pages-only` / `--worker-only` with fail-closed exit on mismatch.

## Verification Gates
- `npx tsc --noEmit`: PASS (0 errors)
- `npx eslint --max-warnings=0`: PASS (0 errors, 0 warnings, 0 ignored)
- `npx vitest run` (9 Menu & Contract suites): PASS (116/116 tests)
- `npm run build --silent`: PASS (2,635 modules transformed, 0 errors)
- Docs impact: minor (`docs/12_CHANGELOG.md` updated)

## Unresolved Questions
None.
