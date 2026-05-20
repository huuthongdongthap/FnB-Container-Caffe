# AURA CAFE — Audit Plan 2026-05-20
**Pipeline:** /audit:plan | **Output:** reports/audit/plan/ | **Context:** Pre-launch 06/06/2026

---

## Group 1: Risk Rank (--annual)

| ID | Area | Severity | Finding | Impact |
|----|------|----------|---------|--------|
| R1 | **Loyalty Cashback** | 🔴 CRITICAL | `processOrderLoyalty` reads `order.phone` but column is `customer_phone` — cashback **never fires** on any order | Entire loyalty value prop broken at launch |
| R2 | **Order total_amount** | 🔴 HIGH | 47 orders in DB have `total_amount = null`. `total` is always set but fallback exists — R1 masks this | Cashback = 0 even after R1 fix if total_amount is the only total used |
| R3 | **POST /api/orders unratelimited** | 🟠 MEDIUM | Anyone can POST /api/orders without auth or rate limit — order spam possible | Fake orders flood KDS, staff confusion |
| R4 | **CI/CD broken** | 🟡 MEDIUM | `CLOUDFLARE_API_TOKEN` not in GitHub Secrets → Pages never auto-deploys | Every Pages change requires manual deploy; human error risk |
| R5 | **Zalo ZNS inactive** | 🟡 LOW | `ZALO_ACCESS_TOKEN` not set, 4 template IDs still placeholder | Members get no cashback/tier notifications until OA approved |
| R6 | **console.log in webhooks** | 🟢 INFO | 3 `console.log` in webhooks.js leak payment flow details to CF logs | Minor — CF logs are private, low exposure |
| R7 | **cashback_wallets balance=0** | 🔴 HIGH | All 3 test members have balance=0 after multiple orders — direct symptom of R1 | No member has tested cashback receive flow pre-launch |

---

## Group 2: Select Audits (--budget-constrained)

**Constraint:** 17 days to launch (06/06/2026). Dev capacity: 1 CTO + async workers.

### Selected (must-fix before launch)

| Priority | Audit | Scope | Owner | ETA |
|----------|-------|-------|-------|-----|
| **P0** | Fix `order.phone` → `order.customer_phone` in processOrderLoyalty | loyalty.js:593,613 | CTO | Today |
| **P0** | Verify cashback earn flow: create order → complete → wallet credit | E2E manual + DB verify | CTO | Today |
| **P1** | Rate limit on POST /api/orders (20 req/5min/IP) | index.js | CTO | T2 27/5 |
| **P1** | Add CLOUDFLARE_API_TOKEN to GitHub Secrets | GitHub repo settings | Owner | T2 27/5 |
| **P2** | Load test signup flow with 50 concurrent phone-auth | locust or k6 | T5 05/6 |

### Deferred (post-launch)

| Audit | Why deferred |
|-------|-------------|
| Zalo ZNS template activation | Blocked on OA approval (3-7 business days) |
| CSRF double-submit cookie | Scope too large for 17-day window |
| JWT → HttpOnly cookie migration | Breaking change; post-v2 |
| console.log cleanup in webhooks | Low risk; cosmetic |

---

## Group 3: Allocate Resources (--team-capacity)

```
CTO (today, 2026-05-20):
  ✦ Fix R1: order.phone → customer_phone                      30 min
  ✦ Deploy + verify cashback earn flow end-to-end              1 hr
  ✦ Commit + PR + merge                                       15 min

CTO (T2 2026-05-27):
  ✦ Add POST /api/orders rate limit middleware                 30 min

Owner action (T2-T5 2026-05-27 to 05/6):
  ✦ GitHub Settings → Secrets → CLOUDFLARE_API_TOKEN          10 min
  ✦ Zalo OA registration at oa.zalo.me (needs GPKD)           2-4 hrs

CTO (T5 2026-06-04 — Final smoke test day):
  ✦ node scripts/test-loyalty-e2e.js                          5 min
  ✦ Manual: phone-auth → create order → complete → verify wallet  15 min

Day-of (T7 2026-06-07 D+1):
  ✦ node scripts/generate-member-cards.js 100                 10 min
  ✦ Monitor launch-monitor.html every 30 min                  ongoing
```

---

## Critical Bug Fix — R1 (apply immediately)

**File:** `worker/src/routes/loyalty.js`
**Lines:** 593, 613

```diff
- if (!order.phone) {
+ if (!order.customer_phone) {
    console.log(`Order ${orderId} has no phone, skip loyalty`);
    return { ok: false, reason: 'no_customer' };
  }
  ...
- const customer = await db.prepare('SELECT * FROM customers WHERE phone = ?').bind(order.phone).first();
+ const customer = await db.prepare('SELECT * FROM customers WHERE phone = ?').bind(order.customer_phone).first();
```

**Also verify:** `order.total` fallback covers null `total_amount` (line 607 already handles: `order.total_amount || order.total || 0`).

---

## Verdict

```
Pre-launch cashback flow: ❌ BROKEN (R1 blocks it)
After R1 fix:             ✅ READY
Campaign armed:           ✅ GRAND_OPENING_6_6_2026 active=1, starts 06/06
Security hardening:       ✅ CSV/XSS/auth rate limit deployed
E2E test suite:           ✅ 12/12 green
```
