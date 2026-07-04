---
phase: 3
title: "Admin Pages"
status: pending
priority: P2
dependencies: []
---

# Phase 3: Admin Pages

## Overview

Wire 3 unused admin Stitch components. 3 sub-tasks run in parallel.

## Sub-task 3a: Admin Terminal Layout

Replace AdminLayout.tsx sidebar/navigation shell with StitchAdminTerminalNew. Preserve `<Outlet />` pattern for nested admin routes.

## Sub-task 3b: Order Management

Create or update `/admin/orders` to use StitchOrderMgmtNew. Wire store data for order CRUD + filtering.

## Sub-task 3c: POS Terminal

Update `src/pages/admin/POS.tsx` to use StitchPOSNew. Keep cart/payment business logic, replace presentation.

## Files

- Modify: `src/pages/admin/AdminLayout.tsx`
- Modify/Add: admin order management page
- Modify: `src/pages/admin/POS.tsx`
- Modify: `src/App.tsx`

## Success Criteria

- [ ] /admin/* uses StitchAdminTerminalNew shell
- [ ] Sidebar nav works with all routes
- [ ] /admin/order-mgmt uses StitchOrderMgmtNew
- [ ] /admin/pos renders StitchPOSNew with live data
- [ ] Build + tests pass
