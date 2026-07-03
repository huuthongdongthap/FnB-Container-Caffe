---
phase: 6
title: "P2b: Admin Login + Orders + POS"
status: pending
priority: P2
effort: 1h
---

# Phase 6: Admin Login, Orders, POS

## Overview

Convert 3 admin-facing pages.

| Source | Target |
|--------|--------|
| `stitch-exports/admin-login/design.html` | `StitchAdminLogin.tsx` |
| `stitch-exports/admin-orders/design.html` | `StitchAdminOrders.tsx` |
| `stitch-exports/admin-pos/design.html` | `StitchAdminPOS.tsx` |

## Related Code Files

- Create: 3 files in `src/components/stitch/`
- Modify: `src/components/stitch/index.ts`

## Implementation Steps

1. Read each source HTML
2. Admin Login: centered glass card, dark inputs
3. Admin Orders: order list, status badges, search, filters
4. Admin POS: two-panel (menu + cart), category chips
5. Export all
6. npm run build

## Success Criteria

- [ ] 3 admin components compile
- [ ] Dark admin styling matches dashboard
- [ ] npm run build — 0 errors
