# File Dependency Map — RE-AUDIT 2026-07-01

## EXECUTIVE SUMMARY
**Phase 2 "Hard Cut" is 98% complete.** All legacy CSS + JS directories are empty.
Phase 3 "Backend TypeScript" is **100% complete** (90 TS files, 0 JS files).
Only cleanup items remain.

## CSS FILES — Current State

| Location | Previous Count | Current Count | Status |
|----------|---------------|---------------|--------|
| css/ directory | 32 | 0 | ✅ ALL DELETED |
| Root *.css | 8 | 0 | ✅ ALL DELETED |
| admin/*.css | 6 | 0 | ✅ ALL DELETED |
| signup/signup.css | 1 | 0 | ✅ DELETED |
| homepage-v6.css (4568 lines) | 1 | 0 | ✅ DELETED |
| public/offline.css | 1 | 1 | ⚠️ KEPT (PWA) |

### public/offline.css
- 1864 bytes, in `public/` dir (copied to dist/ by Vite)
- Referenced by: `public/sw.js` (PWA service worker)
- Decision: KEEP if SW is preserved; DELETE if SW removed

## JS FILES — Current State

| Location | Previous Count | Current Count | Status |
|----------|---------------|---------------|--------|
| js/ directory | 35 | 0 | ✅ ALL DELETED |
| public/sw.js | 1 | 1 | ⚠️ NEEDS UPDATE |

### public/sw.js — PWA Service Worker (NEEDS UPDATE)
References 8 DELETED files in STATIC_ASSETS:
```
'/offline.html'       → DELETED (no SPA equivalent)
'/css/styles.css'     → DELETED
'/js/main.js'         → DELETED
'/js/theme.js'        → DELETED
'/js/menu.js'         → DELETED
'/js/cart.js'         → DELETED
'/js/checkout.js'     → DELETED
'/js/i18n.js'         → DELETED
```
Decision: UPDATE STATIC_ASSETS to SPA-compatible list OR DELETE sw.js entirely.

## WORKER SOURCE — Current State
| Category | Count | Status |
|----------|-------|--------|
| TypeScript (.ts) | 90 files | ✅ 100% TS |
| JavaScript (.js) | 0 files | ✅ ALL DELETED |

**Phase 3 (Backend TypeScript Migration): COMPLETE**

## !important COUNT
| Location | Count |
|----------|-------|
| src/ (React SPA) | 0 |
| public/ | 0 |
| worker/ | 0 |
| **TOTAL** | **0** |

Target was <50. Already at 0. ✅ EXCEEDS TARGET.

## REMAINING WORK (Phases 2-3)
1. Update `package.json` lint script: `eslint worker/src/ --ext .js` → `--ext .ts`
2. Delete 2 demo HTML files in `assets/brand/.../05_Demos/`
3. Update or delete `public/sw.js` (PWA service worker — 8 stale asset references)
4. Review `public/manifest.json` for stale references
