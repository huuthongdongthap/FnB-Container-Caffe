---
phase: 4
title: Admin Controls — Table Occupancy Widget
status: completed
priority: P1
effort: 0.5d
---

# Phase 4: Admin Controls — Complete

## Changes

- `src/pages/admin/Dashboard.tsx` — Added "Sức chứa bàn" (Table Occupancy) widget:
  - Fetches all tables, counts by status
  - Color-coded stat cards (total/available/occupied/reserved)
  - Loading skeleton with pulse animation
  - Pre-existing code path (no breakage when widget unavailable)
