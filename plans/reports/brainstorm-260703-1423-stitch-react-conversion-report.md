# Brainstorm: Next — Stitch → React Component Conversion

**Date:** 2026-07-03T14:23
**Status:** Approved → Handoff to /ck:plan --parallel

## Context

12 new Stitch designs generated, exported to `stitch-exports/{checkout,kds,loyalty,order-success,account,about,reviews,events,referral,admin-login,admin-orders,admin-pos}/`. Each has `design.html` (Tailwind), `DESIGN.md`, `design.png`.

Project already has existing Stitch React components in `src/components/stitch/` (header, footer, hero, menu, etc.) and design tokens in `src/styles/stitch-tokens.css`.

## Scope

Convert ALL 12 Stitch HTML exports → React TSX components:

| # | Page | Device | Priority |
|---|------|--------|----------|
| 1 | Checkout | Desktop | P1 |
| 2 | KDS | Desktop | P1 |
| 3 | Loyalty | Desktop | P1 |
| 4 | Account Dashboard | Mobile | P1 |
| 5 | About Us | Desktop | P2 |
| 6 | Reviews | Desktop | P2 |
| 7 | Events | Desktop | P2 |
| 8 | Referral | Mobile | P2 |
| 9 | Admin Login | Desktop | P2 |
| 10 | Admin Orders | Desktop | P2 |
| 11 | Admin POS | Desktop | P2 |
| 12 | Order Success | Mobile | P2 |

## Approach

Use `stitch-react-components` skill per component. Each component:
- Source: `stitch-exports/{page}/design.html`
- Dest: `src/components/stitch/Stitch{PageName}.tsx`
- Use `var(--aura-*)` tokens from `stitch-tokens.css`
- Use Lucide icons (no emoji)
- TypeScript strict, clsx, mobile-first, dark mode
- `npm run build` after each batch

## Constraints
- Do NOT delete existing page implementations — these are design reference components
- Match existing Stitch component patterns (`StitchHeader`, `StitchFooter`)
- Register new exports in `src/components/stitch/index.ts`
