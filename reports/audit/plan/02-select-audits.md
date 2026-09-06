# Audit Plan — Select Audits (Stage 2/3)

**Goal:** Select high-ROI audits to bridge FnB-Container-Caffe to rustic Sa Đéc container café standard (mộc mạc, not overly luxurious/modern).
**Method:** `select-audits --budget-constrained` (recipe: audit-plan DAG group 2)
**Input:** 01-risk-rank.md (R1–R6 ranked areas + subagent inventories)

## Selected Audits (Scope & Deliverables)

| Audit ID | Area | Specific target | Proposed action | ROI / Priority |
|---|---|---|---|---|
| **A1** | Font hardcode cleanup | 46 stitch files with `EB Garamond` inline `fontFamily` | Replace inline font-family with `var(--aura-font-display)` or remove inline style (inherit from tokens). Update `TypographyShowcase.tsx` + `typography-showcase.test.tsx` to showcase Quicksand / Be Vietnam Pro. | **High** — solves #1 visual gap (R1, score 9.0) across 46 files; keeps 389/389 stitch tests green |
| **A2** | Locale copy rusticization | `luxuryTax` keys (vi.json:276, en.json:276+447, `checkout.luxuryTax` en.json:1790), `landing.pageAriaLabel` "sang trọng", heroTaglines, `containerNew2.heroTag` "Cao Cấp", `feature1Desc` "xa xỉ hiện đại" | Replace with rustic tone: "Thuế cao cấp (5%)" → "Phí dịch vụ (5%)", "Luxury Tax (5%)" → "Service Fee (5%)". Update fallback strings (`StitchCheckoutNew-order-summary.tsx` `?? t('stitch.tax', 'Luxury Tax (5%)')`), `index.html:6` meta "industrial-luxury" → rustic wording, `hero-section.tsx` + `hero-section.test.tsx` / `StitchCheckoutNew.test.tsx` assertions. | **High** — solves customer-facing tone contradiction (R2, score 7.5); fixes 3 test files pinning luxury strings (R4) |
| **A3** | Extreme glass/blur reduction | 279 blur usages, ~95% exceed 8px token (24px×44, 12px×40, 20px×29, max 100px) | Clamp blur > 16px → max 8px per brand tokens v6 (`--aura-glass-blur`). Target worst offenders first: StitchAccountNew / StitchStoryNew-footer / checkin-new (100px), referral-rewards-1 (80px), skeleton components (StitchReferralNew2-skeleton, StitchAccountNew-skeleton), loyalty/rewards cluster. | **Medium** — reduces luxury "glass" aesthetic (R3, score 7.0) + improves mobile/GPU render perf |
| **A4** | Hardcoded hex & gradient tokenization | 431 hardcoded hex (368 components + 63 pages), gradient hotspots (StitchAdminLoginNew-styles ×5, StitchMenuNew-styles ×4), 51 shadows | Remap to semantic tokens: `#050D1A`→`var(--aura-bg-page)`, `#4A7C59`→`var(--aura-primary)`, `#C9D6DF`→`var(--aura-border-chrome)` etc. Splits via workstream by file ownership. | **Medium** — single source of truth for rustic palette; enables future theme shifts (R3-adjacent) |

## Deselected (Budget-Conscious Exclusions)

| Excluded item | Rationale |
|---|---|
| Route rename `/stitch/luxury-landing` etc. | Internal preview paths only; out of scope per rebrand plan P2 decision; high link-breakage risk, zero customer ROI |
| Deleting 5 luxury stitch preview pages | Harmless preview routes consumed by screen-showcase; deletion breaks gallery links + tests |
| Wood/kraft/terracotta texture asset pipeline | No existing assets to remap; copy + tokens + colors convey "Container Bản Địa" sufficiently without binary asset changes |
| Duplicate stitch↔public route pairs (21) | R5 score 4.0 — bycatch; deferred to route-consolidation epic, not rustic refactor |
| SEO meta overhaul beyond index.html:6 | Only one meta string contains "industrial-luxury"; fix folded into A2 |

## Budget Constraint Assessment

- Selected: **4 audits** (A1–A4), est. ~3 credits / ~1–2 focused hours, matching recipe estimate.
- Execution order: **A1 (Fonts) → A2 (Copy/Meta/Tests) → A3 (Blur clamp) → A4 (Hex tokenization)**.
- A1+A2 are the critical path (customer-visible rustic tone); A3+A4 are polish passes.
- All 4 audits keep the 3115-test suite green by updating the 3 pinned test files in A1/A2.
