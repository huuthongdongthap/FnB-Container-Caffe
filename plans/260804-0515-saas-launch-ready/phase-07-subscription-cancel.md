--- phase: 7
title: "Subscription Cancel / Plan Change UX"
status: completed
priority: P1
effort: "0.5d"
dependencies: [4]
---

# Phase 07: Subscription Cancel / Plan Change UX

## Overview
Expose "Cancel subscription" and "Change plan" actions from the customer dashboard.

## Requirements
- Cancel button → confirmation modal → POST /subscriptions/:id/cancel
- Change plan → redirect to /saas/pricing
- Cancel records reason, sets status=cancelled, keeps history intact

## Related Code Files
- Modify: src/pages/saas/dashboard/index.tsx (add cancel button + modal)
- Read: worker/src/tree/subscriptions/sub-handlers.ts (cancel handler — already exists)

## Implementation Steps
1. Add "Cancel subscription" button to dashboard subscription card.
2. Click opens confirmation modal text: "Are you sure? Access ends at period end."
3. Confirm calls POST /subscriptions/:id/cancel with { reason: "user_requested" }.
4. On success, refresh dashboard to show cancelled status.
5. "Change plan" button redirects to /saas/pricing (existing pricing page).

## Success Criteria
- [ ] Cancel button visible on active subscription
- [ ] Confirmation modal shown before cancel
- [ ] Cancel succeeds, dashboard updates
- [ ] npm test passes
