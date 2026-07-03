# Brainstorm: Next Phase — 3 Parallel Streams

**Date:** 2026-07-03T10:28
**Status:** Approved → Handoff to /ck:plan
**Flags:** --deep --parallel

---

## Context (What Was Done Today)

- ✅ Full Stitch pipeline: 4 screens generated + React components
- ✅ Stitch design tokens → `stitch-tokens.css` + dark `@theme` fix
- ✅ Cook: Auto-Cashback task-5.5 + WS notifications task-5.6
- ✅ 4 audit reports (UX: **5/10**, Styling, Frontend, Stitch)
- ✅ Global.css @theme light→dark migration (PARTIAL — components still diverge)
- ✅ `StitchAdminDashboardV2.tsx` + `StitchMobileOrderingV2.tsx`

## The Problem

The app is feature-complete (30+ features, 1,063 tests) but UX consistency is **fragmented**:

| Domain | Score | Key Gap |
|--------|-------|---------|
| Color | 5/10 | Components still use light tokens |
| Typography | 3/10 | 3 font families fighting |
| Layout | 7/10 | Minor |
| A11y | 6/10 | Touch targets, contrast |
| UX | 4/10 | Emoji-over-SVG, inconsistent cards |

Pending P1 feature: **Real Analytics Dashboard** (plan written, 4h TDD).

## Proposed Solution — 3 Parallel Streams

### Stream A: Analytics Dashboard (BE + FE) — ~4h
**Owner:** Backend + Frontend | **Mode:** TDD
- Phase 1: Backend top-products + peak-hours endpoints
- Phase 2: Backend customer metrics + CSV export
- Phase 3: Frontend real data hooks + RevenueChart
- Phase 4: Frontend TopProductsChart + PeakHoursChart
- Phase 5: Frontend CustomerMetrics + Export + Dashboard integration
- **Files:** `worker/src/routes/analytics*`, `src/pages/admin/Dashboard.tsx`, `src/hooks/`, `src/components/admin/`
- **Key constraint:** 0 regression, TDD on BE phases

### Stream B: UI/UX Fix Sprint — ~3h
**Owner:** Frontend | **Source:** UI/UX Pro Max skill at `/Users/macbook/ui-ux-pro-max-skill`
- Fix 1: `Card.tsx` — replace `bg-white/80` with glassmorphism dark tokens
- Fix 2: `Input.tsx` — replace `bg-white` with `var(--aura-bg-input)`
- Fix 3: `Drawer.tsx` — dark background
- Fix 4: ~30 emoji→SVG migrations (use Lucide icons)
- Fix 5: Font unification (Cormorant Garamond + Space Grotesk only)
- Fix 6: Glass card unification (single `.glass-panel` class via DESIGN.md spec)
- Fix 7: Touch target audit (48px minimum)
- Fix 8: Focus ring consistency
- **Files:** `src/components/ui/*`, `src/pages/*` (excl. admin), `src/styles/`
- **Reference:** UI/UX Pro Max skill patterns for style/color/font selection

### Stream C: Image Optimization — ~2h
**Owner:** Assets | **Source:** Existing plan
- Phase 1: Install sharp → batch conversion script
- Phase 2: Convert 47MB PNGs → WebP, update refs
- Phase 3: Lazy loading + `<picture>` fallback
- **Files:** `images/`, `scripts/`, `src/lib/`

### Conflict Matrix
| Stream A touches | Stream B touches | Stream C touches |
|---|---|---|
| `src/pages/admin/` | `src/components/ui/` | `images/` |
| `worker/src/routes/` | `src/pages/*` (excl admin) | `scripts/` |
| `src/hooks/` | `src/styles/` | `public/` |

**No file overlap** between streams. Stream A and Stream B meet at `src/pages/admin/` only — Stream B stays out of admin.

## Acceptance Criteria

1. Analytics Dashboard: real D1 data renders in all 5 chart widgets, CSV export works
2. UI/UX score: 5/10 → 8/10 (verified by re-audit)
3. Image size: 47MB → <10MB, all pages use WebP + lazy loading
4. `npm run build` = 0 errors
5. `npm test` = all 1,063+ tests pass (0 regression)
6. No emoji in production UI (Lucide only)
7. Touch targets ≥ 48px on all interactive elements

## Risks

| Risk | Mitigation |
|------|-----------|
| CSS regression from @theme change | All tokens reference CSS vars, no hardcoded values |
| Emoji→SVG misses some instances | Run grep for emoji unicode ranges post-migration |
| Analytics BE perf on D1 | Batch queries, use KV for cache |
| Stream B touches Stream A's files | B explicitly excludes `admin/` directory |

## Next Step

→ Handoff to `/ck:plan` with this report as source context.
