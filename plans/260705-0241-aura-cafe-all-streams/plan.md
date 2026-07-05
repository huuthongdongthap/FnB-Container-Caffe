---
title: "AURA CAFE Next Phase — Token Audit, CLI Completion, Quality Fixes, First Client"
description: "Token migration audit (st- to aura-), complete existing aura-deploy CLI, fix quality gates, land first paying client"
status: completed
phases_completed: 4.5 of 5 (Phase 5: deployed to production + dogfood tested; client prospecting remains)
priority: P1
branch: "main"
tags: [token-migration, productization, cli, quality, deploy]
blockedBy: []
blocks: []
created: "2026-07-05T03:00:00.000Z"
createdBy: "ck-plan"
source: brainstorm
brainstorm: "plans/reports/brainstorm-next-phase-260705-0241-aura-cafe-all-streams-report.md"
red_team: "Verified: all 28 pages exist as full React implementations. Plan restructured from scratch."
archived_plans:
  - "plans/260703-1423-stitch-react-conversion (superseded)"
  - "plans/260704-1829-next-pages (superseded)"
  - "plans/260704-1849-production-hardening (superseded)"
  - "plans/260703-2104-productization (superseded)"
---

# AURA CAFE Next Phase — Restructured After Red Team

**WARNING — RED TEAM REVELATION:** The original plan was wrong. All 28 pages already exist as full React implementations. The aura-deploy CLI already exists at `setup/aura-deploy/`. This is the corrected version.

## Actual Codebase State (Verified 2026-07-05)

| Metric | Plan Claimed | Actual |
|--------|-------------|--------|
| Unit tests | 309 | 1,091 (106 test files) |
| E2E tests | 129+ | 48 (4 spec files) |
| Customer pages | "need Stitch" | 10 full implementations exist |
| Admin pages | "need Stitch" | 23 full implementations exist |
| aura-deploy CLI | "needs building" | Exists at `setup/aura-deploy/` (Commander, init wizard, template engine) |
| Stores for admin | Many exist | Only 10 exist; 10+ referenced don't |
| Stitch MCP | "use generate_screen_from_text" | No MCP tool configured |
| Token usage | --aura-* only | 914 --st-* instances + 330 --aura-* |
| Logger utility | Assumed | Does not exist |
| Playwright config | OK | Dead `NEXT_PUBLIC_MOCK_AI_SERVICES` copy-paste |

## Restructured Phases

| Phase | Name | Status | Depends On |
|-------|------|--------|------------|
| 0 | Red Team Findings Applied | DONE | — |
| 1 | [Token Migration Audit](./phase-01-token-migration-audit.md) | Completed | — |
| 2 | [Complete aura-deploy CLI](./phase-02-complete-aura-deploy-cli.md) | Completed | — |
| 3 | [Quality Gates + Infrastructure Fixes](./phase-03-quality-gates-infra.md) | Completed | — |
| 4 | [HelmetHead + i18n Gaps](./phase-04-helmethead-i18n-gaps.md) | Completed | — |
| 5 | [Deploy + First Client](./phase-05-deploy-first-client.md) | Pending | Phase 1, 2, 3, 4 |

## Resource Estimates (Revised)

| Phase | Est. Hours | Description |
|-------|-----------|-------------|
| 1: Token Migration | 6h | Map st- to aura- tokens, fix 26 components, verify visual |
| 2: aura-deploy CLI | 2h | Audit existing, add deploy + verify commands |
| 3: Quality Gates | 2h | Fix Playwright config, add rollback, update thresholds, logger |
| 4: HelmetHead + i18n | 2h | 8 missing HelmetHead pages, i18n audit |
| 5: Deploy + Client | 5h | Deploy to production, prospect + land first client |
| **Total** | **~17h** | Down from 32h |

## Quality Gates

- `npm run build` — 0 TypeScript errors
- `npm test` — all 1,091 tests passing (verified count)
- `npx playwright test` — all 48 E2E tests passing (verified count)
- No console.log in production code (create logger utility first)
- i18n populated for all UI (en + vi)
- ARIA + keyboard accessibility on interactive elements
- `--st-*` to `--aura-*` token mapping documented and applied
- Production rollback procedure documented (CF Pages instant rollback API)

## Design Constraints

- **Token mapping:** `--st-primary` to `--aura-noir-void`, `--st-secondary` to `--aura-chrome-bright`, `--st-tertiary` to `--aura-bronze-shimmer`
- **Fonts:** Space Grotesk (body) + EB Garamond (display), via Google Fonts CDN
- **i18n:** bilingual VN+EN via `src/locales/en.json` + `src/locales/vi.json`
- **Responsive:** mobile-first, touch targets >= 44px
- **Framework:** Vite + React 19 + TypeScript + Tailwind v4

## Red Team Review

### Session - 2026-07-05
**Findings:** 12 accepted (8 Critical, 4 High)
**Severity breakdown:** 8 Critical, 4 High

| # | Finding | Severity | Disposition | Action Taken |
|---|---------|----------|-------------|-------------|
| 1 | 28 pages already exist — plan building from scratch | Critical | Accept | Phase 1, 2 deleted. Replaced with token audit |
| 2 | Productization CLI already exists | Critical | Accept | Phase 2 re-scoped to audit existing CLI |
| 3 | Test counts 3.5x off (1091 vs 309, 48 vs 129+) | Critical | Accept | All thresholds updated to verified counts |
| 4 | No Stitch MCP configured | Critical | Accept | Stitch generation scope removed |
| 5 | Token mismatch: 914 st- vs 330 aura- | Critical | Accept | New Phase 1: Token migration audit |
| 6 | 10+ stores referenced don't exist | Critical | Accept | Store wiring tables removed from plan |
| 7 | "Add 28 routes" already done | Critical | Accept | Route registration scope removed |
| 8 | Product doctrine: CF account requirement | Critical | Accept | Phase 5: add managed deployment |
| 9 | commander not in root project | High | Accept | Use existing setup/aura-deploy package.json |
| 10 | No logger utility exists | High | Accept | Phase 3: create light logger utility |
| 11 | Rollback plan dangerous | High | Accept | Phase 3: add CF Pages rollback API |
| 12 | Multi-tenancy not scoped | High | Accept | Phase 5: document deployment model first |

## Open Questions

- Token migration: manual per-component verification or automated bulk replace?
- aura-deploy CLI: npm publish or local script?
- First client: which cafe in Sa Dec to target first?

