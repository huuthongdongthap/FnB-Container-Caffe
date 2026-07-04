---
phase: 2
title: "Customer Pages"
status: pending
priority: P1
dependencies: []
---

# Phase 2: Customer Pages

## Overview

Create 3 new customer-facing routes. 3 sub-tasks run in parallel.

## Sub-task 2a: /order

Create `src/pages/order/index.tsx` wrapping StitchMobileOrderNew.
Add route in App.tsx: `<Route path="/order" element={<OrderPage />} />`

## Sub-task 2b: /container

Create `src/pages/container/index.tsx` combining StitchContainerNew1 + New2.
Add route in App.tsx: `<Route path="/container" element={<ContainerPage />} />`

## Sub-task 2c: /events (replace)

Update `src/pages/events.tsx` to use StitchEventsNew2 instead of current implementation. Keep store data logic, replace presentation.

## Files

- Create: `src/pages/order/index.tsx`
- Create: `src/pages/container/index.tsx`
- Modify: `src/pages/events.tsx`
- Modify: `src/App.tsx`

## Success Criteria

- [ ] /order renders StitchMobileOrderNew
- [ ] /container renders StitchContainerNew1/2
- [ ] /events renders StitchEventsNew2
- [ ] Navigation works (header/footer present)
- [ ] Build + tests pass
