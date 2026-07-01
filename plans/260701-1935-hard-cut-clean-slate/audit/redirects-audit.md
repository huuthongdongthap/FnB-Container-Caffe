# _redirects Audit — RE-AUDIT 2026-07-01

## CURRENT STATE
File: `_redirects` (copied to dist/ via Vite `public/` dir)

The _redirects file is ALREADY UPDATED with full coverage. No changes needed.

## RULES INVENTORY (First-Match Order)

### 1. Explicit .html Exceptions (10 rules) ✅
All URL mismatches have explicit rules BEFORE wildcard:
/about-us.html → /about, /brand-guideline.html → /brand,
/failure.html → /order-failure, /success.html → /order-success,
/checkout.html → /checkout?payment=pending, /kds.html → /kds,
/index-legacy.html → /, /loyalty-calculator.html → /loyalty-calculator,
/receipt-template.html → /checkout, /signup/index.html → /loyalty

### 2. Bulk Wildcard (1 rule) ✅
/*.html → /:splat 301 — covers ALL remaining legacy .html URLs

### 3. Short URL Aliases (1 rule) ✅
/admin-dashboard → /admin/dashboard 200

### 4. Legacy Redirects (5 rules) ✅
/dashboard → /admin/dashboard, /dashboard/ → /admin/dashboard,
/dashboard/admin → /admin/dashboard, /dashboard/login → /admin/login,
/kitchen → /kds, /signup → /loyalty

### 5. Security Blocks (11 rules) ✅
/docs/*, /tests/*, /tools/*, /scripts/*, /plans/*,
/designs/*, /_archive/*, /dist/*, /reports/*, /worker/*, /db/* → /404

### 6. SPA Fallback (1 rule) ✅
/* → /index.html 200 (LAST — SPA client-side routing)

## ISSUES FOUND
- NONE. All rules correct, ordering follows first-match semantics.
- Explicit .html exceptions correctly placed BEFORE wildcard.
- SPA fallback correctly placed LAST.
- Security blocks cover all sensitive directories.

## PREVIOUS AUDIT GAPS → NOW FIXED
| Gap | Previous State | Current State |
|-----|---------------|---------------|
| /about-us.html | No explicit rule | ✅ Explicit 301 → /about |
| /brand-guideline.html | No explicit rule | ✅ Explicit 301 → /brand |
| /failure.html | No explicit rule | ✅ Explicit 301 → /order-failure |
| /success.html | No explicit rule | ✅ Explicit 301 → /order-success |
| /receipt-template.html | No explicit rule | ✅ Explicit 301 → /checkout |
| /signup/index.html → /signup | Broken (no SPA route) | ✅ Fixed: 301 → /loyalty |
| /*.html wildcard | Not present | ✅ Present |

## RECOMMENDATION
**No changes needed.** _redirects is production-ready.
Verify `_redirects` is in Vite's `public/` dir (copied to `dist/` on build) — confirmed.
