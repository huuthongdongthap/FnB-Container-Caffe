# SELECT AUDITS — Prioritization
## Context: Budget-constrained (15,000,000₫ marketing budget, 1 senior engineer)

---

## Audit Selection Logic

```
Budget Constraint: 1 engineer × 2 hours/week = ~8 hours/month
Selection: Filter risks to R1–R7 (Medium+), deprioritize cosmetic
Output: 1 audit deep-dive + 4 verification steps + 1 deploy
```

## Selected Audits (In Priority Order)

### A1 • PRODUCTION: Apply pending D1 migrations
| Field | Value |
|-------|-------|
| **Risk** | R1 (Score 10.0) |
| **Effort** | 2 min |
| **ROI** | Fixes tier thresholds, rewards, cashback rates for ALL customers |
| **Command** | `wrangler d1 execute fnb-caffe-db --remote --file=db/migrations/20260507_02_loyalty_recalibrate.sql` |
| | `wrangler d1 execute fnb-caffe-db --remote --file=db/migrations/20260507_03_sync_rewards.sql` |
| **Verify** | `GET /api/loyalty/tiers` → 3 tiers (0/500/2000) |
| | `GET /api/loyalty/rewards` → 9 rewards (no Croissant) |

### A2 • DEPLOY: Rebuild + deploy all frontend assets
| Field | Value |
|-------|-------|
| **Risk** | R7 (Score 5.5) |
| **Effort** | 5 min |
| **ROI** | Ships all frontend fixes: tier UI, earn formula, no food items |
| **Command** | `npm run build && wrangler pages deploy dist/` |
| **Verify** | Visit loyalty.html → check tier names (Đồng/Bạc/Vàng), no Kim Cương |
| | Visit menu.html → 0 food items in menu |

### A3 • TEST: Run full test suite
| Field | Value |
|-------|-------|
| **Risk** | R8 (Score 5.0) |
| **Effort** | 5 min |
| **ROI** | Catch any regressions from today's changes |
| **Command** | `npx jest tests/loyalty.test.js tests/order-system.test.js tests/kds-system.test.js` |
| **Verify** | All 3 test files pass |

### A4 • SMOKE: End-to-end loyalty flow test
| Field | Value |
|-------|-------|
| **Risk** | Confirms R2–R5 fixes |
| **Effort** | 5 min |
| **ROI** | Ensures cashback + points + tier upgrade work end-to-end |
| **Steps** | 1. Register new customer via phone-auth |
| | 2. Place order 55K₫ → verify cashback 1,100₫ + 5pts in DB |
| | 3. Spend cashback → verify balance deduction |
| | 4. Redeem reward → verify points deduction + code generated |
| | 5. Simulate tier upgrade (500+ pts) → verify tier changes |

### A5 • BACKFILL: One-time cashback compensation (optional)
| Field | Value |
|-------|-------|
| **Risk** | Customers earned 0₫ cashback since launch (R2) |
| **Effort** | 15 min |
| **ROI** | Customer goodwill, but complex to calculate retroactively |
| **Decision** | Defer — monitor customer complaints, handle case-by-case |

---

## Not Selected (Deferred/Deprecated)

| Risk | Reason |
|------|--------|
| R9 — i18n deprecated 'snacks' key | No runtime error, just unused translation key |
| R10 — _archive/ dead code | Already in archive folder, zero impact |
