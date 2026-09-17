# Plan — AURA F&B OS Rebuild: Phase 0 Discovery (Spec §31)

Master spec: `AURA_FnB_OS_Rebuild_Master_Spec.md` — mode: standard

## Status: COMPLETE (all artifacts written, no code modified)

## Deliverables (10/10)
| # | Artifact | Path |
|---|---|---|
| 1 | Current architecture | docs/architecture/CURRENT_STATE.md |
| 2 | Target architecture | docs/architecture/TARGET_STATE.md |
| 3 | Domain map | docs/architecture/DOMAIN_MAP.md |
| 4 | App map | docs/architecture/APP_MAP.md |
| 5 | Repo migration plan | docs/architecture/REPO_MIGRATION.md |
| 6 | Feature matrix | docs/product/FEATURE_MATRIX.md |
| 7 | Customer journey | docs/product/CUSTOMER_JOURNEY.md |
| 8 | Product context | .ai/context/product.md |
| 9 | Architecture context | .ai/context/architecture.md |
| 10 | Glossary vi-en | .ai/context/glossary.vi-en.yaml |

## Phases (next)
- Phase 1 — Product Truth: personas, journey ratification, feature hierarchy, glossary ratification (no code)
- Phase 2 — Foundation: monorepo scaffold, ui/i18n/auth/db/api packages, Catalog exemplar (M1)
- Phase 3–6 per REPO_MIGRATION.md §2

## Evidence basis
Repo audit 2026-09-11: 85 FE routes, 91 BE route files, 18 domain trees, 31 D1 tables, 4800 tests, 10 ADRs, vi/en 1833 keys each, deployed FE 5b9e8842 / BE 92f52c22.

## Open decisions for user
1. Ratify target repo shape (monorepo in this repo vs fresh `aura/` root)
2. SaaS/multi-tenancy: commit or keep incubating
3. Glossary term choices needing business confirmation (referral wording, tier names, check-in loanword)
4. Which duplicated surface variants survive (recommend: shipped StitchTrackOrderNew for track-order)
