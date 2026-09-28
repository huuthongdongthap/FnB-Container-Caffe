# Phase 1 — Safe Dead-Code Cleanup Specification & Evidence

**Status:** APPROVED FOR EXECUTION
**Date:** 2026-09-20
**Scope:** Removal of proven dead files (zero routes, zero imports, zero dynamic references, zero feature dependencies, zero test references).

---

## 1. 5-Point Safety Gate Protocol

Every file candidate must satisfy all 5 criteria before removal:
1. **No active route:** Not mapped in `App.tsx`, `public-routes.tsx`, `stitch-routes.tsx`, `admin-routes.tsx`, `mobile-routes.tsx`.
2. **No code imports:** Not imported by any `.ts`, `.tsx`, or `.css` file in `src/`, `tests/`, or `worker/`.
3. **No dynamic references:** Not dynamically imported via `import()`, `React.lazy()`, or string literals.
4. **No feature dependency:** Contains no shared utilities, types, or store logic needed by active features.
5. **No test failures:** `npx tsc --noEmit` and `npx vitest run` remain 100% green post-deletion.

---

## 2. Verified Dead Code Inventory

### Group A: One-off Python Scripts in `src/components/stitch/` (9 files)
*Historical migration scripts used during previous prototype styling iterations; never executed at runtime.*

| File | Size | 5-Point Gate Status | Evidence |
|---|---|---|---|
| `src/components/stitch/_add_jsx.py` | 7.5 KB | ✅ PASS | 0 references in `src/`, `tests/`, `worker/`, `package.json` |
| `src/components/stitch/_add_svg.py` | 2.1 KB | ✅ PASS | 0 references |
| `src/components/stitch/_apply_all_fixes.py` | 14.9 KB | ✅ PASS | 0 references |
| `src/components/stitch/_apply_fixes_v2.py` | 15.1 KB | ✅ PASS | 0 references |
| `src/components/stitch/_fix_svg.py` | 1.1 KB | ✅ PASS | 0 references |
| `src/components/stitch/_fix_svg2.py` | 943 B | ✅ PASS | 0 references |
| `src/components/stitch/_fix_svg3.py` | 3.5 KB | ✅ PASS | 0 references |
| `src/components/stitch/_insert_components.py` | 7.2 KB | ✅ PASS | 0 references |
| `src/components/stitch/_insert_footer.py` | 5.7 KB | ✅ PASS | 0 references |

### Group B: Dead Duplicate Payment Directories (10 files)
*Unused component prototypes in `src/components/payment/` and `src/components/payments/` with 0 external consumers.*

| File | Size | 5-Point Gate Status | Evidence |
|---|---|---|---|
| `src/components/payment/apple-google-pay.tsx` | 6.3 KB | ✅ PASS | 0 imports anywhere in codebase; no route |
| `src/components/payments/RefundModal-constants.ts` | 258 B | ✅ PASS | Only referenced internally within `payments/` |
| `src/components/payments/RefundModal-error-view.tsx` | 1.1 KB | ✅ PASS | Only referenced internally within `payments/` |
| `src/components/payments/RefundModal-form-view.tsx` | 3.7 KB | ✅ PASS | Only referenced internally within `payments/` |
| `src/components/payments/RefundModal-hooks.ts` | 3.5 KB | ✅ PASS | Only referenced internally within `payments/` |
| `src/components/payments/RefundModal-loading-view.tsx` | 994 B | ✅ PASS | Only referenced internally within `payments/` |
| `src/components/payments/RefundModal-payment-summary.tsx` | 803 B | ✅ PASS | Only referenced internally within `payments/` |
| `src/components/payments/RefundModal-success-view.tsx` | 1.5 KB | ✅ PASS | Only referenced internally within `payments/` |
| `src/components/payments/RefundModal-types.ts` | 249 B | ✅ PASS | Only referenced internally within `payments/` |
| `src/components/payments/RefundModal.tsx` | 3.6 KB | ✅ PASS | 0 external imports across all `src/`, `tests/`, `worker/` |

---

## 3. Post-Deletion Verification Protocol

1. Delete candidates using file removal.
2. Clean up empty directories `src/components/payment/` and `src/components/payments/`.
3. Run `npx tsc --noEmit` — verify 0 errors.
4. Run `npx vitest run` — verify all 3,477 tests pass.
5. Run `npm run build` — verify Vite build passes.
6. Write execution summary to `reports/ui/legacy-cleanup.md`.
