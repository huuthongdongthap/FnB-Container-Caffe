---
phase: 2
title: QR Generation Admin Page
status: completed
priority: P1
effort: 0.5d
---

# Phase 2: QR Generation Admin — Complete

## Changes

- `src/pages/admin/GenerateQR.tsx` — NEW: Admin page with:
  - Fetches all tables from GET /api/tables
  - Canvas QR codes using `qrcode` package
  - Print-friendly layout with `@media print` classes
  - "Print All" button triggering window.print()
  - Error/loading states
  - QR URL format: `https://auraspace.cafe/menu?table={table_number}`
