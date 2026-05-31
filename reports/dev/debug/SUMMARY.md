---
report: dev-debug-summary
project: FnB-Container-Caffe (AURA SPACE CAFÉ)
target: Go LIVE 2026-06-06
date: 2026-05-31
agents: 5 (payment-trace, html-nav-scan, js-security-scan, css-brand-scan, infra-deploy-trace)
total_issues: 278
critical: 31
high: 169
medium: 66
low: 12
verdict: NOT READY — 31 critical blockers
---

# DEV:DEBUG SUMMARY — AURA SPACE CAFÉ GO LIVE READINESS

**Target:** Khai trương 6/6/2026 (6 ngày còn lại)
**Verdict:** 🔴 NOT READY — 31 critical issues across 5 dimensions

---

## AGENT REPORTS

| Agent | File | Issues | Critical |
|-------|------|--------|----------|
| payment-trace | [trace-payment.md](trace-payment.md) | 14 | 5 |
| html-nav-scan | [trace-html.md](trace-html.md) | 31 | 8 |
| js-security-scan | [trace-js.md](trace-js.md) | 42 | 4 |
| css-brand-scan | [trace-css.md](trace-css.md) | 188 | 14 |
| infra-deploy-trace | [trace-infra.md](trace-infra.md) | 3 | 0 |

---

## ROOT CAUSES

### RC-1: Payment Integration Incomplete
The payment system was developed against sandbox/test environments and never switched to production. MoMo and VNPay only have frontend stubs (no backend routes). PayOS is the only fully implemented payment gateway but its secrets are not yet deployed.

**Affected code paths:**
- `js/config.js:27,31,36` — sandbox URLs + placeholder credentials
- `js/checkout/qr-code.js:21` — fake bank account number `0901234567`
- `js/checkout/payment.js:116-184` — MoMo/VNPay call non-existent backend routes
- `worker/src/routes/payment.js` — only PayOS implemented
- `worker/.dev.vars` — dev-only secrets, production secrets not deployed

### RC-2: CSS Token Migration Incomplete (Gold → Chrome v5)
The Bazi v5 migration from Gold/Amber theme to Chrome/Silver was partially completed. Checkout and track-order pages still reference 28+ old tokens (`--warm-amber`, `--warm-gold`, `--bg-dark`, `--glass`, etc.) that no longer exist in `brand-tokens.css`.

**Affected code paths:**
- `css/checkout-styles.css` — 17 undefined variables, zero dark mode
- `css/track-order-styles.css` — 10 undefined variables, zero dark mode
- `css/styles.css:416,1436-1477` — Bazi-violating colors (Tho/Hoa elements)
- `css/kds-styles.css:13` — undefined `--aura-noir-mist`

### RC-3: Module Integration Gaps
Several features were developed as standalone modules but never wired into the page ecosystem.

**Affected code paths:**
- `js/i18n.js` — 399-line module, loaded by zero HTML pages
- `js/sw.js` — exists at `/js/sw.js` but registered at `/sw.js` (path mismatch)
- `js/main.js:4-6` — imports `MenuManager`, `CartManager`, `CheckoutManager` that don't exist
- 8 HTML pages missing shared-nav.js integration

### RC-4: Development Artifacts Not Cleaned
Test data, debug tools, and development-only code remain in production codebase.

**Affected code paths:**
- `js/loyalty.js:607-623` — mock fallback shows fake 125K VND cashback
- `js/checkout.js:58-63` — discount codes hardcoded in client JS
- `js/kds-app.js:343` — test order generator button in production
- `loyalty-calculator.html:1126-1132` — `file:///Users/mac/...` local filesystem links
- `track-order.html:25-33` — `../public/` broken relative paths

---

## CRITICAL ISSUES BY PRIORITY

### P0: Payment (Will lose real money or block revenue)

| # | Issue | File:Line | Fix |
|---|-------|-----------|-----|
| 1 | MoMo sandbox endpoint | `js/config.js:27` | `test-payment.momo.vn` → `payment.momo.vn` |
| 2 | VNPay sandbox endpoint | `js/config.js:36` | `sandbox.vnpayment.vn` → `pay.vnpay.vn` |
| 3 | VNPay TEST merchant code | `js/config.js:35` | Verify registered TMN code |
| 4 | PayOS placeholder clientId | `js/config.js:31` | Remove dead `process.env` code |
| 5 | Fake bank account in QR | `js/checkout/qr-code.js:21` | Replace `0901234567` with real MB Bank account |
| 6 | No MoMo/VNPay backend routes | `worker/src/routes/` | Implement or disable in UI |
| 7 | Worker secrets not deployed | `worker/wrangler.toml` | Run `wrangler secret put` for 4 keys |

