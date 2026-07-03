# Brainstorm: Fix — Stitch Components Match 100%

**Date:** 2026-07-03T16:30
**Status:** Approved → Handoff to implementation

## Problem

12 Stitch React components + production UI + showcase do not match the Stitch AI generated designs at `stitch.withgoogle.com` 100%.

## Root Cause

Manual conversion of Stitch HTML exports → React TSX lost fidelity:
- Material Symbols icons → Lucide icons (different style)
- Stitch-specific Tailwind classes → CSS vars (different spacing/colors)
- Extra TypeScript structure (loading/error states) altered layouts
- Production pages still use old code, not Stitch designs

## Solution

Re-convert ALL 12 Stitch HTML exports to pixel-perfect HTML using `stitch-html-components` skill, then replace production pages.

## Revised Components (12 pages)

| Page | Stitch Source | Replace production file |
|------|--------------|------------------------|
| Checkout | `stitch-exports/checkout/design.html` | `src/pages/checkout.tsx` |
| KDS | `stitch-exports/kds/design.html` | `src/pages/KDS.tsx` |
| Loyalty | `stitch-exports/loyalty/design.html` | `src/pages/loyalty.tsx` |
| Account | `stitch-exports/account/design.html` | `src/pages/account/index.tsx` |
| About Us | `stitch-exports/about/design.html` | `src/pages/AboutUs.tsx` |
| Reviews | `stitch-exports/reviews/design.html` | `src/pages/ReviewsPage.tsx` |
| Events | `stitch-exports/events/design.html` | `src/pages/events.tsx` |
| Referral | `stitch-exports/referral/design.html` | `src/pages/referral.tsx` |
| Admin Login | `stitch-exports/admin-login/design.html` | `src/pages/admin/Login.tsx` |
| Admin Orders | `stitch-exports/admin-orders/design.html` | `src/pages/admin/ManageOrders.tsx` |
| Admin POS | `stitch-exports/admin-pos/design.html` | `src/pages/admin/POS.tsx` |
| Order Success | `stitch-exports/order-success/design.html` | `src/pages/order-success.tsx` |

## Key Constraint

Each replacement must keep the same API contracts and state management hooks — only the VISUAL layer changes.
