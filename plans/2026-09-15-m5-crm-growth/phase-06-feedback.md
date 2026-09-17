# Phase 06 — Feedback

**Priority:** MEDIUM — closes the loop, feeds retention.
**Status:** ⏳ PLANNED

## Overview
Customer feedback capture (rating + comment) tied to an optional order. Summary endpoint for owner dashboard.

## Key Insights

- Feedback is customer-scoped (own orders only for submission).
- Summary is owner/staff read.
- Optional orderId — feedback can be general or order-specific.

## Requirements

- `submitFeedback(db, customerId, { orderId?, rating, comment?, tags? })` → feedback row.
- `listFeedback(db, { from?, to?, minRating? })` → paginated.
- `getFeedbackSummary(db)` → { count, avgRating, byRating: [], trend }.
- Migration: `feedback` table.

## Architecture

```
packages/domain/crm/commands/
├── feedback.ts           # submit/list/summary
```

## Related Code Files

### Create
- `packages/domain/crm/commands/feedback.ts`
- `migrations/<date>_04_feedback.up.sql` + `.down.sql`
- `tests/crm-feedback.test.ts`

### Modify
- `packages/domain/crm/index.ts` — barrel exports
- `worker/src/routes/crm.ts` — add routes

## Implementation Steps

1. Create `feedback.ts` (submit/list/summary).
2. Migration: `feedback` table.
3. Routes: `POST /feedback` (customer), `GET /feedback` + `GET /feedback/summary` (owner/staff).
4. Tests: submit, validation (rating 1-5), customer-scoped, summary math.
5. Run full suite.

## Todo

- [ ] `feedback.ts`
- [ ] Migration
- [ ] Routes
- [ ] Tests
- [ ] Run full suite

## Success Criteria

- Feedback submit validates rating range + customer ownership.
- Summary computes avg + distribution.
- tsc clean.

## Security

- Customer can only submit own feedback (order must belong to customer).
- Comment sanitized (length cap, no HTML).
