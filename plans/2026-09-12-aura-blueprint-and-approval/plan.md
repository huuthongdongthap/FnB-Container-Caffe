---
date: 2026-09-12
version: 1.0
status: planning (Phase 1 Blueprint)
master: AURA_FnB_OS_Rebuild_Master_Spec.md
previous: plans/2026-09-11-aura-rebuild-discovery/
---
# Plan — AURA F&B OS: Discovery → Blueprint → Approval → Rebuild

User intent: **do NOT rebuild everything now.** Sequence the work so the
repository is understood (Discovery), the target is specified and bounded
(Blueprint), a human approves before any code moves (Approval), and only
then execute in small verified batches (Rebuild).

## Phase status

| Phase | Title | Status |
|---|---|---|
| **Discovery** | inventory existing repo (spec §31) | ✅ DONE — 10 artifacts in `docs/architecture/`, `docs/product/`, `.ai/context/` |
| **Blueprint** | specify target, boundaries, contracts, risks; get approval | 🔄 IN PROGRESS (this plan) |
| **Approval** | user signs off on Blueprint before any code change | ⏸ PENDING |
| **Rebuild** | migrate in small batches, each verified | ⏸ GATED until Approval |

## 1. Blueprint (Phase 1 — no code changes)

Produce a single, approval-ready `BLUEPRINT.md` plus supporting specs.
Nothing here modifies application code; it only documents intent and
bounds.

### 1.1 Artifact list

| # | Artifact | Path | Purpose |
|---|---|---|---|
| 1 | BLUEPRINT (approval front page) | `docs/architecture/BLUEPRINT.md` | decision-maker summary — what we rebuild, why, in what order, with what risks; explicit Approval section for sign-off |
| 2 | Target architecture spec | `.ai/specs/target-architecture.md` | apps/*, packages/*, domain package contract (spec §9), API law (§10), event model (§11) |
| 3 | Domain contracts | `.ai/specs/domain-contracts.md` | one bounded-context section per spec §6 context with model/commands/queries/policies/events and explicit tables-from-CURRENT_STATE mapping |
| 4 | Migration matrix | `.ai/specs/migration-matrix.md` | every current artifact → KEEP/MOVE/MERGE/REWRITE/ARCHIVE/DELETE + OLD/TARGET/STATUS/BEHAVIOR_PRESERVED/TEST/ROLLBACK (spec §26) |
| 5 | Risk register | `.ai/specs/risks.md` | live-URL deep links, D1 merges, i18n dedupe, stitch rule archaeology, worker bundle; mitigations with evidence refs |
| 6 | Approval checklist | `.ai/specs/approval-checklist.md` | explicit yes/no gates the user must answer before Rebuild can start |

### 1.2 Blueprint scope rules (from master spec)

- **Domain owns business truth** — rules never in React/handlers (spec §2).
- **API handlers thin** — VALIDATE → AUTHORIZE → USE CASE → MAP (§10).
- **DB persists** — D1 merges ship down-migration + rollback runbook (§12).
- **Integrations are adapters** — port per provider, no provider model leak (§21).
- **vi-VN canonical** — `.ai/context/glossary.vi-en.yaml` is the terminology source (§15).
- **DONE = verified** — spec acceptance + tests + i18n + security + observability + state update + obsolete removed (§27).
- **NEVER delete → rewrite → hope** (§26).
- AI copilots deferred until domain contracts stable (§25 Phase 6).

### 1.3 Rebuild sequence inside Blueprint (so the approval covers order)

```
Phase 2  Foundation     scaffold + packages/ui + i18n consolidation + auth + db merges + 1 API exemplar
Phase 3  Core F&B Loop  Catalog → Menu → Order → Payment → Kitchen → Customer
Phase 4  Operations     POS · KDS · Tables · Staff · Inventory · Reservation
Phase 5  Growth         CRM · Loyalty · Membership · Promotion · Campaign · Analytics (+ SaaS decision)
Phase 6  AI             copilots only after contracts stable
```

Each phase lists its first milestone (smallest safe change), its acceptance
criteria, and its rollback. The approval gates **the whole sequence**, not
individual phases — phases 2–6 then execute without further sign-off unless
a risk triggers.

## 2. Approval (Phase 1 → Rebuild gate)

Blueprint is complete when the user answers the approval checklist
(`.ai/specs/approval-checklist.md`) and signs off in `BLUEPRINT.md`.

### Required gates (all must be YES before any code change)

1. Target repo shape accepted (monorepo in this repo / fresh root).
2. D1 duplicate-table merge + rollback accepted.
3. Stitch-variant dedupe policy accepted (which survive, which archive).
4. Surface dedupe accepted (track-order/KDS/checkout ×3 — canonical pick).
5. i18n terminology ratification (referral wording, tier names, loanwords).
6. SaaS / multi-tenancy decision (commit in Phase 5 vs keep incubating).
7. AI-copilot deferral confirmed (Phase 6, after contracts stable).
8. Phase 2 first milestone (Catalog exemplar) accepted as the entry point.
9. Deployment continuity accepted (old bundle stays live until new surface passes acceptance per phase).
10. Risk mitigations accepted as sufficient to proceed.

If any gate is NO or DEFER, update the Blueprint and re-approve before
rebuild starts.

## 3. Rebuild (Phases 2–6 — gated)

Each phase executed in **smallest-safe-change batches** with:
- spec updated first
- implementation
- targeted tests + acceptance
- diff inspected
- `.ai/state/` updated
- report verification
- rollback path kept live

Phase execution details live in `phase-02-*.md ... phase-06-*.md`, written
during Blueprint and approved as a batch. No phase begins until its
predecessor's acceptance is green.

## 4. Open decisions (need your input — become approval gates 3,4,5,6 above)

1. **Repo shape**: monorepo in this repo (recommended — keeps history/tests) vs fresh `aura/` root?
2. **D1 merges**: ship `payments`→`payments_new` merge with down-migration + runbook?
3. **Stitch survivors**: which of the 41 variants survive into apps/space? (recommend: landing-quality variants; archive rest post-verify)
4. **Surface dedupe**: keep shipped `StitchTrackOrderNew` as canonical track-order (recommended); canonical KDS = `/kds`; canonical checkout = `/checkout`?
5. **Glossary**: "Giới thiệu bạn bè" for referral; tier names (Đồng/Bạc/Vàng/Kim cương?); keep "Check-in" loanword?
6. **SaaS**: commit to multi-tenancy in Phase 5 or keep incubating?
7. **AI copilots**: confirm Phase 6 deferral?

## Next step

Answer the 7 open decisions above → I write `BLUEPRINT.md` +
`.ai/specs/*` + approval checklist (no code touched) → you sign off →
Rebuild Phase 2 starts with Catalog exemplar.
