# Phase 0 — Deprecate Grand Opening

**Wave:** A (Go-Live Unblocker) · **Priority:** P0 · **Status:** ✅ Complete (2026-09-10)

## Requirements

From `implementation_plan.md`: remove all Grand Opening concepts so loyalty + delivery becomes the store's commercial face.

- Set `AURA20`, `AURA10` → `is_active = 0` on D1 (`promotions` table)
- Close `bonus_campaigns` rows → `active = 0` (khai trương campaigns)
- KEEP `WELCOME` (10% max 30k, new-member) active
- Remove countdown/banner Grand Opening UI on homepage (`src/pages/stitch/luxury-landing*`, promotions page)

## Related Code Files

- **BE (D1 data, not code):** promotions rows, bonus_campaigns rows — via wrangler d1 execute
- **FE modify:** luxury-landing hero copy, promotions-new page, any `AURA20`/`khai trương` string in src/
- **FE delete:** countdown components if orphaned

## Implementation Steps

1. `grep -rn "AURA20\|AURA10\|khai trương\|Khai trương" src/ worker/` — full inventory
2. D1 updates (staging → prod) with backup first: `wrangler d1 execute aura-db --remote --command "UPDATE promotions SET is_active=0 WHERE code IN ('AURA20','AURA10')"`
3. Same for bonus_campaigns khai trương rows
4. Verify WELCOME untouched: `SELECT code, is_active FROM promotions WHERE code='WELCOME'`
5. Remove banner/countdown UI blocks; keep components if reused elsewhere
6. Full test suite + build

## Acceptance Criteria

- [x] AURA20/AURA10 rejected at checkout promo apply (API validation, not just UI hidden)
- [x] WELCOME still applies 10% max 30k
- [x] Homepage + promotions page show zero khai trương copy
- [x] Tests 100% pass (3228/3228)

## Implementation Record (2026-09-10)

- D1 was already in target state (pre-verified): AURA10/AURA20 `is_active=0`, WELCOME `is_active=1`, 3 khai trương bonus_campaigns `active=0`
- `src/hooks/use-promotions.ts` — both `usePromotions` + `usePromotionByCode` isFeatured fallbacks: `item.code === 'AURA20'` → `false`
- `src/components/promotions/__tests__/promotion-card.test.tsx` — fixture AURA20 → SAVE20 (×3)
- `src/components/promotions/countdown-timer.tsx` — deleted (orphaned, zero importers)
- Reports: [tester](../../reports/tester-260910-phase0-grand-opening.md) · [reviewer](../../reports/reviewer-260910-phase0-grand-opening.md) — PASS 8.5/10, 0 critical

## Follow-ups (non-blocking, from review)

1. `is_featured` column missing in D1 schema → `Promotion.isFeatured` is dead contract (always false via API; admin can't toggle). Add column or strip from interface
2. Generic countdown UIs still live on `/promotions` (`StitchPromotionsNew-hero.tsx`) — no khai trương copy, kept; remove if banner pattern should die fully
3. `grandOpeningAlt` i18n key (about-page history timeline) — factual brand story, kept; optional rename to `storefrontAlt`

## Risks

- Promos with usage history: keep rows, only flag inactive — no deletes (audit trail)
- Coupon-holding customers at launch: acceptable per business decision (pivot doc)

## Next Steps

Unblocks Phase 1 (loyalty UX surface).
