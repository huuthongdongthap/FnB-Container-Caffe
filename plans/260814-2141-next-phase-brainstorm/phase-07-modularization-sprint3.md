# Phase 7: Modularization Sprint 3 — Stitch Mega-Components

**Priority:** P0 | **Status:** TODO | **Effort:** 6-8h

---

## Context

After Sprints 1-6, 8 stitch components remain at 870-928 LOC each. These are the largest unmodularized files in the codebase and represent the highest technical debt for future maintenance.

## Target Files

| File | LOC | Extraction Plan |
|------|-----|-----------------|
| StitchEventsNew2.tsx | 928 | types, event-card, event-form, event-timeline, empty-state, hooks |
| StitchLandingNew.tsx | 921 | types, hero, features, zones, cta-section, hooks |
| StitchReferralNew2.tsx | 919 | types, referral-steps, reward-cards, referral-form, hooks |
| StitchOrderSuccessNew.tsx | 894 | types, order-summary, order-items, tracking-status, confetti, hooks |
| StitchOrderMgmtNew.tsx | 884 | types, order-filters, order-table, status-badge, order-detail-modal, hooks |
| StitchReviewsNew.tsx | 875 | types, review-list, review-form, rating-display, empty-state, hooks |
| StitchKDSNew.tsx | 872 | types, order-board, order-card, status-timer, kitchen-header, hooks |
| StitchStoryNew.tsx | 871 | types, timeline, values-grid, team-section, story-hero, hooks |

## Implementation Steps

1. Read each file, identify logical sections
2. Extract TypeScript interfaces → `*-types.ts`
3. Extract custom hooks → `use-*.ts`
4. Extract sub-components → `component-name.tsx` (<200 LOC each)
5. Extract default/mock data → `default-data.ts`
6. Refactor parent to import and compose extracted modules
7. Verify: `npx tsc --noEmit` (0 errors) + `npx vitest run` (all pass)
8. Commit after each file

## Files Created (per component)

```
src/components/stitch/
├── StitchEventsNew2.tsx           (parent, <200 LOC)
├── StitchEventsNew2-types.ts     (interfaces)
├── StitchEventsNew2-card.tsx     (sub-component)
├── StitchEventsNew2-form.tsx     (sub-component)
├── StitchEventsNew2-timeline.tsx (sub-component)
├── StitchEventsNew2-empty.tsx    (sub-component)
├── use-stitch-events.ts          (hook)
└── stitch-events-default.ts      (data)
```

## Success Criteria

- 8/8 files <200 LOC
- ~70-80 new extracted files
- 0 TS errors
- All 2914+ tests pass
- Build <4s

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Extracted components break tests | Low | Medium | Run tests per-file, not batch |
| Merge conflicts | Low | Low | Commit per-file |
| Inconsistent extraction patterns | Medium | Low | Follow Sprint 2+4 patterns exactly |

## Verification

```bash
npx tsc --noEmit                    # 0 TS errors
npx vitest run                      # All tests pass
find src/components/stitch -name "*.tsx" -not -path "*__tests__*" | xargs wc -l | sort -rn | head -10  # Verify no files >200 LOC
```
