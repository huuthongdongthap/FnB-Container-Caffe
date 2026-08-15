# Dev Audit — AURA CAFE Codebase

**Date:** 2026-08-15 | **Branch:** main | **Commit:** `b2ff40f`

---

## Executive Summary

| Dimension | CRITICAL | HIGH | MEDIUM | LOW | INFO |
|-----------|----------|------|--------|-----|------|
| Architecture | 0 | 2 | 5 | 3 | 6 |
| Security | 0 | 2 | 5 | 2 | 1 |
| Performance | 0 | 5 | 4 | 3 | 3 |
| Test Coverage | 0 | 3 | 3 | 1 | 0 |
| i18n & A11y | 1 | 5 | 7 | 3 | 5 |
| **Total** | **1** | **17** | **24** | **12** | **15** |

---

## 🔴 CRITICAL (1)

### 1. Clickable `<div>` with onClick but no keyboard handler
- **Files:** table-manager, waiter-orders modal, cancel-dialog
- **Risk:** Keyboard-only users cannot activate these controls. WCAG 2.1.1 failure.
- **Fix:** Add `onKeyDown` handler + `role="button"` + `tabIndex={0}`, or convert to `<button>`.

---

## 🟠 HIGH (17)

### Security (2)
1. **JWT in localStorage** — 5+ separate keys (`aura_auth`, `aura_jwt`, `admin_token`, etc.). XSS = full session hijack. → Migrate to httpOnly cookies.
2. **Dual auth token systems** — No central token refresh/revocation. → Consolidate to single auth store.

### Performance (5)
3. **Public routes not lazy-loaded** — 15 pages eagerly imported in `public-routes.tsx`. ~30% bundle reduction possible. → Add `React.lazy()`.
4. **Duplicate MenuCard.tsx** — Dead code `MenuCard.tsx` vs active `menu-card.tsx`. → Delete.
5. **useCart() subscribes to entire Zustand store** — No selector. Every mutation re-renders all consumers. → Add selector.
6. **Auth store uses raw fetch()** — Bypasses apiFetch interceptor. → Switch to apiFetch.
7. **13 files use raw fetch() instead of apiFetch()** — Inconsistent error handling. → Consolidate.

### Architecture (2)
8. **Stores in 3 locations** — `src/stores/`, `src/hooks/stores/`, `src/tree/`. Confusing. → Consolidate.
9. **`src/tree/` non-standard directory** — Only 3 consumers. → Move to `hooks/stores/`.

### Test Coverage (3)
10. **Routes 0% coverage** — No auth guard tests. → Add route guard tests.
11. **Pages 4.8% coverage** — 395 untested pages. Top-5 traffic pages untested. → Prioritize home, menu, checkout.
12. **27/65 hooks untested** — Core business hooks missing tests. → Add hook tests.

### i18n & A11y (5)
13. **427 missing translation keys** — Components rely on defaultValue fallbacks. → Add locale entries.
14. **1,036 unused locale keys** — Dead weight. → Prune.
15. **35+ onClick without onKeyDown** — Keyboard navigation broken. → Add keyboard handlers.
16. **20 buttons missing `type` attribute** — Defaults to submit. → Add `type="button"`.
17. **27+ inputs missing labels/aria-label** — Screen readers can't identify. → Add labels.

---

## 🟡 MEDIUM (24)

### Security (5)
- Legacy SHA-256 password hashing (no salt)
- Hardcoded Worker URLs in client bundle
- dangerouslySetInnerHTML with regex HTML injection
- CORS helper defaults to wildcard origin
- No Content-Security-Policy headers

### Performance (4)
- Three.js loaded via CDN on order-success (~600KB)
- Zero React.memo() usage across codebase
- Hero canvas mousemove listener never cleaned up
- Countdown timer re-renders every second

### Architecture (5)
- 47 stitch page subdirs (possible dead prototypes)
- Dual page systems (old + stitch)
- Mixed naming conventions in pages root
- `as any` in 3 files (strict mode violation)
- 2 files at 200 LOC limit

### Test Coverage (3)
- Stitch 25.4% coverage (194/260 untested)
- 139 modular admin sub-files untested
- Mobile staff pages 0%

### i18n & A11y (7)
- ChatWidget 7 hardcoded Vietnamese strings
- 30 hardcoded aria-labels not using i18n
- Stitch-about-footer 5 hardcoded English labels
- 15 files use `outline-none` without focus ring
- Hardcoded hex colors in inline styles
- Inconsistent semantic HTML (`<div>` vs `<section>`)
- Missing `lang` attribute on `<html>`

---

## 🟢 LOW (12)
- Missing CSRF protection (low risk with localStorage tokens)
- Rate limiter bypass for localhost/x-forwarded-for
- `src/stores/` empty directory
- Relative import crossing stitch boundaries
- Context providers in wrong directory
- 1 key missing from vi.json
- No dynamic `lang` attribute
- Only 10 files use `aria-live`
- Zustand stores consumed without selectors app-wide
- Admin/stitch chunks not grouped in Vite manualChunks
- Scroll listeners inconsistent with passive flag
- `three` and `web-push` deps may be unused

---

## Top 10 Priority Actions

| # | Action | Impact | Effort |
|---|--------|--------|--------|
| 1 | Migrate JWT to httpOnly cookies | Security | High |
| 2 | Consolidate auth token stores | Security | Medium |
| 3 | Lazy-load public routes | Performance | Low |
| 4 | Add keyboard handlers to clickable divs | A11y (CRITICAL) | Low |
| 5 | Add button `type` attributes | A11y | Low |
| 6 | Add input labels/aria-labels | A11y | Medium |
| 7 | Use Zustand selectors in useCart | Performance | Low |
| 8 | Replace raw fetch() with apiFetch() | Performance | Medium |
| 9 | Consolidate store locations | Architecture | Medium |
| 10 | Add route auth guard tests | Test Coverage | Medium |

---

## Audit Reports (Detailed)
- `audit-arch-260815-1458-architecture-structure.md`
- `audit-perf-260815-1458-performance-patterns.md`
- `audit-test-260815-1458-coverage-gaps.md`
- `audit-i18n-a11y-260815-1458.md`
- Security findings inline in this report

---

## Unresolved Questions
1. Are stitch variant pages (referral-rewards-1/2, luxury-cafe-1/2) actual features or prototypes?
2. Is old pages system (`src/pages/home.tsx` etc.) deprecated?
3. What was the intent of `src/tree/` — abandoned pattern?
4. Is there a plan to migrate from localStorage to httpOnly cookies?
5. Are there WCAG compliance targets (AA vs AAA)?
6. Should ChatWidget be refactored for i18n consistency?
7. Is Stitch layer production or prototyping? (Affects 25% coverage gap priority)
8. Is SaaS module active or planned?
