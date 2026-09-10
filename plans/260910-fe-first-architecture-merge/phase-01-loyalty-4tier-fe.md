# Phase 1 — Loyalty 4-Tier FE Wiring

**Wave:** A · **Priority:** P0 · **Status:** ⚪ Pending · **Depends:** Phase 0

## Requirements

From `implementation_plan.md` + blueprint: lock 4 tiers, phone-based guest → profile auto-create, points + cashback auto-credit post-payment.

- Tiers: Đồng (1.0x, 3%) · Bạc (1.1x, 5%) · Vàng (1.3x, 7%) · Bạch Kim (1.5x, 10%)
- Checkout phone input (debounce 400ms) → `GET /api/loyalty/lookup?phone=...` → show tier + wallet balance
- Auto-create profile + cashback wallet when new phone orders online
- Post-payment: points + cashback credited automatically (BE event, FE shows success toast + updated balance)

## BE Touchpoints (contract only)

- `GET /api/loyalty/lookup?phone=` — exists? verify shape; else spec it
- `POST /api/orders` response extension: `loyaltyResult { pointsEarned, cashbackEarned, tier }`
- Existing endpoints reused — no new tables assumed (verify loyalty tables exist on D1)

## Related Code Files

- `src/components/order/checkout-form.tsx` + `checkout-form-constants.tsx`
- `src/hooks/stores/use-loyalty-store.ts` (+ helpers/types already split)
- `src/pages/stitch/loyalty/` + `loyalty-calc/` + `loyalty-rewards/`
- `src/pages/__tests__/checkout-payos.test.tsx` (pattern reference for new tests)

## Implementation Steps

1. Verify BE contract: `grep -rn "loyalty/lookup" worker/src/` — read response schema
2. Wire phone debounce in checkout form; render tier badge + wallet balance chip
3. Order-success page: display `pointsEarned`/`cashbackEarned` from order response
4. Tier ladder UI on loyalty page (4 cards: multiplier + cashback %)
5. Tests: phone debounce, lookup success/new-phone/404, tier render, wallet display

## Acceptance Criteria

- [x] Phone entered → tier + wallet visible within ~600ms (400ms debounce + fetch)
- [x] New phone checkout → profile + wallet auto-created (verify via D1 query)
- [x] Order success shows earned points + cashback VND
- [x] All 4 tiers render correct multiplier/cashback % (11 new tests verify)
- [x] Tests pass (357 files / 3239 tests, tsc clean)

## Status: COMPLETE (2026-09-10)

Tier ladder implementation (final item):
- `src/components/stitch/loyalty-tier-ladder.tsx` (NEW): TierLadder + TierLadderCard
- `src/components/stitch/stitch-loyalty-types.ts`: LoyaltyTierLadderItem + tierLadder field
- `src/hooks/stores/use-loyalty-store.ts` + helpers: fetches GET /api/loyalty/tiers (optional try/catch), parseTierLadder
- `src/pages/loyalty.tsx`: store ladder || getDefaultLoyaltyData fallback (guests see ladder)
- `src/styles/brand-tokens.css`: --aura-tier-bronze/silver/gold/platinum tokens
- i18n: tierLadderTitle/currentTier/tierFromPoints/pointMultiplier/cashbackRate in vi.json + en.json
- Tests: loyalty-tier-ladder.test.tsx (7) + loyalty-store-helpers.test.ts (4)

Reports: plans/reports/tester-260910-tier-ladder.md, reviewer-260910-tier-ladder.md

## Risks

- Lookup endpoint may not exist → Phase 1 blocks on BE spec + implementation (this is a BE touchpoint, in scope per user decision)

## Next Steps

Unblocks Phase 4 (Aura Wallet checkout).
