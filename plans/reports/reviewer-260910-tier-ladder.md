# Reviewer Report — 260910 Tier Ladder (Phase 1)

Mode: inline (reviewer subagent died on API 503 capacity; fallback per cook protocol)
Scope: loyalty-tier-ladder.tsx, stitch-loyalty-types.ts, use-loyalty-store.ts + helpers, loyalty.tsx, brand-tokens.css, vi/en.json, order-success.tsx type fix, 2 test fixture updates, 2 new test files.

## Checks

**(a) Acceptance criteria** — PASS
- All 4 tiers render (Đồng/Bạc/Vàng/Bạch Kim), multipliers 1x/1.1x/1.3x/1.5x, cashback 3%/5%/7%/10%, current-tier badge unique, min_points interpolation — all covered by 11 new tests, green.

**(b) No regression to touchpoints/blast-radius** — PASS
- LoyaltyDashboardData production constructors: exactly 1 site (src/pages/loyalty.tsx:92) — updated with tierLadder + guest fallback. Test fixtures (loyalty-tier-card, StitchLoyaltyNew) updated with `tierLadder: []`.
- StitchLoyaltyNew.tsx:81 empty-state condition untouched. No dangerouslySetInnerHTML in ladder or dashboard (XSS clean).
- parseTierLadder is a new pure function in loyalty-store-helpers.ts; zero mutation of existing parse fns. fetchLoyalty adds 1 optional try/catch fetch (same pattern as points/rewards); main summary error propagation intact.

**(c) Public contracts** — PASS
- No worker/API changes; GET /api/loyalty/tiers consumed read-only.
- LoyaltyDashboardData gained `tierLadder` (internal Stitch type, all call sites updated same change — no external breakage). Order type unchanged (points_earned/cashback_earned already optional).

**(d) Existing patterns** — PASS
- Sub-file component (loyalty-tier-ladder.tsx), brand tokens (--aura-tier-*), vi/en i18n parity, zustand optional-fetch try/catch, focused test files w/ vi.mock t-map. Matches scout conventions.

**(e) Lint/type/build** — PASS
- tsc --noEmit: 0 errors. Full suite: 357 files / 3239 tests pass.

## Findings (non-blocking)

1. `fetchLoyalty` calls `parseLoyaltySummary(data)` twice (once for tier param, once for destructure) — cosmetic inefficiency, no behavior impact. Leave.
2. Tier data fallback chain: guests w/o store data get hardcoded defaults from getDefaultLoyaltyData — intended per plan (guests see ladder).
3. loyalty.tsx hardcodes TOTAL_POINTS=15000/"Black Tier" display strings — pre-existing, out of scope.

## Decision

**PASS** · score 9/10 · criticalCount 0

## Unresolved questions

None.
