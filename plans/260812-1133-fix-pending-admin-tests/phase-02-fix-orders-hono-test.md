# Phase 02: Fix Orders Hono Test
Files owned: `worker/src/__tests__/routes/orders-hono.test.ts`
## Status: In Progress (WIP — debeak update edit this phase to reflect)
## Implementation Steps
1. Update request URLs to match actual router mount points (`/checkout`, `/guest-checkin`, `/`).
2. Verify ordersRouter.fetch respects these paths after router remount.
3. Run Orders Hono unit tests; confirm green before continuing.
