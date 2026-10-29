# Menu Audit Remediation Plan (261029-0837)

**Source:** `reports/dev/audit/SUMMARY.md` (`reports/dev/audit/261029-0645-menu/`)
**Scope:** Remediate all 6 P2 findings (F01–F06), test gaps (T01–T02), and deploy verification gate issue (R01).

## Confirmed Decisions

1. **F01 + T02 (Catalog empty/error handling):** Keep `getCustomerMenu` graceful `{ categories: [], totalItems: 0 }` return (locked by `tests/m4b-digital-menu-contract.test.ts:266`). In `src/pages/menu.tsx`, stop falling back to orderable `DEFAULT_ITEMS` when catalog is empty or errored; render an explicit error/empty state with retry (`refetch`) and add `src/pages/__tests__/menu-page.test.tsx`.
2. **F02 (Vietnamese diacritic-insensitive search):** Normalize query and item name/description (trim, lowercase, NFD combining-mark strip, `đ/Đ → d`) in `src/components/stitch/use-stitch-menu-new.ts`.
3. **F03 (DrinkCustomizerModal keyboard focus):** Move initial focus into the dialog on open, trap `Tab`/`Shift+Tab` within focusable controls inside the modal, and restore focus to the previously focused trigger element on close in `src/components/menu/DrinkCustomizerModal.tsx`.
4. **F04 + T01 (Menu API filtering/pagination & legacy test mock):** Apply `search` (Vietnamese diacritic-insensitive), `available` / `include_unavailable`, `limit`, and `offset` in `worker/src/routes/customer-menu.ts` with `pagination.total` reflecting total matched items before slicing. Upgrade `tests/menu.test.ts` mock D1 to evaluate SQL predicates and assert exact item IDs/counts.
5. **F05 (`_headers` cache policy):** Keep canonical `/menu/aura-drinks/*.webp|avif` URLs (locked by `src/lib/__tests__/menu-drink-images.test.ts:53`) and override `/menu/aura-drinks/*.json` and `/menu/aura-drinks/*.html` with `Cache-Control: public, max-age=0, must-revalidate` in `_headers`.
6. **F06 (Frontend ESLint coverage):** Add `src/**/*.{ts,tsx}` configuration block to `eslint.config.js` and update `package.json` `lint`/`lint:fix` scripts so all 29 Menu frontend files are linted with 0 ignored warnings and 0 errors.
7. **R01 (`deploy-cloudflare.sh` target-scoped verification):** Gate Worker `/api/health` + `/api/version` SHA checks on `WORKER_ONLY`/`PAGES_ONLY` so `--pages-only` does not fail on un-deployed Worker SHA, and make Pages `/version.json` SHA mismatch fail-closed when Pages is deployed.

## Todo Checklist

- [x] F02: Vietnamese search normalization in `src/components/stitch/use-stitch-menu-new.ts` + tests in `src/components/stitch/__tests__/StitchMenuNew.test.tsx`
- [x] F03: Dialog focus trap & focus restoration in `src/components/menu/DrinkCustomizerModal.tsx` + tests in `src/components/menu/__tests__/DrinkCustomizerModal.test.tsx`
- [x] F01 + T02: Empty/error state in `src/pages/menu.tsx` (no orderable `DEFAULT_ITEMS` fallback) + composition tests in `src/pages/__tests__/menu-page.test.tsx`
- [x] F04 + T01: Query filtering (`search`, `available`, `limit`, `offset`) in `worker/src/routes/customer-menu.ts` + predicate-aware assertions in `tests/menu.test.ts` and `tests/m4b-digital-menu-contract.test.ts`
- [x] F05: Non-immutable cache headers for JSON/HTML under `/menu/aura-drinks/` in `_headers` + test in `src/lib/__tests__/menu-drink-images.test.ts`
- [x] F06: Frontend TS/TSX ESLint config in `eslint.config.js` & `package.json` + verify 29 Menu files have 0 ignored / 0 errors
- [x] R01: Target-scoped SHA verification in `deploy-cloudflare.sh` + test verification
