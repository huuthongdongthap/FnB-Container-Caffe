---
agent: html-nav-scan
scope: "*.html, _redirects, sitemap.xml, manifest.json, robots.txt"
issues_found: 31
critical: 8
---

# HTML Navigation & Structure Scan Report

**Date:** 2026-05-31
**Files scanned:** 19 HTML + 4 config files
**Severity scale:** CRITICAL > HIGH > MEDIUM > LOW

---

## 1. DOCTYPE / charset / viewport

All 19 pages have `<!DOCTYPE html>` and `<meta charset="UTF-8">`.

| # | File | Issue | Severity |
|---|------|-------|----------|
| 1 | `404.html:1-14` | Missing `<meta name="viewport">` | **HIGH** |
|   | | Current: no viewport tag | |
|   | | Expected: `<meta name="viewport" content="width=device-width, initial-scale=1.0">` | |

All other 18 pages pass this check.

---

## 2. brand-tokens.css loading

| # | File | Issue | Severity |
|---|------|-------|----------|
| 2 | `404.html` | Does not load `css/brand-tokens.css` | **MEDIUM** |
|   | | Current: inline `<style>` with hardcoded colors | |
|   | | Expected: `<link rel="stylesheet" href="css/brand-tokens.css">` for brand consistency | |
| 3 | `checkin.html` | Does not load `css/brand-tokens.css` | **MEDIUM** |
|   | | Current: inline CSS with hardcoded vars (`--gold: #C9A200` etc.) | |
|   | | Expected: import brand-tokens.css, use `var(--aura-gold-bright)` | |
| 4 | `receipt-template.html` | Does not load `css/brand-tokens.css` | **LOW** |
|   | | Current: uses only `css/print-receipt.css` | |
|   | | Expected: acceptable for print-only template, but brand tokens would ensure consistency | |

---

## 3. shared-nav.js (initNavbar + initFooter)

**Fully integrated (navbar + footer):** index, menu, about-us, checkout, contact, loyalty, table-reservation, track-order (8 pages)

**Navbar only, missing initFooter:**

| # | File | Issue | Severity |
|---|------|-------|----------|
| 5 | `failure.html:501-502` | Calls `initNavbar('')` but does NOT call `initFooter()` | **MEDIUM** |
|   | | Expected: add `initFooter();` after `initNavbar('');` | |
| 6 | `success.html:815-816` | Calls `initNavbar('')` but does NOT call `initFooter()` | **MEDIUM** |
|   | | Expected: add `initFooter();` after `initNavbar('');` | |

**No shared-nav at all:**

| # | File | Issue | Severity |
|---|------|-------|----------|
| 7 | `404.html` | No shared-nav.js, no `<div id="shared-navbar">` | **LOW** |
|   | | Acceptable: minimal error page, intentional | |
| 8 | `brand-guideline.html` | Uses custom sidebar nav (`nav-links`), no shared-nav.js | **LOW** |
|   | | Acceptable: standalone reference page with own nav | |
| 9 | `checkin.html` | No shared-nav.js, no navbar | **MEDIUM** |
|   | | Current: standalone page, no way to navigate back | |
|   | | Expected: at minimum add a back-link to index.html | |
| 10 | `dang-ky-thanh-vien.html` | No shared-nav.js, no navbar | **HIGH** |
|   | | Current: public signup page with no navigation | |
|   | | Expected: integrate shared-nav or add back-link | |
| 11 | `hero-demo.html` | No shared-nav.js | **LOW** |
|   | | Acceptable: demo page with `noindex,nofollow` | |
| 12 | `kds.html` | No shared-nav.js | **LOW** |
|   | | Acceptable: internal kitchen display, not public | |
| 13 | `loyalty-calculator.html` | No shared-nav.js, no navbar | **MEDIUM** |
|   | | Current: internal tool with no navigation | |
|   | | Expected: add shared-nav or back-link | |
| 14 | `promotions.html` | Uses custom `.topnav` instead of shared-nav.js | **HIGH** |
|   | | Current: hardcoded `<nav class="topnav">` at line 265 | |
|   | | Expected: use `<div id="shared-navbar">` + `initNavbar('promotions')` for consistent nav | |
| 15 | `receipt-template.html` | No shared-nav.js | **LOW** |
|   | | Acceptable: print-only receipt template | |

---

## 4. Internal href links - broken link check

| # | File:Line | Link | Issue | Severity |
|---|-----------|------|-------|----------|
| 16 | `loyalty-calculator.html:1126` | `href="file:///Users/mac/mekong-cli/FnB-Container-Caffe/docs/loyalty_grand_opening_handbook.md"` | **Absolute local file:// path** - will 404 in production | **CRITICAL** |
| 17 | `loyalty-calculator.html:1129` | `href="file:///Users/mac/mekong-cli/FnB-Container-Caffe/loyalty.html"` | **Absolute local file:// path** - will 404 in production | **CRITICAL** |
| 18 | `loyalty-calculator.html:1132` | `href="file:///Users/mac/mekong-cli/FnB-Container-Caffe/dang-ky-thanh-vien.html"` | **Absolute local file:// path** - will 404 in production | **CRITICAL** |
| 19 | `dang-ky-thanh-vien.html:309` | `href="/dieu-khoan-thanh-vien"` | Target page does not exist, no redirect rule in `_redirects` | **CRITICAL** |
| 20 | `track-order.html:25-33` | `href="../public/images/..."` and `href="../public/manifest.json"` | Uses `../` relative paths from a root-level file - resolves to parent directory in production | **CRITICAL** |