### P0: Broken Pages (Visible to customers on day 1)

| # | Issue | File:Line | Fix |
|---|-------|-----------|-----|
| 8 | 28+ undefined CSS vars on checkout | `css/checkout-styles.css` | Add token aliases or migrate to v5 tokens |
| 9 | 10+ undefined CSS vars on track-order | `css/track-order-styles.css` | Add token aliases or migrate to v5 tokens |
| 10 | i18n.js not loaded anywhere | All HTML files | Add `<script src="js/i18n.js">` |
| 11 | `file:///` links in loyalty-calculator | `loyalty-calculator.html:1126-1132` | Replace with relative paths |
| 12 | `../public/` broken paths in track-order | `track-order.html:25-33` | Fix to `public/` or absolute paths |
| 13 | /dieu-khoan-thanh-vien dead link | `dang-ky-thanh-vien.html:309` | Create page or add redirect |

### P1: Navigation & PWA

| # | Issue | File | Fix |
|---|-------|------|-----|
| 14 | manifest.json icons don't exist | `manifest.json` | Create `assets/icons/` or update paths |
| 15 | Service Worker path mismatch | `js/main.js:69`, `js/script.js:423` | Move `js/sw.js` to root or fix path |
| 16 | 8 pages missing shared-nav | Multiple | Add initNavbar/initFooter |
| 17 | success/failure missing initFooter | `success.html`, `failure.html` | Add `initFooter()` call |
| 18 | _redirects targets missing | `_redirects:14-15` | Remove layout-2d/3d rules |

### P1: Security & Quality

| # | Issue | File:Line | Fix |
|---|-------|-----------|-----|
| 19 | XSS in script.js toast | `js/script.js:56` | Use `_esc()` or `textContent` |
| 20 | XSS in script.js menu render | `js/script.js:163` | Use `_esc()` helper |
| 21 | XSS in KDS render | `js/kds/kds-render.js:52-94` | Add `_esc()` to all interpolation |
| 22 | Mock loyalty data in production | `js/loyalty.js:607-623` | Gate behind DEBUG or remove |
| 23 | Discount codes in client JS | `js/checkout.js:58-63` | Move to server-side validation |
| 24 | KDS test order button exposed | `js/kds-app.js:343` | Gate behind IS_LOCAL |

### P2: Brand Compliance (Bazi v5)

| # | Issue | File:Line | Fix |
|---|-------|-----------|-----|
| 25 | `#FF00FF` magenta (Hoa khac Thuy) | `css/styles.css:1477` | Remove or use `var(--aura-chrome-bright)` |
| 26 | `#5A3E2B` brown (Tho khac Thuy) | `css/styles.css:1436` | Use `var(--aura-chrome-dark)` |
| 27 | `#D4BBA5` tan (Tho) | `css/styles.css:1459` | Use `var(--aura-chrome-light)` |
| 28 | `#f59e0b` amber (Hoa) | `css/track-order-styles.css:149` | Use `var(--aura-chrome-mid)` |
| 29 | Checkout zero dark mode support | `css/checkout-styles.css` | Add `[data-theme="dark"]` overrides |
| 30 | Track-order zero dark mode | `css/track-order-styles.css` | Add `[data-theme="dark"]` overrides |
| 31 | 157 hardcoded hex colors | Multiple CSS files | Migrate to `var(--token)` |

---

## WHAT PASSED

| Dimension | Status | Metric |
|-----------|--------|--------|
| Vite Build | PASS | 626ms, 0 errors |
| Jest Tests | PASS | 560/560, 85.71% coverage |
| ESLint | PASS | 0 errors, 101 warnings |
| Security Headers | PASS | Full OWASP + HSTS preload |
| CORS | PASS | Proper allowlist in Worker |
| Deploy Script | PASS | Functional, strict mode |
| D1 + KV Bindings | PASS | Bound, IDs present |
| Cron Triggers | PASS | SLA check every 5 min |
| Worker API | PASS | 22 routes, rate limiting, error handler |
| Menu Data | PASS | 50+ items, real VND prices |
| Loyalty Config | PASS | 3 tiers, multipliers, cashback |
| Font Preloading | PASS | 15/18 pages |
| Sensitive Dir Block | PASS | _redirects blocks /worker, /docs, /db |
| 0 broken url() refs | PASS | All CSS image paths verified |

