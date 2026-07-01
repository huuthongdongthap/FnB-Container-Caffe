---
title: "X100 Design Polish + E2E Green — TDD"
description: "Fix verified design audit issues + E2E failures. CSS architecture → HTML accessibility → JS performance → E2E → Verify. TDD: tests first per phase. Red-team verified baselines."
status: completed
priority: P2
branch: "main"
tags: [design, css, accessibility, e2e, polish, tdd]
blockedBy: []
blocks: []
created: "2026-07-01T10:21:36.864Z"
createdBy: "ck:plan"
source: skill
sourceReport: "plans/reports/brainstorm-260701-1655-x100-design-polish.md"
---

# X100 Design Polish + E2E Green — TDD

## Overview

Fix verified design audit issues and E2E failures. Sequential phases: CSS first (shared foundation), HTML second (uses CSS classes), JS third (audit/cleanup), E2E fourth, verify last.

**TDD structure**: Each phase begins with test capture — snapshot current E2E/unit test results, write new tests for the fixes, implement, verify tests pass.

**Red-team verified baselines (2026-07-01)**:
- `!important`: **212** (not 284). Target: <50 removable.
- E2E tests: **31** total (not 66). Current pass rate to be verified at start.
- Unit tests: **560 total, 60 pre-existing failures** (not "410+ all pass").
- `<main>` missing: **13 pages** (not 26). Excludes React SPA entry.

## Phases

| Phase | Name | Status | Priority | Effort |
|-------|------|--------|----------|--------|
| 1 | [CSS Architecture](./phase-01-css-architecture.md) | Pending | P1 | 3-4h |
| 2 | [HTML Accessibility & UX](./phase-02-html-accessibility-ux.md) | Pending | P1 | 2-3h |
| 3 | [JavaScript Performance](./phase-03-javascript-performance.md) | Pending | P2 | 0.5-1h |
| 4 | [E2E Green](./phase-04-e2e-green.md) | Pending | P1 | 1-2h |
| 5 | [Verification](./phase-05-verification.md) | Pending | P1 | 1-2h |

## Dependencies

- Phase 2 depends on Phase 1 (CSS classes must stabilize before HTML uses them)
- Phase 5 depends on all phases

## Success Criteria

- Design audit rescore: C− → B+
- E2E: all tests pass (baseline captured at Phase 4 start)
- Build: `npm run build` 0 errors
- Tests: no NEW failures beyond 60 pre-existing baseline (capture baseline at start)
- Protected flows: Checkout, Loyalty, Reservation, KDS, POS intact
- `!important` count: 212 → <80 (only remove truly unnecessary; keep reduced-motion, print, utility)
- Undefined CSS var refs: 0
- Dead CSS links: 0

## Red Team Review

### Session — 2026-07-01
**Findings:** 28 (17 accepted, 11 rejected as duplicates)
**Severity breakdown:** 12 Critical, 12 High, 4 Medium

**Key corrections applied:**
1. Baselines verified against codebase (grep/glob): !important=212, E2E=31 tests, 560 unit tests (60 pre-existing failures), <main>=13 pages
2. 6 phantom issues removed: CSS var aliases, premium-upgrade refactor, prompt() replacement, #shared-navbar, Google Fonts CDN, scroll-progress — all already fixed in codebase
3. Protected flows replaced from Sophia AI Factory → AURA CAFE (Checkout, Loyalty, Reservation, KDS, POS)
4. Real issues added: dead CSS links in events/loyalty/referral.html (../css/ prefix), prompt() in loyalty.js:646, Google Fonts CDN in admin/*.html
5. Phase 3 rescoped from implementation to audit+standardize (debounce already imported by 4 files)
6. Phase 4 Cal.com fix adjusted (no Cal('init') call exists — test-only fix)

### Whole-Plan Consistency Sweep
- All phase files updated with verified baselines
- Removed phantom issues from implementation steps and success criteria
- Dependency chain updated (Phase 4 no longer depends on Phase 2 — #shared-navbar was already present)
- No unresolved contradictions remain
