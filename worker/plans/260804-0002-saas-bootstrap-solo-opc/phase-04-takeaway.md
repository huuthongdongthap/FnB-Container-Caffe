---
phase: 4
title: "Takeaway / Delivery"
status: completed
priority: P0
effort: "2h"
dependencies: [3]
---

# Phase 4: Takeaway / Delivery

## Context Links
- Reports: `reports/researcher-saas-scope.md` (F3)
- Existing: `src/routes/orders-mobile.ts`, `migrations/`

## Overview
Same order flow as dine-in, minus table assignment. One column (`fulfillment_type`) separates the two.

## Requirements
- Guest picks items -> phone + address -> submit order
- fulfillment_type = 'TAKEAWAY' or 'DELIVERY'
- Reuse guest-checkout endpoint from Phase 3

## Architecture
Extend `POST /api/orders/guest-checkout` to accept `fulfillment_type` and `delivery_address`. Orders table already has both columns from migration 014.

## Related Code Files
- Modify: `src/routes/orders-mobile.ts`

## Implementation Steps
1. Accept fulfillment_type in guest checkout body
2. Require delivery_address when fulfillment_type = 'DELIVERY'
3. Default to 'TAKEAWAY' if not provided
4. Route to same order pipeline as dine-in

## Success Criteria
- [ ] Takeaway orders create successfully
- [ ] Delivery orders require address
- [ ] Owner sees fulfillment type in dashboard

## Risk Assessment
- Low risk: same code path as Phase 3

## Security Considerations
- Validate fulfillment_type enum (no arbitrary values)

## Next Steps
Unblocks: Phase 5 (guest checkin independent)
