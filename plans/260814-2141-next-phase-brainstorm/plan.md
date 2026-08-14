# Plan: Next Phase — AURA CAFE

**Date:** 2026-08-14 | **Status:** READY | **Branch:** main

---

## Overview

After Sprints 1-6 completed (modularization, test coverage, i18n), the next high-impact work is:

1. **Sprint 7:** Modularize 8 remaining stitch mega-components (870-928 LOC → <200 LOC)
2. **Sprint 8:** Integration tests for order flow E2E (menu → checkout → payment → KDS)

---

## Sprint 7: Modularization Sprint 3

### Target Files

| # | File | LOC | Priority |
|---|------|-----|----------|
| 1 | StitchEventsNew2.tsx | 928 | P0 |
| 2 | StitchLandingNew.tsx | 921 | P0 |
| 3 | StitchReferralNew2.tsx | 919 | P0 |
| 4 | StitchOrderSuccessNew.tsx | 894 | P1 |
| 5 | StitchOrderMgmtNew.tsx | 884 | P1 |
| 6 | StitchReviewsNew.tsx | 875 | P1 |
| 7 | StitchKDSNew.tsx | 872 | P1 |
| 8 | StitchStoryNew.tsx | 871 | P1 |

### Pattern (established in Sprint 2+4)

Each file decomposition:
1. **Read** current file → identify logical sections
2. **Extract** types → `*-types.ts`
3. **Extract** hooks → `use-*.ts`
4. **Extract** sub-components → `*.tsx` (each <200 LOC)
5. **Extract** default data → `default-data.ts`
6. **Keep** parent file as orchestrator (<200 LOC)
7. **Verify**: `npx tsc --noEmit` + `npx vitest run`

### Expected Output

- 8 parent files reduced to <200 LOC each
- ~70-80 new extracted files (types, hooks, sub-components, data)
- 0 TS errors, all existing tests pass

---

## Sprint 8: Integration Tests — Order Flow E2E

### Critical Path

```
Menu → Cart → Checkout → Payment → Order Success → KDS
```

### Test Scenarios

1. **Menu browse** — load categories, render products, add to cart
2. **Cart state** — add/remove items, quantity update, total calculation
3. **Checkout flow** — form validation, delivery fee, payment method selection
4. **Payment mock** — PayOS redirect simulation, COD confirmation
5. **Order success** — order confirmation render, data reset
6. **KDS update** — order status progression (pending → preparing → ready)

### Mock Strategy

- Mock Worker API responses (menu, orders, payments)
- Use existing `renderWithProviders` with MSW or vi.mock
- Test state transitions across component boundaries

### Expected Output

- 1 new test file: `src/__tests__/order-flow-integration.test.tsx`
- 15-25 integration test cases
- All passing

---

## Success Criteria

| Criterion | Target |
|-----------|--------|
| All files <200 LOC | 8/8 modularized |
| TS errors | 0 |
| Existing tests | All pass (2914+) |
| New integration tests | 15-25 passing |
| Build time | <4s |

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Extracted components break existing tests | Run tests after each file, not batch |
| Integration tests too brittle | Use mock API responses, not real endpoints |
| Merge conflicts with uncommitted work | Commit after each file modularization |

---

## Execution Strategy

- **Sprint 7:** 8 parallel agents (one per file) using `bypassPermissions`
- **Sprint 8:** 1-2 agents for integration test creation
- **Verification:** Full test suite after each sprint
