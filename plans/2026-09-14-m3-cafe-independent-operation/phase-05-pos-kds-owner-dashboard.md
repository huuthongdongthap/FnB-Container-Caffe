# Phase 05 — Canonical KDS Consolidation & Owner Dashboard v1

**Status:** pending · **Depends:** phase 01, phase 03 · **Milestone:** M3

## Overview

Consolidate operational interfaces and reporting for café independence:
- **Canonical KDS Routing**: Ensure `/kds` provides deduplicated, station-aware ticket streams (drinks/bar vs kitchen/food) backed by `@aura/domain-kitchen`.
- **Owner Dashboard v1**: Connect daily sales, real-time revenue summary, and shift performance from `worker/src/routes/reports.ts` into a unified "TODAY" operational view.
- **Viva Star Software Retirement Mirror**: Enable daily comparison between AURA sales summary and Viva Star POS records to validate parity before deprecating legacy POS.

## Related Code Files

### Files to create/modify:
- `worker/src/routes/reports.ts` (Ensure domain integration with `@aura/domain-order`, `@aura/domain-payment`, and `@aura/domain-shift`)
- `packages/domain/kitchen/src/policies/station-policy.ts` (Bar vs food station routing)
- Frontend operational views: verify API contract parity for `/kds`, `/reports`, `/shifts`

## Implementation Steps

1. Review and refine `/api/reports/*` aggregation queries for daily revenue, sales by category, and payment methods.
2. Verify KDS ticket queue logic aligns with station filtering (Beverage vs Food).
3. Implement daily reconciliation endpoint comparing recorded cash + digital payments against expected revenue.
4. Add automated test coverage for daily reports and station filtering.

## Success Criteria

- [ ] KDS serves station-specific active queues without order item duplication.
- [ ] Owner Dashboard daily sales aggregation returns real-time operational metrics.
- [ ] Reporting routes verified against `@aura/domain-payment` and `@aura/domain-order`.
