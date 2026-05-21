# Trace Report — worker/src/

**Date:** 2026-05-19 | **Scope:** Execution paths, undefined variables, logic bugs

---

## 1. loyalty.js — `cashback_balance_vnd` undefined column

**File:** `worker/src/routes/loyalty.js:227`
**Severity:** HIGH — returns 0 always, silently wrong

```js
cashback_balance_vnd: customer.cashback_balance_vnd || 0,
```

`customers` table has no `cashback_balance_vnd` column. The wallet balance lives in
`cashback_wallets.balance`. This field in the `/summary` response is always `0`.
The wallet object (lines 285-292) correctly returns `wallet.balance`, but the
`phone-auth` response at line 227 returns this stale field from the customer row.

**Fix:** Replace with wallet query result or remove the field (it's duplicated by wallet.balance in /summary).

---

## 2. loyalty.js — `authCustomer` path matching fragility

**File:** `worker/src/routes/loyalty.js:58`

```js
c.req.path.replace('/api/loyalty', '')
```

In Hono v4 sub-routers, `c.req.path` inside a mounted subrouter is already stripped
of the mount prefix. The `.replace('/api/loyalty', '')` does nothing (path is already
`/phone-auth`, `/tiers`, etc.) but is harmless. However, this assumption is
undocumented and could break if Hono routing behavior changes. Use `c.req.path`
directly for the pubPaths check.

---

## 3. loyalty.js — `redeem` endpoint: race condition (no isolation)

**File:** `worker/src/routes/loyalty.js:429-456`

Sequence:
1. `SELECT loyalty_points FROM customers` (via authCustomer middleware, stale read)
2. Check `pts >= reward.point_cost` against stale value
3. `UPDATE customers SET loyalty_points = ?`

D1/SQLite has no SELECT FOR UPDATE. Concurrent redemptions on the same account
can both pass the balance check and both deduct. Mitigation: use
`UPDATE customers SET loyalty_points = loyalty_points - ? WHERE id = ? AND loyalty_points >= ?`
and check rowsAffected.

---

## 4. loyalty.js — `spend-cashback` no idempotency, no rate limiting

**File:** `worker/src/routes/loyalty.js:341-393`

- No throttle() call (unlike phone-auth which has 10 req/5min).
- No check whether `cashback_used` already set on the order (double-spend possible if
  caller retries before DB write completes).
- The `UPDATE orders SET cashback_used = ?` only sets the value; no guard against
  `cashback_used > 0` on entry.

---

## 5. auth.js — `registerUser` hardcodes `'silver'` tier

**File:** `worker/src/routes/auth.js:285`

```js
'INSERT OR IGNORE INTO customers ... VALUES (..., \'silver\', ...)'
```

loyalty.js `DEFAULT_TIER = 'bronze'` (v2 spec). Customers registering via
`/api/auth/register` get silver tier instead of bronze — tier inconsistency between
auth and loyalty flows.

---

## 6. index.js — `/api/seed-menu` left deployed

**File:** `worker/src/index.js:126-149`

Comment says "temporary — remove after use" but it's still deployed. This endpoint
accepts unauthenticated POST requests to overwrite the entire menu. No auth check.

---

## 7. index.js — Route ordering: loyaltyRouter intercepts referral paths

**File:** `worker/src/index.js:119-120`

```js
app.route('/api/loyalty', loyaltyRouter);       // line 119
app.route('/api/loyalty/referral', referralRouter); // line 120
```

In Hono v4, `loyaltyRouter.use('/*', authCustomer)` runs for ALL `/api/loyalty/*`
paths including `/api/loyalty/referral/*`. Because `authCustomer` requires a valid
customer JWT (and D1 customer lookup), the referralRouter's own `requireCustomer`
middleware never runs — it's already gated. Net effect is double-auth, but the
critical issue is: if `authCustomer` lookup fails (customer in KV only, not D1),
referral requests will return 404 even with a valid JWT.
