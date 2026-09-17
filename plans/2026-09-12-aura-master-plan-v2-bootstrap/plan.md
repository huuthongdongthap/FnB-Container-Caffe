---
date: 2026-09-12
version: 1.0
status: planning (bootstrap — reconcile two master specs, then Blueprint → Approval → Rebuild)
master: /Users/mac/Downloads/AURA_OS_Master_Plan_v2.md
previous: plans/2026-09-11-aura-rebuild-discovery/ + plans/2026-09-12-aura-blueprint-and-approval/
---
# Plan — Bootstrap around AURA_OS_Master_Plan_v2.md

User intent: **brainstorm first, bootstrap a new plan around
`/Users/mac/Downloads/AURA_OS_Master_Plan_v2.md`, then re-run /plan — do
not start re-architecting yet.**

## 1. Two master specs — reconcile before any code

We now have **two** authoritative documents. They overlap but emphasize
different things. The bootstrap's job is to merge them into one
decision-ready Blueprint.

| | `AURA_FnB_OS_Rebuild_Master_Spec.md` (repo root) | `AURA_OS_Master_Plan_v2.md` (Downloads) |
|---|---|---|
| **Lens** | architecture / repo rebuild | business strategy / operating model |
| **North star** | AURA F&B OS = product+domain+platform+experiences+AI+state+evals | AURA CAFE = Reference Café → Café Kit → AURA OS |
| **First product** | (implied: the platform) | **"The first product is NOT AURA OS. It is a self-running AURA CAFE."** |
| **Domains** | 20 bounded contexts (Identity…Analytics) | 15 Mini-ERP modules + CRM + channels |
| **Migration** | Phase 0 Discovery → 6 phases | M0 Legacy Discovery → M1 Core → M2 Independent → M3 Ops → M4 Customer/Online → M5 Growth → M6 Multi-location |
| **AI** | Phase 6 copilots (deferred) | not yet scoped |
| **Key law** | 20 architecture laws (domain owns truth, DONE=VERIFIED…) | ONE SOURCE OF TRUTH (POS/Excel/FB/staff/owner must agree) |
| **Legacy** | current repo = legacy knowledge | **Viva Star** = legacy business process to map, not future architecture |
| **Execution** | DISCOVER→CLASSIFY→SPECIFY→MIGRATE→TEST→EVAL→VERIFY | MAP→MIRROR→VERIFY→PARALLEL→SWITCH→STABILIZE→RETIRE |
| **Channels** | apps/{space,ops,hq} | In-store / Online / Delivery / Mobile Cart / Future partners |
| **Replication** | (not emphasized) | Reference Café → Cafe Kit → Nearby Café → Online → Cart → Multi-location → AURA OS |

### Reconciliation thesis (to be confirmed during Blueprint)

- **v2 is the business strategy; the repo-root spec is the architecture
  contract.** They are compatible if we treat v2's "Reference Café" as the
  first deployment of the repo-root spec's `apps/ops`+`apps/hq` surfaces.
- **M0 = Phase 0 Discovery** (already done for the *code*; NOT done for the
  *Viva Star business process* — that's the new gap).
- **M1 ≈ Phase 3 Core F&B Loop** (Catalog→Menu→Order→Payment→Kitchen→Customer).
- **M2 ≈ Phase 4 Operations** (POS, Table, KDS, Staff, Inventory, Reservation).
- **M3/M4/M5 ≈ Phase 5 Growth + online channel + cart.**
- **M6 multi-location = SaaS decision** (currently incubating in repo).
- **AI copilots** stay deferred (both specs agree implicitly).
- **Execution rule merge**: DISCOVER(current repo, already done) +
  MAP(Viva Star ops, new) → SPECIFY → IMPLEMENT → TEST → VERIFY →
  MIRROR/PARALLEL → SWITCH → STABILIZE → RETIRE legacy.

## 2. What's new / changed vs the previous plan

1. **Viva Star legacy is the actual migration source**, not just "the
   current repo". We must map it (M0 output: `CURRENT_OPERATION.md`,
   `VIVA_STAR_LEGACY_MAP.md`, `AURA_GAP_ANALYSIS.md`, `FEATURE_MATRIX.md`,
   `PROCESS_MAP.md`) before specifying architecture.
