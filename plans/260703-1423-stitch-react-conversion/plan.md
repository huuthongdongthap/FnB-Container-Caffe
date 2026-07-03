---
title: "Stitch → React Component Conversion (12 pages)"
description: "Convert 12 new Stitch HTML exports to React TSX components using stitch-react-components patterns. Dark navy + chrome + glassmorphism design system."
status: pending
priority: P1
branch: "main"
tags: [stitch, react, components, conversion]
blockedBy: []
blocks: []
source: plans/reports/brainstorm-260703-1423-stitch-react-conversion-report.md
created: "2026-07-03T14:27:01.007Z"
createdBy: "ck-cli"
mode: parallel
---

# Stitch → React Component Conversion (12 pages)

## Overview

Convert 12 new Stitch HTML exports to production-ready React TSX components.

**Source HTML:** `stitch-exports/{checkout,kds,loyalty,order-success,account,about,reviews,events,referral,admin-login,admin-orders,admin-pos}/design.html`
**Target:** `src/components/stitch/Stitch{PageName}.tsx`
**Design tokens:** `src/styles/stitch-tokens.css`

## Phases

| # | Phase | Pages | Effort | Status |
|---|-------|-------|--------|--------|
| 1 | [P1a: Checkout](./phase-01-p1a-checkout-component.md) | 1 | 45m | Pending |
| 2 | [P1b: KDS](./phase-02-p1b-kds-component.md) | 1 | 45m | Pending |
| 3 | [P1c: Loyalty](./phase-03-p1c-loyalty-component.md) | 1 | 45m | Pending |
| 4 | [P1d: Account Dashboard](./phase-04-p1d-account-dashboard.md) | 1 | 45m | Pending |
| 5 | [P2a: About + Reviews + Events + Referral](./phase-05-p2a-about-reviews-events-referral.md) | 4 | 1h | Pending |
| 6 | [P2b: Admin Login + Orders + POS](./phase-06-p2b-admin-login-orders-pos.md) | 3 | 1h | Pending |
| 7 | [P2c: Order Success](./phase-07-p2c-order-success.md) | 1 | 30m | Pending |

## Dependencies

Phases 1-4 (P1) are independent — can run in parallel.
Phases 5-7 (P2) are independent — can run in parallel.
All phases are independent of each other.

## Key Constraints

- Export new components in `src/components/stitch/index.ts`
- Use `var(--aura-*)` tokens (no hardcoded colors)
- Use Lucide icons (no emoji)
- TypeScript strict with `Readonly<Props>` interfaces
- Mobile-first responsive
- `npm run build` = 0 errors

## Acceptance Criteria

- [ ] 12 new React components compile with 0 TS errors
- [ ] All existing 1,063+ tests pass
- [ ] `npm run build` — 0 errors
- [ ] No hardcoded colors — all via CSS vars
- [ ] Components follow existing Stitch patterns
