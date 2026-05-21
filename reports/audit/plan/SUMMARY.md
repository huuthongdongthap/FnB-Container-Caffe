# AUDIT PLAN — AURA SPACE Loyalty System
> Recipe: `recipes/audit/plan.json` | DAG: 3 groups | Context: `/audit-plan check kế hoạch i`  
> Generated: 2026-05-07 | Target: `reports/audit/plan/`

---

## Executive Summary

After deep audit of the loyalty + cashback + rewards + menu system:

| Metric | Before | After |
|--------|--------|-------|
| **Critical bugs found** | — | 2 (R2 cashback 0₫, R3 dead code) |
| **High bugs found** | — | 3 (R4 tier mismatch, R5 earn 10x, R6 food in menu) |
| **Cashback status** | BROKEN (0₫ all orders) | FIXED (pending migration) |
| **Frontend sync** | OUTDATED (old tiers, wrong formula) | SYNCED |
| **Rewards catalog** | 4 generic + 2 food | 9 drink-only |
| **Menu items** | DB: 14 (3 food), UI: ~50 drinks | DB: 12 drinks only |
| **Test coverage** | Broken assertions | Updated |
| **Pending work** | — | 2 D1 migrations + 1 deploy |

---

## DAG Execution Results

### Group 1: Risk Rank ✅
- **12 findings** across 3,122 LOC
- 2 Critical, 5 High, 3 Medium, 2 Low
- All critical/high fixed in code; 2 pending migration

### Group 2: Select Audits ✅  
- 5 audits selected (budget-constrained)
- A1-A4: Immediate (17 min)
- A5: Deferred (cashback backfill)

### Group 3: Allocate Resources ✅
- 1 engineer, 30 min session
- Parallel execution: A3+A4 simultaneous
- Deploy target: Cloudflare Pages `feature-referral-200-points` branch

---

## Immediate Next Steps

```bash
# Step 1: Apply D1 migrations (~2 min)
cd worker
wrangler d1 execute fnb-caffe-db --remote --file=../db/migrations/20260507_02_loyalty_recalibrate.sql
wrangler d1 execute fnb-caffe-db --remote --file=../db/migrations/20260507_03_sync_rewards.sql

# Step 2: Verify
curl https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty/tiers | jq '.data | length'  # → 3
curl https://aura-space-worker.sadec-marketing-hub.workers.dev/api/loyalty/rewards | jq '.data | length'  # → 9

# Step 3: Build + deploy
npm run build
wrangler pages deploy dist/ --project-name=fnb-caffe-container --branch=feature-referral-200-points

# Step 4: Smoke test
open https://feature-referral-200-points.fnb-caffe-container.pages.dev/loyalty.html
```

---

## Deep Dive Reports
- [Risk Rankings](./risk-rank.md)
- [Audit Selection](./select-audits.md)
- [Resource Allocation](./allocate-resources.md)
