# Deferred — Monorepo Split + Edge SSR (Wave C)

**Decision (user, 2026-09-10):** Defer entirely. Revisit trigger below.

## What was deferred (from `frontend_architecture_blueprint.md`)

- `apps/customer-web` + `apps/staff-pos-kds` + `apps/admin-portal` split
- `packages/ui` shared component library
- Edge SSR cache for menu pages

## Why deferred

- Single SPA serves all 3 surfaces fine at current scale (86 lazy chunks already code-split per route)
- POS/KDS/admin all accessed via same domain today; no separate deployment surface exists
- 16 zustand stores + shared auth — a split would require extracting cross-app state first (high cost, no current benefit)

## Revisit trigger

Any ONE of:
1. Staff KDS/POS moves to dedicated tablet hardware with offline-first requirements
2. Admin portal needs separate deploy cadence (e.g. different release risk tolerance)
3. Menu page LCP exceeds 2.5s on 3G (then Edge SSR for menu only, not full monorepo)
4. A second frontend client (Zalo Mini App, native shell) is greenlit

## Cost of deferral

- None today. When triggered, feature-sliced structure from Wave B makes the split mechanical (features move wholesale into apps/).
