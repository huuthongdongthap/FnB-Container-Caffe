---
title: "AURA CAFE — Reorder + Favorites"
description: "Add reorder from order history and favorites for returning customers"
status: completed
priority: P2
branch: "main"
tags: [customer-features, reorder, favorites, ux]
blockedBy: []
blocks: []
created: "2026-07-05T10:21:00.000Z"
createdBy: "ck-plan"
source: brainstorm
brainstorm: "plans/reports/brainstorm-reorder-favorites-260705-1021-aura-cafe-report.md"
---

# AURA CAFE — Reorder + Favorites

## Overview

Returning customers can re-order their usual items and save favorites. Both features are entirely client-side (no API changes needed).

## Phases

| Phase | Name | Status | Parallel |
|-------|------|--------|----------|
| 1 | [Reorder from History](./phase-01-reorder-from-history.md) | Pending | Yes |
| 2 | [Favorites](./phase-02-favorites.md) | Pending | Yes |
| 3 | [Sync-Back](./phase-03-sync-back.md) | Pending | No (barrier) |

Phases 1 + 2 run in parallel. Phase 3 depends on both.

## Effort

| Phase | Hours |
|-------|-------|
| 1: Reorder | 2h |
| 2: Favorites | 2h |
| 3: Sync-Back | 0.5h |
| Total | ~4.5h |

## Quality Gates

- Build 0 TS errors
- Tests 1,091+ passing
- i18n bilingual (en + vi)
