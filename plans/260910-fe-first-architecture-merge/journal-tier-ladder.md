# Journal — 2026-09-10: Loyalty 4-Tier Ladder (Phase 1 Final Item)

## What shipped
- `src/components/stitch/loyalty-tier-ladder.tsx` — TierLadder (grid 1/2/4) + TierLadderCard (icon, min_points subtitle, multiplier x, cashback %, current badge)
- `src/components/stitch/stitch-loyalty-types.ts` — LoyaltyTierLadderItem type
- `src/hooks/stores/use-loyalty-store.ts` — optional try/catch fetch of GET /api/loyalty/tiers, parseTierLadder helper
- `src/pages/loyalty.tsx` — store.tierLadder || getDefaultLoyaltyData fallback (guests see ladder)
- `src/styles/brand-tokens.css` — 4 new --aura-tier-* tokens (bronze #CD7F32, silver #C9D6DF, gold #E3C05B, platinum #B8D8E8)
- `src/locales/vi.json + en.json` — tierLadderTitle, currentTier, tierFromPoints, pointMultiplier, cashbackRate
- `src/pages/order-success.tsx` — extended pendingOrder state with points_earned/cashback_earned, displays earned values

## Fixes during verification
- order-success.tsx pendingOrder state lacked points_earned/cashback_earned (tsc TS2339) → added optional fields
- test fixtures (loyalty-tier-card.test.tsx, StitchLoyaltyNew.test.tsx) lacked tierLadder field after type extension → added `tierLadder: []`
- loyalty-tier-ladder.tsx referenced nonexistent `--aura-surface-elevated` → corrected to `--aura-bg-elevated` (#162a3d)

## Test results
- tsc --noEmit: clean
- 357 files / 3239 tests pass (+2 files, +11 tests)
- New: loyalty-tier-ladder.test.tsx (7), loyalty-store-helpers.test.ts (4)

## Subagent fallbacks (known pattern)
- Tester subagent died on model-routing 400 → ran inline (full suite, report saved)
- Reviewer subagent died on 503 capacity → ran inline (all checks PASS, report saved)

## Next
Phase 2: Delivery/Takeaway/Dine-in checkout completion (unlocked)