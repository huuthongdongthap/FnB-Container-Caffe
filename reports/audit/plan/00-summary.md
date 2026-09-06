# Audit Plan Summary — Rustic Sa Đéc Refactor

**Goal:** Refactor FnB-Container-Caffe to the rustic (mộc mạc) Sa Đéc container café standard — modern but not "TÂY hoá", not overly luxurious.
**Recipe:** audit-plan (risk-rank → select-audits → allocate-resources) | Flags: `--auto --parallel`
**Date:** 2026-09-06

## Pipeline Results

| Stage | Report | Key output |
|---|---|---|
| 1. Risk Rank | [01-risk-rank.md](01-risk-rank.md) | R1–R6 ranked; R1 serif fonts (9.0), R2 luxury copy (7.5), R3 glass/blur (7.0) = critical path |
| 2. Select Audits | [02-select-audits.md](02-select-audits.md) | A1–A4 selected; route renames, page deletions, texture assets deselected |
| 3. Allocate Resources | [03-allocate-resources.md](03-allocate-resources.md) | 3-agent parallel Wave 1 + sequential Wave 2 + test-gated verification |

## The Gap (Baseline → Target)

| Dimension | Current state | Rustic target |
|---|---|---|
| Fonts | 46 stitch files hardcode `EB Garamond` inline (serif = luxury look); tokens v6 already define Quicksand/Be Vietnam Pro | All components inherit `var(--aura-font-display)` — no inline serif anywhere |
| Copy | `luxuryTax` = "Thuế cao cấp" / "Luxury Tax"; hero copy contains "industrial-luxury"; aria labels "sang trọng" | "Phí dịch vụ (5%)" / "Service Fee (5%)"; rustic wording; meta description de-luxurified |
| Visual effects | 279 blur usages, 95% exceed 8px token (max 100px); heavy glass gradients | Blur clamped ≤ 8px per `--aura-glass-blur`; tokenized colors |
| Tests | 3115 passing; 3 test files pin luxury strings/fonts | Same suite green with rustic assertions |

## Selected Audits → Execution Waves (--auto --parallel)

```
Wave 1 (parallel ×3):  A1/A3/A4 stitch components (one pass per file)
                      A2 locales
                      A2 hero + meta + pinned tests
Wave 2 (sequential):   TypographyShowcase + test (depends on Wave 1 fonts)
Wave 3 (gated):        Full vitest suite — 100% pass required
```

## Deselected (out of scope)

Route renames (`/stitch/luxury-landing`), deleting luxury preview pages, wood-texture asset pipeline, duplicate stitch↔public route consolidation (R5, score 4.0).

## Next Actions

1. Execute Wave 1 with 3 parallel implementation agents (file ownership per 03-allocate-resources.md).
2. Wave 2 showcase rebrand, then full-suite verification.
3. Defer R5 route consolidation to a follow-up epic if rustic pass completes under budget.
