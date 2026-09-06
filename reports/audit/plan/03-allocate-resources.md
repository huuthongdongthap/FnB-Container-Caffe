# Audit Plan — Allocate Resources (Stage 3/3)

**Goal:** Allocate team capacity across selected audits A1–A4 with `--auto --parallel` execution.
**Method:** `allocate-resources --team-capacity` (recipe: audit-plan DAG group 3)

## Capacity Model

Team = subagent fleet (Explore/general-purpose + implementation agents). Constraint: file ownership must be disjoint for parallel agents; shared files run sequentially.

## Parallelization Matrix

| Workstream | Files owned | Runs parallel? | Rationale |
|---|---|---|---|
| **WS1 — A1 Fonts, stitch components** | 46 stitch files w/ inline `EB Garamond` | ✅ Yes | Disjoint from locales/tests |
| **WS1b — A1 Fonts, showcase + test** | `TypographyShowcase.tsx`, `typography-showcase.test.tsx` | ⚠️ After WS1 | Shares FONTS_DATA constant with showcase test |
| **WS2 — A2 Copy: locales** | `src/locales/vi.json`, `en.json` | ✅ Yes | Disjoint from WS1 files |
| **WS2b — A2 Copy: hero + meta** | `hero-section.tsx`, `hero-section.test.tsx`, `index.html` | ✅ Yes | Disjoint from both above |
| **WS3 — A3 Blur clamp** | stitch components w/ blur > 8px (overlaps WS1 files) | ❌ Sequential after WS1 | Same stitch files as WS1 — merging into one agent pass avoids edit conflicts |
| **WS4 — A4 Hex tokenization** | 431 hex sites (overlaps WS1/WS3) | ❌ Sequential after WS3 | Same component files |

**Merged parallel plan (--auto --parallel):**

```
Wave 1 (parallel, 3 agents):
  Agent 1: WS1+WS3+WS4 stitch components  [fonts + blur + hex in ONE pass per file]
           → all 46 serif files + skeleton/loyalty blur offenders
  Agent 2: WS2 locales                    [vi.json + en.json luxury keys]
  Agent 3: WS2b hero + meta + tests       [hero-section.tsx(+test), index.html, StitchCheckoutNew.test.tsx]

Wave 2 (sequential, 1 agent):
  Agent 4: WS1b TypographyShowcase + test  [FONTS_DATA → Quicksand/Be Vietnam Pro]

Wave 3 (verification, sequential):
  Tester: npx vitest run src --reporter=basic  → 3115 tests must stay green
```

## Per-Agent Load

| Agent | Scope | Est. effort | Files |
|---|---|---|---|
| Agent 1 | Font inline removal + blur clamp + hex→token in stitch components | Largest — ~46 files | stitch/* components |
| Agent 2 | Luxury copy → rustic tone in locale files | Small — 2 files | vi.json, en.json |
| Agent 3 | Hero copy + SEO meta + 2 test files + 1 fallback string | Small — 5 files | hero, index.html, tests, StitchCheckoutNew-order-summary |
| Agent 4 | Typography showcase rebrand | Tiny — 2 files | TypographyShowcase.tsx, typography-showcase.test.tsx |
| Tester | Full suite verification | Medium | none (read-only) |

## Constraints & Handoff

- **Test gate:** every wave must end with `npx vitest run src --reporter=basic` 100% pass before next wave (per --auto mode artifact validation).
- **2 STRIKES & MAX:** each agent stops after 2 failed local fix attempts and escalates.
- **Sequential constraint:** Wave 2 depends on Wave 1 Agent 1 completing font removal (showcase test asserts font names).
- **No full-file rewrites:** all agents use Edit-chunk operations (locales JSON, large stitch components).
- **File ownership:** Agent 1 owns all stitch component files; Agent 2 owns locales exclusively; Agent 3 owns hero/index.html/test files exclusively. Zero overlap.
