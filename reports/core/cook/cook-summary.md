# Cook Summary — Loyalty Cashback + Phone Auth Pipeline

**Date:** 2026-04-30  
**Pipeline:** /core:cook  
**Status:** ✅ COMPLETE

---

## Recipe Tasks

| # | Task | Status | Files Changed |
|---|------|--------|---------------|
| 1 | Clean duplicate renderLoyaltyCard() — 8 copies → 1 | ✅ | `js/loyalty.js` (955→766 lines) |
| 2 | Wire renderLoyaltyCard() into loadLoyaltyData() | ✅ | `js/loyalty.js` |
| 3 | Add #cbAmount + #cbHistory HTML sections | ✅ | `loyalty.html` |
| 4 | Add "Đổi Cashback" button + redeemCashback() | ✅ | `loyalty.html`, `js/loyalty.js` |
| 5 | Add phone lookup form (#phoneLookup) | ✅ | `loyalty.html` |
| 6 | Create POST /api/loyalty/phone-auth endpoint | ✅ | `worker/src/routes/loyalty.js` |
| 7 | Rewrite loyalty.js IIFE → API-first + mock fallback | ✅ | `js/loyalty.js` |
| 8 | Wire authCustomer middleware bypass for public routes | ✅ | `worker/src/routes/loyalty.js` |
| 9 | Vite build verification | ✅ | Build 460ms, 0 errors |
| 10 | Worker dry-run deploy | ✅ | 0 errors |

---

## Architecture

### Phone Auth Flow (0đ cost)

```
[Guest enters SĐT]
  ↓ POST /api/loyalty/phone-auth { phone: "0912345678" }
  ↓ Worker queries D1: SELECT * FROM customers WHERE phone = ?
  ├── Found    → generateJWT → { token, customer }
  └── Not found → INSERT customers + cashback_wallets → generateJWT → { token, customer }
  ↓
JS stores JWT in localStorage → fetches /summary, /points, /cashback
```

### Data Flow

| Layer | Technology | Free Tier Limit |
|-------|-----------|-----------------|
| Frontend | Vanilla JS (loyalty.js) | — |
| API | Cloudflare Workers | 100K req/day |
| Auth | JWT (HS256, 7-day TTL) | Stateless |
| Database | Cloudflare D1 (SQLite) | 5GB + 5M reads/mo |
| Session revoke | Cloudflare KV | 1GB + 100K reads/day |

### Customer Journey

```
LẦN ĐẦU (Chưa có data):
  → Trang loyalty → mock data + ô nhập SĐT
  → Nhập SĐT → phone-auth → JWT + customer mới (tier: silver, points: 0)
  → Card hiển thị data thật từ D1

LẦN SAU (Đã có JWT):
  → Trang loyalty → đọc localStorage → fetch /summary → data thật
  → Nếu JWT hết hạn → phone-auth lại bằng SĐT đã lưu

MẤT CACHE:
  → Xoá localStorage → nhập lại SĐT → data không mất (lưu trên D1)
```

### D1 Tables Used

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `customers` | Customer profile | id, phone, email, loyalty_tier, loyalty_points |
| `cashback_wallets` | Cashback balance | customer_id, balance, total_earned, total_spent |
| `cashback_transactions` | Cashback history | wallet_id, type, amount, balance_after |
| `loyalty_point_logs` | Point history | customer_id, points_change, reason, balance_after |
| `loyalty_tiers` | Tier config | tier_name, min_points, cashback_rate, point_multiplier |

---

## Key Decisions

1. **No password for loyalty** — SĐT-only auth (like Starbucks, Highlands model)
2. **Fake email pattern** — `{phone}@loyalty.aura` to satisfy JWT email-based lookup
3. **Mock fallback** — If API unreachable, shows mock data + phone lookup form
4. **JWT stored in localStorage** — Compatible with existing authCustomer middleware
5. **Auto-create customer + wallet** — On first phone-auth, creates both `customers` and `cashback_wallets` rows

---

## Files Modified

| File | Change | Lines |
|------|--------|-------|
| `js/loyalty.js` | Removed 8 duplicate renderLoyaltyCard(); added phoneAuth(), fetchSummary(), fetchPoints(), fetchCashback(), initLoyalty(), handlePhoneLookup(), loadServerData(), renderLoyaltyCardFromData(); rewrote init flow | 766 |
| `loyalty.html` | Added phone lookup form (#phoneLookup); added cashback section (#cbAmount, #cbHistory, #redeemCashbackBtn) | 344 |
| `worker/src/routes/loyalty.js` | Added POST /phone-auth (public); added generateJWT import; added authCustomer bypass for public routes (/phone-auth, /tiers) | 395 |

---

## Capacity Estimate (Free Tier)

| Scale | Customers/day | Free tier % | Cost |
|-------|--------------|-------------|------|
| 1-3 quán | 50-100 | < 1% | 0₫ |
| 10 quán | 500 | ~3% | 0₫ |
| 50 quán | 5,000 | ~30% | 0₫ |
| 100+ quán | 50,000 | ~150% | $5-10/mo |