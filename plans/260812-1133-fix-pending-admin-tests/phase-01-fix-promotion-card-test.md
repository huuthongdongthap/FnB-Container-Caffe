# Phase 01: Fix Promotion Card Test
Files owned: `src/components/promotions/__tests__/promotion-card.test.tsx`
## Status: In Progress (WIP — owner debeak update edit this phase to reflect)
## Implementation Steps
1. Update `activePromo.expiresAt` to `2026-12-31T23:59:59.000Z` so the test stays active.
2. Adjust the validity date assertion to match component output format (tháng/ngay/2026).
3. Run PromotionCard unit tests specifically; confirm green before moving to Worker phase.
## TODO
- [x] Update expiry fixture date
- [x] Diff guarded local to this phase
- [ ] Verify passing locally
