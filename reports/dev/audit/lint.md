# Lint Audit — worker/src/ + js/

**Date:** 2026-05-19 | **Scanner:** worker-scan --lint

---

## worker/src/routes/

### auth.js
| Line | Issue | Severity |
|------|-------|----------|
| 10 | `typeof AURA_DEBUG !== 'undefined'` — global `AURA_DEBUG` referenced without import/env binding; will throw in strict module scope | Medium |
| 14 | `generateId` uses `.substr()` (deprecated) — use `.substring()` | Low |
| 505 | `let cursor = undefined` — should be `let cursor` or `= null` | Low |

### orders.js
| Line | Issue | Severity |
|------|-------|----------|
| 11 | Same `typeof AURA_DEBUG` global ref as auth.js | Medium |
| 65 | `generateId` uses `.substr()` (deprecated) | Low |
| 287 | `updatableFields` built but never guards against injecting unknown body keys beyond the list — `updates.length === 1` check relies on CURRENT_TIMESTAMP always being added; if `updatableFields` loop never fires the guard still passes with `updates = ['updated_at = CURRENT_TIMESTAMP']` and falls through to run a no-op UPDATE | Low |

### loyalty.js
| Line | Issue | Severity |
|------|-------|----------|
| 57–61 | `authCustomer` path-matching uses `c.req.path.replace('/api/loyalty', '')` — if Hono strips prefix before reaching middleware, replace finds nothing and all routes may be treated as public. Should compare last segment only or use path matching library. | High |
| 316 | `type` query param from `c.req.query('type')` injected raw into `query += ' AND type = ?'` — parameterised correctly, but no allowlist validation means arbitrary strings are bound (results in empty resultset, not injection, but still sloppy) | Low |
| 383 | String concat `'Thanh toán đơn #' + order_id.slice(0, 8)` inside `.bind()` — acceptable but inconsistent with template literal style elsewhere | Low |

### admin-loyalty.js
| Line | Issue | Severity |
|------|-------|----------|
| 39, 43 | Template literals inject `${filter}` directly into SQL string: `WHERE type IN ('earn', 'bonus') AND ${filter}` — `filter` is a **hardcoded constant** in the `periods` array, not user input, so this is not injectable. But the pattern is dangerous if `periods` is ever extended with external input. Flag as code smell. | Low |
| 144 | `catch (_)` swallows referral table error silently — suppresses unexpected errors beyond table-not-found | Low |

---

## js/ (browser)

| File | Line | Issue | Severity |
|------|------|-------|----------|
| `js/cart.js` | 186, 198 | `innerHTML` with item data — no `esc()` helper used; item names from API could contain `<script>` | Medium |
| `js/script.js` | 129, 163 | `innerHTML` in cart/product render — item.name and item.description not escaped | Medium |
| `js/loyalty.js` | 823–824 | `el.innerHTML.replace()` on itself — double innerHTML mutation is fragile; referral code injected without HTML-escape | Medium |
| `js/checkout/cart-summary.js` | 113 | `innerHTML` template with `item.name` — no escape | Medium |
| `js/checkout/payment.js` | 74 | `innerHTML` template — order fields unescaped | Medium |
| `js/kds/kds-render.js` | 112–115 | `innerHTML` for all KDS columns; order customer names from DB rendered raw | Medium |

---

## Summary

- **High:** 1 (authCustomer path-match bypass risk)
- **Medium:** 7 (global AURA_DEBUG × 2, innerHTML without escape × 5+)
- **Low:** 7 (deprecated substr, code style)
- **Total:** 15 findings