---

## FIX TIMELINE (6 ngay)

### Ngay 1 (1/6): Payment Gateway — OWNER: CTO/Founder
- [ ] Dang ky PayOS production account -> credentials
- [ ] Xac nhan MoMo/VNPay strategy: implement backend hoac disable UI
- [ ] Lay so tai khoan MB Bank that cho QR code
- [ ] Chay `wrangler secret put` cho 4 keys (JWT, PayOS x3)

### Ngay 2 (2/6): CSS Token Migration — OWNER: Frontend Dev
- [ ] Them legacy token aliases vao `brand-tokens.css` (--warm-amber -> --aura-chrome-mid, etc.)
- [ ] Hoac refactor `checkout-styles.css` + `track-order-styles.css` sang v5 tokens
- [ ] Xoa Bazi-violating colors (#FF00FF, #5A3E2B, #D4BBA5, #f59e0b)
- [ ] Them dark mode cho checkout + track-order

### Ngay 3 (3/6): HTML & JS Integration — OWNER: Frontend Dev
- [ ] Load i18n.js trong tat ca HTML pages
- [ ] Fix Service Worker path (move js/sw.js -> /sw.js)
- [ ] Fix file:// links trong loyalty-calculator.html
- [ ] Fix ../public/ paths trong track-order.html
- [ ] Them shared-nav vao 8 pages con thieu
- [ ] Tao /dieu-khoan-thanh-vien hoac redirect
- [ ] Fix manifest.json icon paths

### Ngay 4 (4/6): Security & Cleanup — OWNER: Frontend Dev
- [ ] Fix 3 XSS vectors (script.js, kds-render.js)
- [ ] Remove mock loyalty fallback data
- [ ] Move discount codes to server-side
- [ ] Gate KDS test button behind DEBUG
- [ ] Update js/config.js — remove dead process.env code, update payment URLs
- [ ] Replace bank account placeholder

### Ngay 5 (5/6): SEO, Lint & Commit — OWNER: Dev
- [ ] Update sitemap.xml (add dang-ky, promotions)
- [ ] Clean _redirects (remove layout-2d/3d targets)
- [ ] Run `npm run lint:fix`
- [ ] Remove ungated console.log statements
- [ ] Commit tat ca changes

### Ngay 6 (6/6): Deploy & Smoke Test — OWNER: CTO
- [ ] `bash deploy-cloudflare.sh` — full deploy
- [ ] E2E: Homepage -> Menu -> Cart -> Checkout -> PayOS payment
- [ ] E2E: Dang ky thanh vien -> Loyalty points
- [ ] E2E: Dat ban -> Confirmation
- [ ] Mobile test (iOS Safari + Android Chrome)
- [ ] Verify Worker API health
- [ ] KHAI TRUONG

---

## FILES REFERENCED

```
# Payment
js/config.js                    # sandbox URLs, placeholder creds
js/checkout/qr-code.js          # fake bank account
js/checkout/payment.js          # MoMo/VNPay frontend stubs
worker/src/routes/payment.js    # PayOS backend (only one)
worker/wrangler.toml            # secrets config
worker/.dev.vars                # dev-only secrets

# CSS (broken)
css/checkout-styles.css         # 17 undefined vars, zero dark mode
css/track-order-styles.css      # 10 undefined vars, zero dark mode
css/styles.css:1436-1477        # Bazi-violating colors
css/brand-tokens.css            # source of truth for tokens

# HTML (broken)
loyalty-calculator.html:1126    # file:// links
track-order.html:25             # ../public/ paths
dang-ky-thanh-vien.html:309     # dead /dieu-khoan-thanh-vien link
manifest.json                   # broken icon paths

# JS (security)
js/script.js:56,163             # XSS vectors
js/kds/kds-render.js:52         # XSS vector
js/loyalty.js:607               # mock fallback data
js/checkout.js:58               # exposed discount codes
js/kds-app.js:343               # test order generator
js/i18n.js                      # never loaded
js/sw.js                        # wrong path registration

# Infra (clean)
deploy-cloudflare.sh            # functional
_headers                        # OWASP compliant
_redirects                      # 2 dead targets to clean
```

---

*Report generated by dev:debug pipeline — 5 parallel agents, 2026-05-31*
*Total scan: 19 HTML + 32 JS + 16 CSS + 28 Worker files = 95 files*
