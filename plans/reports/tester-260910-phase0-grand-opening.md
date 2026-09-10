# Tester Report — Phase 0: Deprecate Grand Opening

**Date:** 2026-09-10 · **Plan:** plans/260910-fe-first-architecture-merge/phase-00-deprecate-grand-opening.md

## Changes Under Test

1. `src/hooks/use-promotions.ts:38` — isFeatured default: `item.code === 'AURA20'` → `false`
2. `src/components/promotions/__tests__/promotion-card.test.tsx` — fixture AURA20 → SAVE20 (×3)
3. `src/components/promotions/countdown-timer.tsx` — deleted (orphaned, zero imports)

## Results

| Check | Result |
|---|---|
| Full suite (`npx vitest run`) | **355 files / 3228 tests — 100% PASS** (42.5s) |
| Type check (`tsc --noEmit`) | PASS (exit 0) |
| `grep AURA20 src/` | 0 hits (code + tests) |
| Landing pages khai trương/Grand Opening copy | 0 hits |
| About page `phase3Title` | RETAINED — brand history timeline (factual past), not promo copy |

## BE Verification (contract)

- `worker/src/routes/promotions.ts:175` — validate API filters `is_active = 1` → AURA20/AURA10 rejected: "Mã không tồn tại hoặc đã bị vô hiệu hoá"
- D1 (verified pre-implementation): AURA10/AURA20 `is_active=0` · WELCOME `is_active=1` · 3 khai trương bonus_campaigns `active=0`

## Acceptance Criteria

- [x] AURA20/AURA10 rejected at checkout promo apply (API validation, not just UI hidden)
- [x] WELCOME still applies 10% max 30k (is_active=1 in D1)
- [x] Homepage + promotions page show zero khai trương copy
- [x] Tests 100% pass (3228/3228)

## Note

- Tester subagent spawn failed (model routing error) → suite run inline per cook fallback protocol. Same command, same output.

## Unresolved Questions

None.
