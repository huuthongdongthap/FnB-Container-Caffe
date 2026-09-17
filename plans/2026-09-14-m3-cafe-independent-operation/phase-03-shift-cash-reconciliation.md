# Phase 03 — Shift Cash Reconciliation & Daily Settlement

**Status:** pending · **Depends:** phase 01 · **Milestone:** M3

## Overview

Implement physical cash reconciliation against system totals per AURA SOP 02:
- Staff/Cashier performs end-of-shift cash drawer count (cash denominations / total actual cash).
- Shift closing calculates expected cash = opening float + cash order payments - cash payouts/refunds.
- Compute variance (`difference = actual_cash - expected_cash`), flagging overage or shortage.
- Store reconciliation records linked to `shift_id` in `@aura/domain-shift` or `@aura/domain-payment`.
- Enforce mandatory reconciliation before shift status transitions to `closed`.

## Related Code Files

### Files to create/modify:
- `packages/domain/shift/src/model/reconciliation-types.ts`
- `packages/domain/shift/src/policies/cash-reconciliation-policy.ts`
- `packages/domain/shift/src/routes/reconciliation.ts`
- `packages/domain/shift/src/index.ts`
- `worker/src/index.ts` (Expose shift reconciliation endpoints)

## Implementation Steps

1. Define reconciliation models (`CashCount`, `ShiftReconciliation`, `VarianceStatus`).
2. Implement reconciliation policy: fetch cash payments for the shift time window from `@aura/domain-payment` records.
3. Compute expected cash vs actual physical cash counted.
4. Expose `POST /api/shifts/:id/reconcile` and `GET /api/shifts/:id/reconciliation`.
5. Add test coverage for balanced shifts, shortages, and overages.

## Success Criteria

- [ ] End-of-shift cash count calculates exact variance against cash payments in D1.
- [ ] Overage/shortage warnings and audit trail persisted to shift record.
- [ ] Shift cannot be closed without completing physical cash reconciliation.
