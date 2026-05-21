# RISK RANK — AURA SPACE Loyalty System
## Generated: 2026-05-07 | Scope: Annual | Context: audit-plan check kế hoạch

---

## Findings Summary

| Rank | Risk | Impact | Likelihood | Score | Status |
|------|------|--------|------------|-------|--------|
| R1 | **D1 migrations not applied** — tier + rewards tables stale | 🔴 Critical | ✅ Certain | 10.0 | PENDING |
| R2 | **cashback_rate bug (now fixed)** — all customers got 0₫ since launch | 🔴 Critical | ✅ Occurred | 10.0 | FIXED |
| R3 | **Dead code triggerAutoCashback** — silent failures on every order | 🟠 High | ✅ Occurred | 9.0 | FIXED |
| R4 | **Frontend/backend tier divergence** — BAC tier skipped, KIM CƯƠNG ghost | 🟠 High | ✅ Occurred | 8.5 | FIXED |
| R5 | **Frontend earn formula 10x** — loyalty.js gave 55pts instead of 5pts | 🟠 High | ✅ Occurred | 8.5 | FIXED |
| R6 | **Menu food items in seed.sql** — 3 food items sold but not on menu | 🟡 Medium | ✅ Occurred | 6.0 | FIXED |
| R7 | **_deploy/ stale artifacts** — built JS still has old tiers, food items | 🟡 Medium | ❌ Likely | 5.5 | PENDING |
| R8 | **Tests outdated** — loyalty.test.js, order-system.test.js, kds-system.test.js | 🟡 Medium | ✅ Certain | 5.0 | FIXED |
| R9 | **i18n deprecated keys** — 'snacks' translation still present | 🟢 Low | 🟡 Possible | 2.0 | ACCEPT |
| R10 | **_archive/ dead code food refs** — no runtime impact | 🟢 Low | 🟢 None | 1.0 | ACCEPT |

---

## Detail per Finding

### R1 — PENDING MIGRATIONS
```
File: db/migrations/20260507_02_loyalty_recalibrate.sql (NOT applied)
File: db/migrations/20260507_03_sync_rewards.sql (NOT applied)
```
- Tier thresholds in production DB: 0/500/1000 (old), config expects 0/500/2000
- Vàng cashback: DB has 0.08, config now 0.05
- Rewards table: 4 generic rewards, config has 9 drink-only rewards
- **Command**: `wrangler d1 execute fnb-caffe-db --remote --file=...`
- **Risk**: Customers see wrong tier names, wrong reward options, wrong cashback rates

### R2 — CASHBACK ALWAYS ZERO (FIXED)
```
File: worker/src/routes/loyalty.js:366
Root cause: tier.cashback_percent → property undefined (column is cashback_rate)
            Formula also had /100, but DB stores 0.02 not 2
```
- Every order since launch credited ZERO cashback
- Fix applied: `tier.cashback_rate` (no `/100`)
- **Backfill**: Existing customers have no cashback — consider one-time bonus?

### R3 — DEAD triggerAutoCashback (FIXED)
```
File: worker/src/routes/orders.js (function removed entirely)
Root cause: Referenced non-existent tables (loyalty_members, loyalty_transactions)
            Wrong column names, wrong formula
```
- Generated error logs on every order status change
- processOrderLoyalty() already handles all loyalty processing correctly
- 68 lines removed from orders.js

### R4 — FRONTEND TIER DIVERGENCE (FIXED)
```
File: js/loyalty.js
Root cause: CUSTOMER_TIERS used 0/5000/15000/50000 thresholds
            tierToObj() skipped BAC (silver→ĐỒNG, gold→VÀNG, platinum→KIM_CƯƠNG)
```
- Customer with 600 pts shown as "Vàng" instead of "Bạc"
- Fix: 3 tiers Đồng(0-499), Bạc(500-1999), Vàng(2000+), removed Kim Cương

### R5 — EARN FORMULA 10X (FIXED)
```
File: js/loyalty.js earnPoints()
Root cause: Math.floor(orderTotal / 1000 / earnRate * 10) = 55pts vs correct 5pts
```
- Frontend showed 10× points compared to backend calculation
- Fix: Math.floor(orderTotal / 10000 * multiplier * eventMultiplier)

### R6 — MENU FOOD MISMATCH (FIXED)
```
Files: db/seed.sql, js/script.js, js/kds-app.js, js/kds/kds-api.js
Root cause: Menu is 100% drinks (10 categories, ~50 items)
            But seed.sql had cat-004 Đồ Ăn Nhẹ with 3 food products
            Frontend MENU_ITEMS had snacks array (7 items)
            KDS had food array (6 items) causing crash on random orders
```
- Fix: Removed cat-004 + food from seed.sql
- Fix: Empty snacks/food arrays in script.js, kds-app.js
- Fix: kds-api.js numFood = 0 to prevent crash

### R7 — STALE DEPLOY ARTIFACTS
```
Files: _deploy/assets/kds-B_ryT5yc.js (has old food refs)
        _deploy/assets/loyalty-BR3KGbRW.js (has KIM_CUONG, old tiers)
        _deploy/admin/dashboard.html (has Bánh Croissant top seller)
```
- Current deployment has stale built JS
- Resolution: rebuild + redeploy after migrations applied

### R8 — OUTDATED TESTS (FIXED)
```
Files: tests/loyalty.test.js, tests/order-system.test.js, tests/kds-system.test.js
```
- loyalty test: Expected KIM_CUONG, minPoints 15000/50000 → updated
- order test: Expected snacks category → removed
- kds test: Expected Croissant Bơ → changed to Sa Đéc Sunset

---

## Risk Heatmap

```
Impact
 10 │ R1  R2           
    │                  
  8 │ R3  R4  R5       
    │                  
  5 │           R6  R7      R8
    │                  
  2 │                      R9
    │                      
  1 │                      R10 
    └────────────────────────── Likelihood
      1    2    5    8    10
```

## Audit Coverage

| Domain | Lines | Risks Found | Fixed | Pending |
|--------|-------|-------------|-------|---------|
| Loyalty (worker) | 432 | 3 | 3 | 0 |
| Orders (worker) | 517 | 1 | 1 | 0 |
| Referrals (worker) | 315 | 0 | 0 | 0 |
| Loyalty (frontend) | 894 | 3 | 3 | 0 |
| Menu (seed + config) | 67+243 | 2 | 2 | 0 |
| KDS (frontend) | 480+131 | 1 | 1 | 0 |
| Deploy artifacts | ~12 files | 1 | 0 | 1 |
| Tests | 3 files | 1 | 1 | 0 |
| **TOTAL** | **~3,122** | **12** | **11** | **1** |
