--- phase: 5
title: "Onboarding Wizard (4-Step)"
status: completed
priority: P1
effort: "1d"
dependencies: [2]
---

# Phase 05: Onboarding Wizard (4-Step)

## Overview
4-step wizard for new tenants: welcome, container selection, zone selection, confirmation.

## Requirements
- Step 1: Business name confirmation
- Step 2: Container size (10ft/20ft/40ft)
- Step 3: Zone selection (A/B/C/D)
- Step 4: Confirmation → redirect to dashboard
- Draft persisted in sessionStorage (or frontend state)
- Completion triggers subscription creation with 14-day trial

## Architecture
- Frontend: `src/pages/saas/onboard/index.tsx` (main wizard)
- Frontend: `src/pages/saas/onboard/tenant-create.tsx` (step 0 — already created in Phase 02)
- Step components in `src/components/saas/onboarding-wizard/`
- Calls `POST /api/subscriptions` with selected plan_id on final step.

## Related Code Files
- Create: `src/pages/saas/onboard/index.tsx`, `src/components/saas/onboarding-wizard/`
- Read: `worker/src/tree/subscriptions/sub-handlers.ts` (createSubscription logic)

## Implementation Steps
1. Create wizard container component with step state (1-4).
2. Step 1: welcome + business name input
3. Step 2: container size cards (10ft/20ft/40ft) matching plan container_size values
4. Step 3: zone selector (A/B/C/D radio buttons)
5. Step 4: confirmation summary + "Start Trial" button
6. On submit: POST /api/subscriptions → redirect to /saas/dashboard

## Success Criteria
- [ ] 4-step wizard with back/next navigation
- [ ] Bilingual labels (VN/EN)
- [ ] Completion creates subscription with 14-day trial
- [ ] Invalid step blocked by validation
