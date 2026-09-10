# Tester Report — 260910 Tier Ladder (Phase 1)

Mode: inline (tester subagent terminated on model-routing API 400; fallback per cook protocol)

## Scope
Loyalty 4-tier ladder FE: component, store fetch, parse helper, page wiring, i18n, tokens, order-success pendingOrder extension.

## Verification
- `tsc --noEmit`: clean (0 errors)
- Full suite: **357 files / 3239 tests pass** (was 355/3228 → +2 files, +11 tests)
- New tests: 11/11 pass (~1s)

## New tests
1. `src/components/stitch/__tests__/loyalty-tier-ladder.test.tsx` (7 tests)
   - Renders title + all 4 tier names (Đồng/Bạc/Vàng/Bạch Kim)
   - Multiplier values 1x/1.1x/1.3x/1.5x
   - Cashback % 3%/5%/7%/10%
   - Current-tier badge appears exactly once (on is_current)
   - tierFromPoints interpolation (Từ 0/50/200/500 điểm)
   - Empty tiers → renders nothing
   - Unknown tier_name → fallback icon ★
2. `src/hooks/stores/__tests__/loyalty-store-helpers.test.ts` (4 tests)
   - parseTierLadder maps API rows + marks is_current
   - Sorts by min_points ascending
   - Coerces missing fields to safe defaults (min_points 0, multiplier 1, cashback 0)
   - Empty array → []

## Fixed during verification (pre-test)
- order-success.tsx pendingOrder state lacked points_earned/cashback_earned → added optional fields (tsc error TS2339)
- Existing test fixtures (loyalty-tier-card.test.tsx, StitchLoyaltyNew.test.tsx) lacked required tierLadder field after type extension → added `tierLadder: []`
- loyalty-tier-ladder.tsx referenced nonexistent `--aura-surface-elevated` → corrected to `--aura-bg-elevated`

## Gaps
None blocking. Note: store-level fetch of /api/loyalty/tiers covered by existing use-loyalty-store test patterns; ladder rendering covered by component tests.

Unresolved questions: none
