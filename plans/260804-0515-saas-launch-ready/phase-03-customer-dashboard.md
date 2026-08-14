--- phase: 3
title: "Customer Dashboard — Subscriptions + Invoices"
status: completed
priority: P0
effort: "1.5d"
dependencies: [2]
---

# Phase 03: Customer Dashboard

## Overview
Self-service dashboard where logged-in customers view their subscription, invoices, and container info.

## Requirements
- Show current plan, next billing date, container slot
- Invoice list with status badges
- Empty state when no subscription yet
- Bilingual labels

## Architecture
- Frontend page: `src/pages/saas/dashboard/index.tsx`
- Calls existing APIs:
  - `GET /api/subscriptions` (list for current user via `tenantId`)
  - `GET /api/subscriptions/invoices/list`
- Uses existing hooks from `src/hooks/use-subscriptions.ts`
- Mount new route in `src/App.tsx` under `/saas/dashboard`

## Related Code Files
- Create: `src/pages/saas/dashboard/index.tsx`
- Modify: `src/App.tsx` (add route)

## Implementation Steps
1. Create dashboard page using existing `useMyActiveSubscription` hook.
2. Add sections: plan summary, container info (container_number, zone), invoice table.
3. Mount route at `/saas/dashboard` in App.tsx inside `<ProtectedRoute>`.

## Success Criteria
- [ ] Logged-in customer sees their subscription + invoices without admin role
- [ ] Empty state: "No subscription yet — see pricing"
- [ ] Bilingual VN + EN labels
