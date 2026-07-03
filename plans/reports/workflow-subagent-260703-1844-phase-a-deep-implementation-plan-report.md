# Phase A Deep Implementation Plan — Build Report

**Date:** 2026-07-03 18:46
**Status:** COMPLETE
**Total Planning Effort:** 14-17 hours across 5 workstreams
**Files Created:** 6 (1 master plan + 5 workstream plans)

---

## Summary

Deep implementation plans created for all 5 validated Phase A workstreams at `/Users/macbook/FnB-Container-Caffe/plans/260703-aura-next-phase-a/`.

## Plan Files

| File | Size | Description |
|------|------|-------------|
| `plan.md` | Master plan with dependency graph, file change map, quality gates | 
| `A1-design-token-consolidation.md` | Font + color token consolidation |
| `A2-generic-component-dark-remedy.md` | Dark-mode component backgrounds |
| `A3-emoji-to-lucide-migration.md` | Emoji to Lucide icon migration |
| `A4-test-suite-stabilization.md` | Test suite fixes + new coverage |
| `A5-a11y-ux-polish.md` | Accessibility + UX polish |

## Key Design Decisions

1. **No database or API changes** across all 5 workstreams — pure frontend/CSS work
2. **Dark-only @theme** — AURA is dark-only per design doc; `global.css` @theme must reflect this
3. **CSS variables over Tailwind utilities** for opacity-heavy cases (more consistent with existing patterns)
4. **Lucide already in dependencies** — no new packages for icon migration
5. **No new production components** — all fixes are modifications to existing files
6. **Spring easing** added as `--aura-easing-spring` CSS custom property for premium feel

## Files Touched (Total: ~50 files)

- CSS: 3 files (brand-tokens.css, global.css, stitch-tokens.css)
- Theme: 2 files (aura-tokens.ts, use-aura-theme.ts)
- Pages: 15 files across /pages
- Components: 15 files across /components
- Tests: 5+ new test files, 10-15 existing tests updated
- Infrastructure: index.html, App.tsx, DESIGN.md

## Risk Assessment

- **Risk Level:** Low (frontend-only, no DB/API changes, Lucide already installed)
- **Highest Risk Workstream:** A3 (emoji migration) — 16 files, each requiring import tree verification
- **Test Risk:** A4 — post-stitch regressions unknown until A1-A3 are merged
- **Rollback:** All plans have file-level and global `git checkout` rollback scripts
- **Backward Compatibility:** Zero — all changes are purely cosmetic (no contract changes)
