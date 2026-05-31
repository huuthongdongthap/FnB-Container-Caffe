---
agent: js-security-scan
scope: js/*.js (32 files)
date: 2026-05-31
issues_found: 42
critical: 4
high: 8
medium: 18
low: 12
---

# JS Go LIVE Readiness Scan — AURA CAFE

## 1. CRITICAL Issues (4)

### 1.1 Payment Gateways on Sandbox/Test Endpoints
- **js/config.js:27** — MoMo endpoint is `https://test-payment.momo.vn/...`
- **js/config.js:36** — VNPay endpoint is `https://sandbox.vnpayment.vn/...`

```js
// config.js:27
endpoint: 'https://test-payment.momo.vn/v2/gateway/api/create'
// config.js:36
endpoint: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'
```
**Impact:** Real payments will NOT process. All MoMo and VNPay transactions will go to test/sandbox environments.
**Fix:** Replace with production MoMo (`payment.momo.vn`) and VNPay (`pay.vnpay.vn`) endpoints before go-live.

### 1.2 PayOS Client ID Placeholder
- **js/config.js:31** — Hardcoded fallback `'YOUR_PAYOS_CLIENT_ID'`

```js
clientId: typeof process !== 'undefined' && process.env ? process.env.PAYOS_CLIENT_ID : 'YOUR_PAYOS_CLIENT_ID',
```
**Impact:** PayOS payments will fail in browser (process.env is undefined in browser context, so it always falls back to the placeholder string).
**Fix:** Inject real client ID at build time or use a runtime config endpoint. `process.env` does not exist in client-side JS.

### 1.3 Service Worker Path Mismatch
- **js/main.js:69** — Registers `/sw.js`
- **js/script.js:423** — Registers `/sw.js`
- **js/menu.js:305** — Registers `/sw.js`
- **Actual file location:** `js/sw.js`

```js
navigator.serviceWorker.register('/sw.js')
```
**Impact:** Service Worker registration will 404 in production. PWA offline mode, caching, and push notifications will not work.
**Fix:** Either move `js/sw.js` to project root `/sw.js`, or change registration path to `/js/sw.js`. Verify Cloudflare Pages serves it correctly.

### 1.4 i18n.js Not Loaded by Any HTML Page
- **js/i18n.js** exists (399 lines) and is listed in SW cache (`js/sw.js:20`)
- **No `<script>` tag** in `index.html` or any other HTML file loads it
- **js/shared-nav.js:432-433** references `window.i18n.showToast` (will be undefined)

**Impact:** Language switching is completely broken. The module auto-inits on DOMContentLoaded but is never loaded. SW will cache a file that the app never requests.
**Fix:** Add `<script src="js/i18n.js" defer></script>` to all HTML pages that need i18n, or remove from SW cache list if i18n is not needed for v1 launch.

---

## 2. HIGH Issues (8)

### 2.1 XSS — Unsanitized innerHTML in script.js
- **js/script.js:56-58** — Toast notification uses raw `message` in innerHTML

```js
toast.innerHTML = `
  <span class="toast-icon">${type === 'success' ? '...' : '...'}</span>
  <span class="toast-message">${message}</span>
`;
```
**Impact:** If `message` contains user-controllable content, XSS is possible.
**Fix:** Use `textContent` or the `_esc()` helper already used elsewhere.

### 2.2 XSS — Unsanitized innerHTML in script.js renderMenuItems
- **js/script.js:163-167** — Menu items rendered without escaping

```js
container.innerHTML = items.map(item => `
  <div class="order-item" data-id="${item.id}" data-name="${item.name}" data-price="${item.price}">
    <div class="order-item-name">${item.name}</div>
    ...
`).join('');
```
**Impact:** If `item.name` comes from API/DB and contains `<script>`, XSS is possible. Data attributes also unescaped.
**Fix:** Apply `_esc()` helper to all interpolated values.

### 2.3 XSS — KDS Render has No Escaping
- **js/kds/kds-render.js:52-94** — Order cards rendered with raw `order.id`, `order.items[].name`, `order.tableNumber`

```js
<span class="order-number">${order.id}</span>
<span class="table-badge">Ban ${order.tableNumber}</span>
<span class="item-name">${item.name}</span>
```
**Impact:** KDS is internal/admin-facing but orders come from customer input. Malicious order names could inject HTML/JS into kitchen display.
**Fix:** Add `_esc()` helper to kds-render.js and escape all interpolated values.

### 2.4 Mock Fallback Data Shown to Production Users
- **js/loyalty.js:607-623** — Mock transaction data displayed when API is unreachable

```js
const MOCK_TXNS = [
  { type:'earn', points:45, description:'Ca Phe Phin...', ... },
  ...
];
const MOCK_CB = 125000;
function showMockFallback() {
  renderHist('pointsHistory', MOCK_TXNS);
  renderCbAmount(MOCK_CB);
}
```
- Called from: lines 602, 702, 706, 710 (any API failure or unauthenticated state)

**Impact:** Users see fake loyalty data (125,000 VND cashback, fake transactions). Misleading and may cause support complaints.
**Fix:** Show an error/loading state instead of mock data. Reserve mock data for dev/staging only.

### 2.5 main.js Imports Non-Existent Exports
- **js/main.js:4** — `import { MenuManager } from './menu.js'` — menu.js exports nothing named `MenuManager`
- **js/main.js:5** — `import { CartManager } from './cart.js'` — cart.js does not export `CartManager`
- **js/main.js:6** — `import { CheckoutManager } from './checkout.js'` — checkout.js does not export `CheckoutManager`

```js
import { MenuManager } from './menu.js';    // menu.js has no export
import { CartManager } from './cart.js';     // cart.js has no export
import { CheckoutManager } from './checkout.js'; // exports functions, not CheckoutManager
```
**Impact:** These imports silently resolve to `undefined`. The imported symbols are never used in main.js anyway, so no runtime crash, but indicates dead code and broken module architecture.
**Fix:** Remove unused imports or add proper exports.

### 2.6 Hardcoded Discount Codes in Client-Side JS
- **js/checkout.js:58-63** — Discount codes with percentages and limits

```js
const validCodes = {
  FIRSTORDER: { percent: 15, maxDiscount: 50000 },
  WELCOME10:  { percent: 10, maxDiscount: 30000 },
  SADEC20:    { percent: 20, maxDiscount: 100000 },
  CONTAINER:  { percent: 25, maxDiscount: 150000 }
};
```
**Impact:** Anyone can inspect DevTools and see all valid discount codes. Codes should be validated server-side.
**Fix:** Move discount validation to the Cloudflare Worker backend. Client should submit code and receive validation response.

### 2.7 KDS Test Order Generator Exposed in Production
- **js/kds-app.js:343-379** — Button `btnGenerateTestOrder` generates random orders

```js
const btnGenerateTest = document.getElementById('btnGenerateTestOrder');
if (btnGenerateTest) {
  btnGenerateTest.addEventListener('click', () => {
    const newOrder = generateRandomOrder(MENU_ITEMS, ORDER_STATUS, PRIORITY);
    KDS_STATE.orders.push(newOrder);
    ...
  });
}
```
**Impact:** If the KDS HTML has this button visible, staff can accidentally generate fake orders in production.
**Fix:** Gate behind `IS_LOCAL` / `DEBUG` flag, or remove the button from production HTML.

### 2.8 process.env in Browser Context (config.js)
- **js/config.js:31** — `typeof process !== 'undefined' && process.env`

```js
clientId: typeof process !== 'undefined' && process.env ? process.env.PAYOS_CLIENT_ID : 'YOUR_PAYOS_CLIENT_ID',
```
**Impact:** `process` never exists in browser. This code path is dead. Will always use the placeholder.
**Fix:** Use a build-time replacement (e.g., Vite's `import.meta.env`) or a runtime config API call.

---

## 3. MEDIUM Issues (18)

### 3.1 console.log Statements (Production Leaks)

| File | Line | Statement |
|------|------|-----------|
| js/checkout.js | 176 | `console.log('[checkout] Cart loaded:', count, 'items, total:', total)` |
| js/checkout.js | 178 | `console.log('[checkout] Parsed cart has 0 items...')` |
| js/checkout.js | 184 | `console.log('[checkout] No cart data in localStorage...')` |
| js/kds-poll.js | 63 | `console.log('[KDS] Seeded initial ts: ${ts}')` |

**Fix:** Remove or wrap behind `DEBUG` flag (like auth.js already does).

### 3.2 console.warn Statements

| File | Line | Statement |
|------|------|-----------|
| js/hero-aura.js | 18 | `console.warn('[hero-aura] root element not found')` |
| js/shared-nav.js | 50 | `console.warn('Storage patch failed', e)` |
| js/loyalty.js | 601 | `console.warn('[Loyalty] API error, falling back to local:', err)` |
| js/menu.js | 46 | `console.warn('[Menu] API unavailable, using static HTML fallback:', err.message)` |

**Fix:** Wrap behind `DEBUG` flag or use a logging utility that can be disabled in production.

### 3.3 console.error Statements (Conditional — OK but Review)

| File | Line | Gated? |
|------|------|--------|
| js/auth.js | 69 | `if (DEBUG)` — OK |
| js/auth.js | 107 | `if (DEBUG)` — OK |
| js/auth.js | 144 | `if (DEBUG)` — OK |
| js/auth.js | 177 | `if (DEBUG)` — OK |
| js/api-client.js | 29 | `if (DEBUG)` — OK |
| js/checkout.js | 181 | **NOT gated** |

**Fix:** Gate `checkout.js:181` behind `DEBUG`.

### 3.4 DEBUG-gated console.log in kds-poll.js

| File | Line | Gated? |
|------|------|--------|
| js/kds-poll.js | 33 | `if (DBG())` — OK |
| js/kds-poll.js | 42 | `if (DBG())` — OK |
| js/kds-poll.js | 59 | `if (DEBUG)` — OK |
| js/kds-poll.js | 63 | **NOT gated** |

**Fix:** Gate line 63 behind `DEBUG`.

### 3.5 Localhost/127.0.0.1 References (9 files, all conditional)
All localhost references use runtime detection (`window.location.hostname === 'localhost'`), which is correct. However, API_BASE is duplicated across 8 files instead of using the centralized `config.js`:

| File | Lines | Uses config.js? |
|------|-------|-----------------|
| js/config.js | 10-14 | Source of truth |
| js/cart.js | 9-10 | Duplicated |
| js/signup-loyalty.js | 1-3 | Duplicated |
| js/auth.js | 26-27 | Duplicated |
| js/pos.js | 6-8 | Duplicated |
| js/track-order.js | 14-15 | Duplicated |
| js/kds-app.js | 26-27 | Duplicated |
| js/loyalty.js | 405-407 | Duplicated |
| js/checkout.js | 53-54 | Duplicated |

**Fix:** Import `API_CONFIG.BASE` from `config.js` in all modules instead of duplicating the localhost detection logic.

### 3.6 Session ID Uses Math.random (Not Cryptographically Secure)
- **js/checkout.js:137**

```js
sessionId = 'sess_' + Math.random().toString(36).substr(2, 9);
```
**Fix:** Use `crypto.randomUUID()` or `crypto.getRandomValues()`.

### 3.7 Duplicate HTML Escape Helper Defined in 6+ Files
The `_esc()` function is independently defined in:
- js/menu.js:11
- js/loyalty.js:9
- js/script.js:128
- js/cart.js:197
- js/checkout/cart-summary.js:112
- js/checkout/payment.js:73
- js/pos.js:19

**Fix:** Extract to `js/utils.js` and import from there.

### 3.8 auth.js JSDoc Contains Example Credentials
- **js/auth.js:11** — `'user@example.com', 'password123'`
- **js/auth.js:14** — `'user@example.com', 'password123'`

**Impact:** Low risk (comments only), but looks unprofessional in source-viewable production JS.
**Fix:** Remove example credentials from JSDoc or use `***` placeholders.

### 3.9 Hardcoded Partner Codes
- **js/config.js:26** — `partnerCode: 'AURASPACE2026'`
- **js/config.js:35** — `tmnCode: 'AURASPACE'`

**Impact:** These are public-facing merchant identifiers (not secrets), but should be environment-configurable.
**Fix:** Move to environment/build config.

### 3.10-3.18 — Additional Medium Items

| # | File:Line | Issue | Fix |
|---|-----------|-------|-----|
| 3.10 | js/loyalty.js:642 | `window.prompt()` used for cashback redemption — poor UX, easily spoofed | Replace with a proper modal form |
| 3.11 | js/loyalty.js:656 | `window.confirm()` for financial action | Replace with a proper confirmation UI |
| 3.12 | js/loyalty.js:637,646,650,664,668 | Multiple `alert()` calls for error handling | Replace with toast notifications |
| 3.13 | js/main.js:61 | `alert('Cam on ban da dang ky!')` for newsletter | Replace with toast notification |
| 3.14 | js/checkout.js:95 | `window._checkoutShowToast = showToast` — global namespace pollution | Use module exports or event bus |
| 3.15 | js/websocket-client.js:65-66 | `window.OrderTracker` and `window.orderTracker` — global pollution | Use module imports |
| 3.16 | js/sw.js:147-150 | `syncOrders()` is a no-op stub | Implement or remove the sync handler |
| 3.17 | js/checkout.js:190-193 | `initCheckout()` is empty stub with comment "reserved for future" | Remove or implement |
| 3.18 | js/kds-poll.js:63 | Non-gated `console.log` for initial timestamp seed | Gate behind `DEBUG` |

---

## 4. LOW Issues (12)

| # | File:Line | Issue |
|---|-----------|-------|
| 4.1 | js/auth.js:11,14 | Example credentials in JSDoc comments |
| 4.2 | js/hero-aura.js:18 | console.warn for missing element (acceptable for optional components) |
| 4.3 | js/theme.js:41 | `new ThemeManager()` — side-effect on import (no issue, but unusual pattern) |
| 4.4 | js/cart.js:3 | Comment "Production version - No console.logs" — already achieved |
| 4.5 | js/i18n.js:294-297 | i18n placeholder translation code is unused (module never loaded) |
| 4.6 | js/i18n.js:370 | `addLanguageToggle: () => {}` — empty stub |
| 4.7 | js/i18n.js:371 | `updateLanguageToggle: () => {}` — empty stub |
| 4.8 | js/shared-nav.js:479 | `btn.innerHTML = currentTheme === 'light' ? MOON_SVG : SUN_SVG` — SVG is code-controlled, safe |
| 4.9 | js/landing/gallery.js:11 | `overlay.innerHTML` — content is code-controlled static HTML, safe |
| 4.10 | js/checkout/qr-code.js:107 | `container.innerHTML = qrSvg` — SVG is generated from code, safe |
| 4.11 | js/premium-ui.js | Counter animation module — no issues found |
| 4.12 | js/mobile-nav.js | Navigation toggle — no issues found |

---

## 5. Summary by Category

| Category | Count | Severity Breakdown |
|----------|-------|--------------------|
| Payment Gateway Sandbox | 3 | 2 CRITICAL, 1 HIGH |
| XSS Vulnerabilities | 3 | 3 HIGH |
| i18n Module Disconnected | 1 | 1 CRITICAL |
| Service Worker Path | 1 | 1 CRITICAL |
| Mock Data in Production | 1 | 1 HIGH |
| Dead Imports / Dead Code | 3 | 1 HIGH, 2 MEDIUM |
| Console Statements | 12 | 12 MEDIUM (4 ungated, 8 gated/warn) |
| Localhost Duplication | 8 | 8 MEDIUM (functional but DRY violation) |
| Security Hygiene | 3 | 1 HIGH, 2 MEDIUM |
| UX Issues (alert/prompt) | 5 | 5 MEDIUM |
| Low / Informational | 12 | 12 LOW |

---

## 6. Go LIVE Blockers (Must Fix Before Deploy)

1. **Switch MoMo and VNPay to production endpoints** (config.js:27,36)
2. **Fix PayOS client ID injection** — `process.env` does not work in browsers (config.js:31)
3. **Fix Service Worker path** — move `js/sw.js` to root or update registration path
4. **Load i18n.js in HTML** — or remove from SW cache list and remove `window.i18n` references
5. **Sanitize innerHTML in script.js and kds-render.js** — XSS vectors
6. **Remove/gate mock loyalty data** — users will see fake 125K cashback
7. **Move discount codes to server-side validation** — client-side codes are exposed
8. **Remove or gate KDS test order generator** in production

---

## 7. Files Scanned (32/32)

```
js/api-client.js         js/auth.js              js/cart.js
js/checkout.js           js/checkout/cart-summary.js  js/checkout/payment.js
js/checkout/qr-code.js   js/config.js            js/hero-aura.js
js/hero-v8-bazi.js       js/i18n.js              js/kds-app.js
js/kds-poll.js           js/kds/kds-api.js       js/kds/kds-render.js
js/landing/form-validation.js  js/landing/gallery.js  js/loyalty.js
js/main.js               js/menu.js              js/mobile-nav.js
js/pos.js                js/premium-ui.js        js/script.js
js/shared-nav.js         js/signup-loyalty.js    js/sw.js
js/theme.js              js/track-order.js       js/ui-animations.js
js/utils.js              js/websocket-client.js
```
