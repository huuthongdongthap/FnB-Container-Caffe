# Security Audit

**Date:** 2026-05-19 | **Scanner:** worker-scan --security

---

## 1. SQL Injection

All `.prepare(sql).bind(...)` calls use parameterised queries. **No direct injection risk found.**

**Code smell (not injectable today):**
- `admin-loyalty.js:39,43` — `${filter}` string interpolation inside SQL template; `filter` is hardcoded constant. Risk: future developer extends `periods` array with user input and inherits this pattern.
- `orders.js:391` — `${sortBy} ${orderDirection}` interpolated into ORDER BY clause; `sortBy` validated against allowlist, `orderDirection` is a ternary, safe.

**Rating:** Low (pattern risk only, no live vector)

---

## 2. Auth Bypass

### Critical: PATCH /api/orders/:id — No authentication
```
index.js:79  app.patch('/api/orders/:id', ...)
```
Any unauthenticated caller can change any order status (e.g., `cancelled → completed`), trigger loyalty cashback via `processOrderLoyalty`, or mark orders as paid. **No JWT check, no role check.**

### High: /api/kds/orders — No authentication
```
index.js:82  app.route('/api/kds/orders', ordersHonoRouter)
```
`ordersHonoRouter` has no `requireAuth` middleware. KDS exposes full order list (customer names, phones, addresses) to anonymous requests.

### High: /api/seed-menu — No authentication, no removal
```
index.js:127  app.post('/api/seed-menu', ...)
```
Comment says "temporary — remove after use." Still deployed. Unauthenticated callers can overwrite all menu categories and items.

### Medium: /api/test/telegram-sim — No authentication
```
index.js:152  app.post('/api/test/telegram-sim', ...)
```
Dev-only test endpoint deployed to production. Allows triggering Telegram notifications for arbitrary order IDs without auth.

### Low: authCustomer path exclusion in loyalty.js
```
loyalty.js:57-61  pubPaths.includes(c.req.path.replace('/api/loyalty', ''))
```
If Hono strips the route prefix before the middleware runs, `c.req.path` may already be `/phone-auth` (no prefix), and `.replace('/api/loyalty', '')` does nothing — making the check always match pubPaths and skipping auth for all loyalty endpoints. Should use route-relative path matching.

---

## 3. XSS

### admin/pos.html
- Line 338: `${esc(o.customer_name)}` — **correctly escaped** via `esc()` helper.
- Line 211: `${esc(m.name)}` — escaped.
- Line 240, 208: cart and menu items use `esc()` — safe.
- Line 345: `window.document.write(html)` — receipt print window; content assembled from `state` (local data), not from unsanitised API response. Moderate risk if items data flows from DB without escaping.

### admin/loyalty-dashboard.html
- Lines 339, 356, 406, 421: Customer names and phones all wrapped in `esc()` — safe.

### js/cart.js (lines 186, 198), js/script.js (lines 129, 163), js/checkout/cart-summary.js (line 113)
- `innerHTML` templates with `item.name`, `item.description` from API — **no `esc()` applied**. Menu item names from DB rendered raw. Low practical risk (attacker would need DB write access) but violates defence-in-depth.

### js/loyalty.js lines 823–824
```js
el.innerHTML = el.innerHTML.replace(/\{code\}/g, '<span...>' + code + '</span>');
```
`code` is a referral code returned from the API. If the API is compromised or the code contains `</span><script>`, it executes. Should use `textContent` for code insertion.

### js/kds/kds-render.js (lines 112–115)
`innerHTML` for KDS columns with customer order data — no escape observed. Customer name/phone from DB injected raw.

---

## 4. Secrets Exposure

- No hardcoded API keys, tokens, or passwords found in any scanned file.
- `JWT_SECRET`, `RESET_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` all read from `env.*` (Cloudflare Worker bindings). **Clean.**
- `auth.js:10`: `typeof AURA_DEBUG !== 'undefined' && AURA_DEBUG` — debug flag read from global scope. If someone sets `AURA_DEBUG=true` in Workers config, debug stack traces are logged to console (Workers log stream). Acceptable but worth noting.

---

## 5. Input Validation

### /api/loyalty/phone-auth (loyalty.js:125)
```js
if (!phone || !/^[0-9]{9,15}$/.test(phone)) { ... }
```
- Strips whitespace before validation. **Adequate.**
- `body.name` accepted without length or character validation — a 10,000-char name would be inserted into the DB.
- `body.referral_code` accepted without validation — passed to `applyReferralForNewCustomer`; that function should validate, but no check here.

### /api/loyalty/cashback (loyalty.js:316)
- `type` query param passed raw to SQL bind — not validated against `['earn', 'spend', 'bonus']` allowlist.

### /api/loyalty/spend-cashback (loyalty.js:344)
- `amount` from JSON body: no check for `Number.isInteger(amount)` or max value before financial deduction. Float amounts like `99999.999` would pass the `amount > maxAllowed` guard but cause float arithmetic in balance.

---

## 6. CORS (index.js:46–63)

```js
origin: (origin) => {
  if (!origin) { return ''; }  // server-to-server: allow all
  return ALLOWED_ORIGIN_PATTERNS.some(...) ? origin : '';
}
```
- Allowlist is well-defined: production domain, Pages previews, localhost.
- `!origin` returns `''` (empty string) — in Hono/CF CORS middleware, returning `''` as CORS origin header value means no `Access-Control-Allow-Origin` header is set, effectively blocking non-origin requests. **This is safe.**
- `credentials: true` with origin allowlist — correct pairing (not using wildcard `*`).

**Rating:** Clean

---

## 7. Rate Limiting

| Endpoint | Rate Limited | Limit |
|----------|-------------|-------|
| `POST /api/loyalty/phone-auth` | Yes (KV throttle) | 10 req / 5 min / IP |
| `POST /api/auth/login` | **No** | — |
| `POST /api/auth/register` | **No** | — |
| `PATCH /api/orders/:id` | **No** | — |
| `POST /api/auth/reset-password` | **No** | — |
| `POST /api/auth/change-password` | **No** | — |
| All admin endpoints | **No** (rely on JWT only) | — |

Login and reset-password endpoints are brute-forceable with no rate limit.

---

## Summary

| Category | Critical | High | Medium | Low |
|----------|---------|------|--------|-----|
| SQL Injection | 0 | 0 | 0 | 1 |
| Auth Bypass | 0 | 3 | 1 | 1 |
| XSS | 0 | 0 | 3 | 2 |
| Secrets | 0 | 0 | 0 | 0 |
| Input Validation | 0 | 0 | 2 | 1 |
| CORS | 0 | 0 | 0 | 0 |
| Rate Limiting | 0 | 1 | 2 | 0 |
| **Total** | **0** | **4** | **8** | **5** |
