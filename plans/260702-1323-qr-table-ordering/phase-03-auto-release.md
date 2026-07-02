---
phase: 3
title: Table Auto-Release
status: completed
priority: P1
effort: 0.5d
---

# Phase 3: Table Auto-Release — Complete

## Changes

- `worker/src/tree/orders/update-order.ts` — When order status changes to 'served', reads the order's `table_id` and auto-releases the table (sets cafe_tables.status = 'Available')
- Error is non-blocking (logged, not propagated)
- Works via the legacy order update path that admin/KDS uses
