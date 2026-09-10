# Plan — AURA CAFE FE-First Architecture Merge

**Date:** 2026-09-10
**Scope:** FE + BE touchpoints (API contracts only; no Worker business logic)
**Input docs merged:** `implementation_plan.md` (business pivot — the WHY) · `frontend_architecture_blueprint.md` (target state — scaled down) · `task.md` (backbone, reordered FE-first) · `plans/260910-go-live-master-phases/plan.md` (operational checkpoints)

---

## Executive Summary

Ship go-live features first (Wave A), migrate to feature-sliced structure incrementally while touching each feature (Wave B), defer monorepo split (Wave C — deferred by user decision 2026-09-10). No big-bang restructure. The existing flat `src/pages` + `src/components` + `src/hooks/stores` (16 zustand stores) stays until each feature's migration turn comes.

## Current State (verified by scout)

- Flat Type-based: `src/components/` + `src/pages/` (86 lazy chunks across 4 route files) + `src/hooks/` + `src/lib/`
- 16 zustand stores in `src/hooks/stores/` — cart already centralized
- EXISTS: TrackOrder (routed), delivery/takeaway/dine-in components (`src/components/order/`), SW registered (`public/sw.js`), loyalty pages, KDS, i18n vi/en
- MISSING: `src/features/`, `packages/ui`, Edge SSR, Grand Opening deprecation, loyalty 4-tier FE wiring, wallet checkout option

## Waves & Phases

| Wave | Phase | Focus | Status |
|------|-------|-------|--------|
| A | 0 | Deprecate Grand Opening (AURA20/AURA10 is_active=0, kill banner/countdown) | ✅ |
| A | 1 | Loyalty 4-tier FE wiring (Đồng 1.0x/3% → Bạch Kim 1.5x/10%) + phone→profile auto-create | ✅ |
| A | 2 | Delivery/Takeaway/Dine-in checkout completion | ⚪ |
| A | 3 | `/track-order` real-time + Telegram bar notification | ⚪ |
| A | 4 | Aura Wallet payment option at checkout | ⚪ |
| A | 5 | PWA polish (SW exists; verify offline fallback + install prompt) | ⚪ |
| B | 6 | Feature-slice `ordering` → `src/features/ordering/` (first feature, template for the rest) | ⚪ |
| B | 7 | Feature-slice `loyalty-cashback` → `src/features/loyalty-cashback/` | ⚪ |
| B | 8 | Feature-slice `kds-kitchen` → `src/features/kds-kitchen/` | ⚪ |
| B | 9 | Feature-slice `admin-sales` → `src/features/admin-sales/` | ⚪ |

Wave C (monorepo `apps/` + `packages/ui` + Edge SSR): **DEFERRED** — revisit when staff POS/KDS run on a genuinely separate surface. See `phase-deferred-monorepo.md`.

## Phase Files

- [phase-00-deprecate-grand-opening.md](./phase-00-deprecate-grand-opening.md)
- [phase-01-loyalty-4tier-fe.md](./phase-01-loyalty-4tier-fe.md)
- files for phases 02–09 pending approval of this overview

## Dependencies

- Phase 0 → Phase 1 (banner removal clears loyalty UX surface)
- Phase 1 → Phase 4 (wallet needs loyalty profile)
- Phase 2 → Phase 3 (track-order needs delivery state machine wired)
- Phases 6–9 independent of A; each feature-slice lands with the next feature touching it
- Operational gates from `260910-go-live-master-phases` Phase 1 (secrets) + Phase 2 (PayOS live) layer on top of Wave A completion — consult those phase files at deploy time

## Success Criteria

1. 86 route chunks unchanged in public surface (no route changes without migration note)
2. All 3228+ tests pass at every phase boundary
3. Each feature-slice migration leaves zero dead imports from old location
4. `/api/version` shortSha matches HEAD after each deploy
5. BE touchpoints only: new/changed API contracts documented per phase
