# Security Audit — worker/src/

**Date:** 2026-05-19 | **Scope:** SQL injection, auth bypass, secrets, CORS, rate limiting, XSS

---

## CRITICAL

### C1 — `/api/seed-menu` Unauthenticated Menu Overwrite
**File:** `worker/src/index.js:127`  
**Risk:** Any public attacker can POST to this endpoint and overwrite the entire menu DB.
No auth middleware, no `requireAuth`. Marked "temporary" but still live.

```js
app.post('/api/seed-menu', async (c) => {  // NO AUTH
```

**Fix:** Remove entirely or add `requireAuth(['owner'])`.

---

### C2 — `/api/test/telegram-sim` Dev Endpoint Without Auth
**File:** `worker/src/index.js:152`  
No auth middleware. Anyone with a valid `order_id` can trigger Telegram notifications,
spamming the kitchen/owner's Telegram bot.

**Fix:** Add `requireAuth(['owner', 'staff'])` or remove in production.

---

## HIGH

### H1 — SQL String Interpolation in admin-loyalty.js (Controlled Input)
**File:** `worker/src/routes/admin-loyalty.js:39,43`

```js
`SELECT ... FROM cashback_transactions WHERE type IN ('earn', 'bonus') AND ${filter}`
```

`filter` values are hardcoded constants from the `periods` array (lines 30-32), not user
input. **Not exploitable as-is.** However, the pattern is dangerous if `filter` is
ever derived from request params. Flag for refactor using parameterized queries.

---

### H2 — CSV Injection in Admin Export
**File:** `worker/src/routes/admin-loyalty.js:201`

```js
csv += results.map(r =>
  `${r.id},"${(r.name||'').replace(/"/g,'""')}",${r.phone},...`
```

`r.phone` is unquoted. Phone values like `=CMD(...)` or `+CMD(...)` are classic CSV
injection vectors for Excel. `r.source` (line 201) is also unquoted.

**Fix:** Quote all string fields. For phone: `"${String(r.phone||'').replace(/"/g,'""')}"`.

---

### H3 — XSS: `txn.description` rendered via innerHTML
**File:** `js/loyalty.js:443`

```js
'<div class="hist-name">' + desc + '</div>'
```

`desc = txn.description || txn.reason || txn.type` — comes from API response.
The description field is set server-side (not direct user input), but if the DB
is compromised or a future code path allows user-supplied descriptions, this is XSS.
Additionally `js/loyalty.js:379` (in a different render block):

```js
<span class="transaction-description">${txn.description}</span>
```

Template literal also unescaped.

**Fix:** Escape HTML before insertion: `desc.replace(/&/g,'&amp;').replace(/</g,'&lt;')...`
or use `textContent` where possible.

---

### H4 — `redeem` Race Condition (Double-Spend)
**File:** `worker/src/routes/loyalty.js:429-456`

Read-check-update is non-atomic. Concurrent requests can both pass `pts >= reward.point_cost`
and both deduct points.

**Fix:**
```sql
UPDATE customers SET loyalty_points = loyalty_points - ?
WHERE id = ? AND loyalty_points >= ?
```
Check `meta.changes === 0` → reject with 409 Conflict.

---

### H5 — `spend-cashback` No Idempotency + No Rate Limit
**File:** `worker/src/routes/loyalty.js:341`

- Repeated calls with same `order_id` + `amount` will each deduct from wallet until
  balance hits 0 (no duplicate check beyond wallet balance).
- No throttle() applied unlike `/phone-auth`.

**Fix:** Add `WHERE cashback_used = 0` guard on orders query + add throttle(c, 'sc', 5, 60).

---

## MEDIUM

### M1 — Auth Bypass Concern: loyaltyRouter intercepts referral paths
**File:** `worker/src/index.js:119-120`

`loyaltyRouter.use('/*', authCustomer)` runs before `referralRouter`. The `authCustomer`
middleware does a D1 lookup `SELECT * FROM customers WHERE email = ?`. If a customer
exists in KV (registered via `/api/auth/register`) but NOT in D1 `customers` table
(async sync failed at line 281-287), they'll get HTTP 404 on all loyalty AND referral
endpoints despite having a valid JWT.

**Fix:** Move `app.route('/api/loyalty/referral', referralRouter)` BEFORE
`app.route('/api/loyalty', loyaltyRouter)` in index.js — Hono matches more-specific
paths first when registered first.

---

### M2 — Tier Inconsistency: `registerUser` assigns `'silver'`
**File:** `worker/src/routes/auth.js:285`

v2 default tier is `bronze`. Customers registering via email/password get `silver`.
This is a free tier upgrade for email-registered users vs phone-registered users.

---

### M3 — `authCustomer` Leaks Customer 404 Detail
**File:** `worker/src/routes/loyalty.js:74`

```js
return c.json({ success: false, error: 'Customer not found' }, 404);
```

Distinguishable from 401 — confirms to attacker that the token is valid but customer
record is missing. Merge with 401 response.

---

## LOW

### L1 — CORS: Returns Empty String for Disallowed Origins
**File:** `worker/src/index.js:56-58`

```js
return ALLOWED_ORIGIN_PATTERNS.some(...) ? origin : '';
```

Returning `''` for disallowed origins causes CORS headers to be set to empty string,
which may confuse some browsers. Should return `null` or omit header entirely.

### L2 — JWT `DEBUG` Flag Always False
**File:** `worker/src/routes/auth.js:10`

```js
const DEBUG = typeof AURA_DEBUG !== 'undefined' && AURA_DEBUG;
```

Module-scope `AURA_DEBUG` is never defined. DEBUG is always false. Error logs silenced
in production even when needed. Should be `const DEBUG = c.env?.AURA_DEBUG === 'true'`
(but that requires request context).

### L3 — `legacyHashPassword` SHA-256 No Salt Retained Indefinitely
**File:** `worker/src/routes/auth.js:145-151`

Accounts that never re-login retain a salted SHA-256 hash. No migration deadline.
Low risk as login auto-migrates on success, but an attacker with DB dump can crack
unsalted hashes with rainbow tables.

### L4 — Rate Limit Uses IP Only (Shared NAT Risk)
**File:** `worker/src/routes/loyalty.js:32`

`CF-Connecting-IP` for phone-auth rate limiting. Behind corporate NAT or VPN,
legitimate users share IPs. Consider adding phone-number as secondary key:
`'rl:pa:' + phone` in addition to IP.