2. **Business model is multi-channel from day one** (in-store / online /
   delivery / cart) — but ONE source of truth. Channels are adapters, not
   separate business logic (matches repo-root spec §21 integration law).
3. **Replication path is explicit**: AURA CAFE → Reference → Kit → nearby
   café → online → cart → multi-location → AURA OS. Architecture must
   not generalize prematurely (v2 §22: "do NOT build AURA OS v1").
4. **Offline/resilience is a first-class requirement** (v2 §14), not
   mentioned in repo-root spec. Must enter domain contracts (graceful
   degradation for menu/order/payment/table).
5. **Migration is parallel-run, not cutover**: MAP→MIRROR→VERIFY→PARALLEL→SWITCH→STABILIZE→RETIRE (v2 §17).
6. **Phases renamed to M0–M6** (v2 language) but map onto repo-root
   Phase 0–6. Blueprint will use one consistent taxonomy.

## 3. Bootstrap deliverables (no code changes)

| # | Artifact | Path | Source |
|---|---|---|---|
| 1 | Spec reconciliation memo | `.ai/specs/spec-reconciliation.md` | both specs |
| 2 | Viva Star legacy map (M0) | `docs/product/CURRENT_OPERATION.md` + `VIVA_STAR_LEGACY_MAP.md` + `AURA_GAP_ANALYSIS.md` + `PROCESS_MAP.md` | v2 §13 M0 + §17 |
| 3 | Unified phase map | `.ai/specs/phase-map.md` | M0–M6 ↔ Phase 0–6 |
| 4 | BLUEPRINT v2 (approval front page) | `docs/architecture/BLUEPRINT.md` | merged |
| 5 | Domain contracts (with offline + channel notes) | `.ai/specs/domain-contracts.md` | v2 §5 ERP + §6 CRM + §8 golden loop + §9 channels + §14 resilience |
| 6 | Migration matrix | `.ai/specs/migration-matrix.md` | repo-root REPO_MIGRATION.md + v2 §17 parallel-run |
| 7 | Risk register (add offline, Viva Star parallel-run, channel divergence) | `.ai/specs/risks.md` | both |
| 8 | Approval checklist | `.ai/specs/approval-checklist.md` | merged gates |

## 4. Sequence (Discovery → Blueprint → Approval → Rebuild)

| Phase | Status |
|---|---|
| **Discovery** | ✅ repo audit done (10 Section-31 artifacts). ⏳ **Viva Star legacy map (M0) is the new gap** |
| **Blueprint** | 🔄 bootstrap plan (this) → spec reconciliation → M0 legacy docs → BLUEPRINT v2 |
| **Approval** | ⏸ user signs off |
| **Rebuild** | ⏸ M1 Core (Catalog→Menu→Order→Payment→Kitchen→Customer) is the first build — makes AURA CAFE order-complete without Viva Star |

## 5. Open decisions (need your input → become approval gates)

1. **Spec authority** — v2 is business strategy, repo-root is architecture contract? (recommended: yes, merge as above)
2. **Viva Star mapping** — do you have docs/interviews on the current Viva Star operation, or does Claude discover via stakeholder questions? (feeds M0)
3. **Channel scope for M1** — in-store only, or in-store + online from day one? (v2 says multi-channel with one core; M1 acceptance = "order completes without old system")
4. **Offline requirement depth** — full offline POS (v2 §14) or graceful degradation for menu/browse first?
5. **Multi-tenancy / SaaS** — keep incubating until M6 (recommended per v2 "do not generalize prematurely")?
6. **AI copilots** — confirm deferral until after M3 operations stable?
7. **Repo shape** — monorepo in this repo (recommended) vs fresh root?
8. **D1 duplicate-table merges** — proceed with down-migrations + rollback runbooks?
9. **Stitch/surface dedupe** — canonical picks (track-order = StitchTrackOrderNew, KDS = /kds, checkout = /checkout)?
10. **Glossary** — referral wording, tier names, loanwords?

## Next step

Answer the 10 open decisions → I write spec reconciliation + M0 legacy
docs + BLUEPRINT v2 + domain contracts + migration matrix + risks +
approval checklist (**zero code changes**) → you sign off → Rebuild M1
starts with Catalog→Menu→Order→Payment→Kitchen→Customer so AURA CAFE can
order-complete without Viva Star.
