# Loyalty Golive Summary

**Date:** 2026-04-30  
**Pipeline:** /dev:feature → /core:cook  
**PR:** https://github.com/huuthongdongthap/FnB-Container-Caffe/pull/14  
**Commits:** `9ec0150` + `ac15c46`

---

## Golive Checklist

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Worker deployed | ✅ | v6a03709f, https://aura-space-worker.sadec-marketing-hub.workers.dev |
| 2 | D1 migration executed | ✅ | 6 tables + 3 tier rows + 4 ALTER TABLE columns |
| 3 | Tests passing | ✅ | 56/56 (Jest, 0.41s) |
| 4 | Vite build clean | ✅ | 389ms, 0 errors |
| 5 | Rate limiting on public endpoint | ✅ | 10 req/5min/IP via AUTH_KV |
| 6 | Cashback redeem calls real API | ✅ | POST /spend-cashback with amount dialog |
| 7 | Brand tokens aligned | ✅ | loyalty.html :root uses var(--aura-*) |

---

## Architecture

### Phone Auth Flow (0đ cost)

```
[Guest enters SĐT]
  → POST /api/loyalty/phone-auth { phone: "0912345678" }
  → Rate limit check (10/5min/IP via AUTH_KV)
  → Worker queries D1: SELECT * FROM customers WHERE phone = ?
  → Found:   generateJWT → { token, customer }
  → Not found: INSERT customers + cashback_wallets → generateJWT → { token, customer }
  → JS stores JWT → fetches /summary, /points, /cashback
```

### Cashback Redeem Flow

```
[User clicks "Đổi Cashback"]
  → JS prompts amount (min 10,000₫)
  → POST /api/loyalty/spend-cashback { order_id, amount }
  → Authorization: Bearer <JWT>
  → Worker: validate balance → deduct wallet → insert transaction → update order
  → JS reloads /summary → updated balance displayed
```

### D1 Tables Created

| Table | Rows (seed) | Purpose |
|-------|-------------|---------|
| `customers` | 0 | Phone-based customer profiles |
| `loyalty_tiers` | 3 (silver/gold/platinum) | Tier configuration |
| `cashback_wallets` | 0 | 1:1 per customer |
| `cashback_transactions` | 0 | Earn/spend/bonus history |
| `loyalty_point_logs` | 0 | Point accumulation history |
| `user_rewards` | 0 | Claimed vouchers |
| `orders` (altered) | — | +4 columns: cashback_used, cashback_earned, points_earned, reward_code_used |

### Capacity (Free Tier)

| Scale | Customers/day | Free tier % | Cost |
|-------|--------------|-------------|------|
| 1-3 quán | 50-100 | < 1% | 0₫ |
| 10 quán | 500 | ~3% | 0₫ |
| 50 quán | 5,000 | ~30% | 0₫ |

---

## Files Modified (This Pipeline)

| File | Change |
|------|--------|
| `js/loyalty.js` | Phone-auth API flow, cashback redeem via /spend-cashback, renderLoyaltyCardFromData(), mock fallback, 955→789 lines |
| `loyalty.html` | Phone lookup form, cashback section (#cbAmount, #cbHistory), brand token vars |
| `worker/src/routes/loyalty.js` | POST /phone-auth (public, rate-limited), generateJWT import, authCustomer bypass for /phone-auth & /tiers |
| `tests/loyalty.test.js` | 20→56 test cases (phone-auth, API, DOM, Worker, tier mapping, CSS tokens) |
| `db/migrations/20260430_01_loyalty_cashback.sql` | D1 migration: 6 tables + tier seeds + order columns |

---

## Commits

1. `9ec0150` — feat(loyalty): phone-auth + cashback UI + API-first data flow
2. `ac15c46` — feat(loyalty): golive readiness — cashback redeem, rate limit, D1 migration, brand tokens