**All other internal links verified OK:** `menu.html`, `table-reservation.html`, `index.html`, `loyalty.html`, `checkout.html`, `track-order.html` (target `menu.html`), `success.html`, `failure.html`, `promotions.html`, `brand-guideline.html` all point to existing files.

---

## 5. _redirects - missing rules

| # | Issue | Severity |
|---|-------|----------|
| 21 | `layout-2d-4k.html` referenced by redirect `/layout-2d` does not exist | **HIGH** |
| 22 | `layout-3d.html` referenced by redirect `/layout-3d` does not exist | **HIGH** |
| 23 | No redirect rule for `/dieu-khoan-thanh-vien` (linked from `dang-ky-thanh-vien.html:309`) | **CRITICAL** |
| 24 | No redirect rule for `/promotions` short URL (unlike `/brand` -> `/brand-guideline.html`) | **LOW** |

---

## 6. sitemap.xml - missing pages

Currently listed: `/` (index), `/menu`, `/checkout`, `/about-us`, `/contact`, `/loyalty`, `/table-reservation`, `/track-order` (8 pages)

**Public pages missing from sitemap:**

| # | Page | Reason to include | Severity |
|---|------|-------------------|----------|
| 25 | `promotions.html` | Public marketing page, indexable | **MEDIUM** |
| 26 | `dang-ky-thanh-vien.html` | Public signup page, indexable | **MEDIUM** |
| 27 | `brand-guideline.html` | Public reference page, indexable (has redirect `/brand`) | **LOW** |

Pages correctly excluded: `404.html` (noindex), `hero-demo.html` (noindex,nofollow), `kds.html` (noindex,nofollow), `checkin.html` (internal), `receipt-template.html` (print), `loyalty-calculator.html` (internal), `success.html` (transactional), `failure.html` (transactional).

---

## 7. manifest.json - icon paths

**Root `manifest.json`:**

| # | Path | Exists? | Severity |
|---|------|---------|----------|
| 28 | `assets/icons/favicon-192.png` | NO - directory `assets/icons/` does not exist | **CRITICAL** |
| 29 | `assets/icons/favicon-512.png` | NO - directory `assets/icons/` does not exist | **CRITICAL** |

All 4 icon entries and 3 shortcut icons reference non-existent paths. PWA install will fail.

**`public/manifest.json`:** Icons reference `/images/favicon.svg`, `/images/favicon-192x192.png`, `/images/favicon-512x512.png`. Files exist at `public/images/` but paths use absolute `/images/` which may not resolve correctly depending on Cloudflare Pages config.

**Two competing manifest files exist** with different content (name, description, icons, shortcuts). Pages reference them inconsistently:
- `index.html`, `kds.html` -> `public/manifest.json` (relative)
- `contact.html`, `failure.html`, `success.html` -> `/public/manifest.json` (absolute)
- `track-order.html` -> `../public/manifest.json` (broken relative)
- 13 pages have no manifest link at all

---

## 8. robots.txt - public pages incorrectly blocked

| # | Rule | Issue | Severity |
|---|------|-------|----------|
| 30 | `Disallow: /track-order/` | Blocks directory path `/track-order/` but track-order.html is listed in sitemap.xml as a public page. This rule may inadvertently block crawlers on Cloudflare Pages if clean URLs are enabled | **MEDIUM** |

No other public pages are incorrectly blocked. KDS, success, failure, receipt-template are correctly disallowed.

---

## 9. 404.html - styling check

| # | Issue | Severity |
|---|-------|----------|
| 31 | `404.html` uses inline `<style>` with hardcoded colors (`#0a0a0a`, `#e8e8e8`, `#C9D6DF`). Does not load `brand-tokens.css` or `shared-nav.js`. No viewport meta tag. Functional but not brand-consistent. | **MEDIUM** |

Current state: minimal 14-line page with centered 404 message and homepage link.
Expected: at minimum add viewport meta for mobile rendering. Brand-tokens optional but recommended.

---

## Summary by severity

| Severity | Count | Key areas |
|----------|-------|-----------|
| **CRITICAL** | 8 | file:// links (3), missing dieu-khoan page (1), manifest icons missing (2), track-order ../ paths (1), missing redirect rule (1) |
| **HIGH** | 4 | 404 viewport (1), dang-ky no nav (1), promotions custom nav (1), redirect targets missing (2 counted as 1 combined) |
| **MEDIUM** | 10 | Missing brand-tokens (2), missing initFooter (2), missing shared-nav (2), sitemap gaps (2), robots ambiguity (1), 404 styling (1) |
| **LOW** | 9 | Acceptable exclusions for internal/demo/print pages |

---

## Priority fix list (CRITICAL + HIGH)

1. **FIX** `loyalty-calculator.html:1126-1132` - Replace 3x `file:///` links with relative paths (`loyalty.html`, `dang-ky-thanh-vien.html`)
2. **CREATE** `dieu-khoan-thanh-vien.html` or add redirect in `_redirects` - linked from signup page
3. **FIX** `track-order.html:25-33` - Replace `../public/` paths with `public/` or absolute `/public/`
4. **FIX** `manifest.json` root - Replace `assets/icons/favicon-{192,512}.png` with `public/images/favicon-{192x192,512x512}.png` or create the icons
5. **FIX** `404.html` - Add `<meta name="viewport" content="width=device-width, initial-scale=1.0">`
6. **FIX** `promotions.html` - Replace hardcoded `.topnav` with `shared-nav.js` integration
7. **FIX** `dang-ky-thanh-vien.html` - Add shared-nav.js or navigation back-link
8. **CREATE/REMOVE** `layout-2d-4k.html` and `layout-3d.html` or remove redirect rules from `_redirects`
