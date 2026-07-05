---
phase: 1
title: "Token Migration Audit"
status: completed
priority: P1
dependencies: []
---

# Phase 1: Token Migration Audit (st- to aura-)

## Overview

Audit and fix the token system inconsistency across 26 Stitch components. The codebase has 914 `--st-*` references (Stitch SDK Material Design 3 tokens) vs 330 `--aura-*` references (AURA brand tokens). Components built with `--st-*` tokens look correct in Stitch's MD3 color system but inconsistent with AURA's brand palette.

## Requirements

- Map each `--st-*` token to its `--aura-*` equivalent (see mapping below)
- Apply mapping to all 26 Stitch New components
- Verify visual output is correct (no color breaking changes)
- 0 TypeScript errors, all 1,091 tests pass

## Token Mapping

Based on the actual values in `brand-tokens.css` and DESIGN.md:

| Stitch MD3 Token | AURA Brand Token | Visual Effect |
|---|---|---|
| `--st-primary` | `--aura-noir-void` (#050D1A) | Deep navy background |
| `--st-on-primary` | `--aura-chrome-bright` (#E8E8E8) | Text on dark backgrounds |
| `--st-primary-container` | `--aura-surface-container` (#0B203A) | Card/surface background |
| `--st-on-primary-container` | `--aura-chrome-soft` (#A0A0A0) | Subtle text on surfaces |
| `--st-secondary` | `--aura-chrome-bright` (#E8E8E8) | Navigation, borders |
| `--st-on-secondary` | `--aura-noir-deep` (#0A0A0A) | Text on chrome backgrounds |
| `--st-secondary-container` | `--aura-surface-dim` (#00204A) | Sidebar, header backgrounds |
| `--st-on-secondary-container` | `--aura-chrome-light` (#C0C0C0) | Muted text |
| `--st-tertiary` | `--aura-bronze-shimmer` (#D4A574) | CTAs, badges, highlights |
| `--st-on-tertiary` | `--aura-noir-deep` (#0A0A0A) | Text on bronze backgrounds |
| `--st-tertiary-container` | `--aura-bronze-subtle` (#291500) | Bronze tinted surfaces |
| `--st-on-tertiary-container` | `--aura-bronze-shimmer` (#D4A574) | Text in bronze containers |
| `--st-error` | `--aura-error` (#FFB4AB) | Error state |
| `--st-surface` | `--aura-surface-dim` (#00204A) | Main background |
| `--st-on-surface` | `--aura-chrome-bright` (#E8E8E8) | Primary text |
| `--st-surface-variant` | `--aura-surface-container` (#0B203A) | Alternative surfaces |
| `--st-on-surface-variant` | `--aura-chrome-soft` (#A0A0A0) | Secondary text |
| `--st-outline` | `--aura-chrome-dim` (#44474D) | Borders, dividers |
| `--st-outline-variant` | `--aura-chrome-dim` (#44474D) | Subtle borders |

## Components to Audit (26)

| Component | st- count | aura- count | Status |
|---|---|---|---|
| StitchAccountDashNew | 43 | 1 | Needs full migration |
| StitchAdminLoginNew | 16 | 1 | Needs migration |
| StitchCheckoutNew | 42 | 0 | Full migration needed |
| StitchContainerNew1 | 64 | 1 | Heavy migration needed |
| StitchContainerNew2 | 59 | 1 | Heavy migration needed |
| StitchEventsNew1 | 105 | 0 | Full migration needed |
| StitchEventsNew2 | 2 | 42 | Mostly done, fix 2 |
| StitchFooter | 29 | 0 | Full migration needed |
| StitchHeroNew | 35 | 0 | Full migration needed |
| StitchKDSNew | 46 | 0 | Full migration needed |
| StitchLandingNew | 92 | 0 | Full migration needed |
| StitchLoyaltyNew | 123 | 2 | Heaviest migration |
| StitchMenuNew | 30 | 4 | Partial migration |
| StitchOrderSuccessNew | 49 | 0 | Full migration needed |
| StitchReferralNew1 | 63 | 0 | Full migration needed |
| StitchReviewsNew | 50 | 0 | Full migration needed |
| StitchStoryNew | 69 | 2 | Heavy migration needed |
| StitchAbout | 0 | 79 | Already migrated |
| StitchAccountNew | 0 | 23 | Already migrated |
| StitchAdminTerminalNew | 0 | 14 | Already migrated |
| StitchMenu2New | 0 | 7 | Already migrated |
| StitchMobileOrderNew | 0 | 24 | Already migrated |
| StitchOrderMgmtNew | 0 | 53 | Already migrated |
| StitchPOSNew | 0 | 35 | Already migrated |
| StitchReferralNew2 | 0 | 46 | Already migrated |

## Execution

### Step 1: Verify mapping accuracy (30 min)
- For each `--st-*` token, verify the mapped `--aura-*` token produces visually similar output
- Open a Stitch component with st- tokens, swap one mapping, check visual diff
- Document any adjustments needed to the mapping table above

### Step 2: Bulk migrate high-count components (2h)
- Use sed or grep-replace on components with 30+ st- instances:
  - StitchLoyaltyNew (123), StitchEventsNew1 (105), StitchLandingNew (92), StitchStoryNew (69), StitchContainerNew1 (64), StitchReferralNew1 (63), StitchContainerNew2 (59), StitchReviewsNew (50), StitchOrderSuccessNew (49), StitchKDSNew (46), StitchAccountDashNew (43), StitchCheckoutNew (42), StitchHeroNew (35), StitchMenuNew (30)

### Step 3: Visual verification (1h)
- Run `npm run dev`
- Open each migrated component in browser
- Verify: text is readable, CTAs are bronze, backgrounds are dark navy/chrome
- Fix any visually broken components

### Step 4: Quality check (30 min)
- `npm run build` - 0 TypeScript errors
- `npm test` - all 1,091+ tests passing

## Related Code Files

- Modify: `src/components/stitch/*.tsx` (26 files, token replacement)
- Read: `src/styles/brand-tokens.css` (source of truth for aura- values)
- Read: `DESIGN.md` (design token documentation)

## Success Criteria

- [ ] All 914 `--st-*` references replaced with `--aura-*` equivalents
- [ ] No visual regression (text readable, CTAs bronze, backgrounds dark navy)
- [ ] `npm run build` - 0 TypeScript errors
- [ ] `npm test` - 1,091 tests passing
- [ ] 7 components already migrated (st- count = 0) left untouched

## Risk Assessment

- Aggressive bulk replace could break visual if token semantics don't match 1:1
- Mitigation: test one component before bulk, verify mapping visually first
- Some `--st-*` tokens have no exact `--aura-*` equivalent - leave those as `--st-*` with a comment
- Stitch SDK components may re-inject `--st-*` on re-render - this is expected (SDK behavior)
