# Type Audit — worker/src/routes/

**Date:** 2026-05-19 | **Scanner:** worker-scan --types | **Lang:** JavaScript (no TypeScript)

---

## loyalty.js

| Line | Pattern | Risk | Severity |
|------|---------|------|----------|
| 227 | `customer.cashback_balance_vnd || 0` — `cashback_balance_vnd` is **not a column** on the `customers` table (balance lives in `cashback_wallets`). This always returns `0` in the JWT response after `phone-auth`, silently lying to the client. | Wrong field access / always-wrong value | High |
| 301–302 | `parseInt(c.req.query('limit') \|\| '20', 10)` — if query param is `'abc'`, `parseInt` returns `NaN`; `NaN` passed to SQL `LIMIT` causes D1 runtime error | NaN propagation | Medium |
| 344 | `const { order_id, amount } = await c.req.json()` — if body is not JSON or missing keys, destructuring yields `undefined`; `amount <= 0` guard catches `undefined` but `!order_id` check passes `""` | Loose falsy check | Low |
| 371 | `wallet.balance < amount` — `wallet.balance` is stored as integer VND; `amount` comes from request JSON and could be float (e.g. `0.5`). No `Number.isInteger` check before deduction. | Type coercion in financial calc | Medium |
| 534 | `campaign?.cashback_multiplier ?? 1.0` — if `cashback_multiplier` is stored as `"2"` (string) in D1, arithmetic `total * baseRate * multiplier` gives string concatenation not multiplication | String/number mix | Medium |

## orders.js

| Line | Pattern | Risk | Severity |
|------|---------|------|----------|
| 108 | `parseInt(body.total)` with no fallback — if `body.total` is `undefined` after validation passes (unlikely but) `parseInt(undefined)` → `NaN` inserted into DB | NaN to DB | Low |
| 222–226 | `JSON.parse(results[0].items)` — no try/catch; if items column is corrupted, getOrder throws unhandled exception propagated to global handler | Runtime exception | Medium |
| 371 | `const status = url.searchParams.get('status')` injected into dynamic query — value not validated against ORDER_STATE_MACHINE keys before use in `query += ' AND status = ?'`; parameterised so not injectable but allows querying garbage states | Logic error | Low |

## auth.js

| Line | Pattern | Risk | Severity |
|------|---------|------|----------|
| 175–176 | `stored.split('$')` with destructuring `[, iterStr, saltHex, hashHex]` — if stored hash is malformed with fewer than 4 `$`-segments, `saltHex.match()` on `undefined` throws TypeError | Null deref in verifyPassword | Medium |
| 285–287 | `registerUser` inserts customer to D1 with `loyalty_tier = 'silver'` hardcoded — contradicts `DEFAULT_TIER = 'bronze'` in loyalty.js. New users registered via email get silver; via phone-auth get bronze. Tier mismatch across auth paths. | Logic inconsistency / wrong state | High |

## admin-loyalty.js

| Line | Pattern | Risk | Severity |
|------|---------|------|----------|
| 51 | `+((rt / it) * 100).toFixed(1)` — if `it` is `0`, `rt / it` is `Infinity`; guard `it > 0` exists but `rt` total from D1 `COALESCE` could still be negative (refunds), giving redemption rate > 100% | Boundary arithmetic | Low |

---

## Summary

- **High:** 2 (`cashback_balance_vnd` phantom field, silver vs bronze tier mismatch)
- **Medium:** 5 (NaN from parseInt, float cashback amount, string multiplier, JSON.parse unguarded, verifyPassword null deref)
- **Low:** 4
- **Total:** 11 findings
