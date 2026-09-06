# Audit Plan — Risk Rank (Stage 1/3)

**Goal:** Refactor codebase theo chuẩn quán cà phê container Sa Đéc mộc mạc (rustic) — KHÔNG sang trọng/hiện đại quá mức.
**Method:** risk-rank --annual (recipe: audit-plan DAG group 1)

## Baseline state (verified)

| Asset | Current state | Rustic gap |
|---|---|---|
| Brand tokens v6 (`src/styles/brand-tokens.css`) | ✅ DONE — Quicksand + Be Vietnam Pro, forest primary #4A7C59, blur 8px, gold hexes removed from hero/luxury-landing | None — foundation complete |
| Rebrand plan P1-P3 (`plans/260826-1400-container-ban-dia-rebrand/`) | Executed (fonts loaded in index.html:15-16, tokens remapped) | None |
| Serif fonts hardcoded | ❌ 46 stitch files still use `EB Garamond` inline `fontFamily` (bypasses `--aura-font-display` token) | HIGH — luxury serif contradicts mộc mạc |
| Locale luxury copy | ❌ `luxuryTax` = "Thuế cao cấp (5%)" vi:276, "Luxury Tax (5%)" en:276+447, `checkout.luxuryTax` "Luxurytax" en:1790 | MEDIUM — user-facing copy tone |
| Luxury-named routes/pages | 5 pages (`luxury-cafe-1/2`, `luxury-landing`, `luxury-landing-hero`, `premium-checkout`) — all stitch-preview only, not production paths | LOW (internal URLs, out of scope per prior decision) |
| Test suite | 389/389 stitch tests pass, 3115 total pass | Constraint — font/copy changes must update tests |

## Risk-ranked areas (annual view — likelihood × impact)

| Rank | Risk area | Likelihood | Impact | Score | Rationale |
|---|---|---|---|---|---|
| R1 | Serif font hardcode (46 files) | Certain (exists) | High visual | **9.0** | Every page renders luxury serif despite Quicksand token; single-largest rustic contradiction |
| R2 | Locale luxury copy (luxuryTax + premium keys) | Certain | Medium (user-facing) | **7.5** | "Luxury Tax" on checkout contradicts bản địa tone; fallback strings in components leak |
| R3 | Glass/gradient/blur luxury effects concentration | High | Medium visual | **7.0** | Verified: 279 blur usages, ~95% exceed 8px token (24px×44, 12px×40, 20px×29, max 100px); 431 hardcoded hex (368 components + 63 pages); gradients concentrate in StitchAdminLoginNew-styles (5), StitchMenuNew-styles (4); 51 shadows |
| R4 | Test breakage from copy/font assertions | High (if R1/R2 done naively) | CI blocking | **6.5** | Tests assert `industrial-luxury` strings, font names; must be updated in same change |
| R5 | Duplicate stitch↔public routes (21 pairs) | Medium | Low (internal) | **4.0** | Preview-only; cleanup optional, out of rustic scope |
| R6 | SEO meta (index.html description "industrial-luxury") | Certain | Low-Med | **5.0** | One-line fix, included with R2 |

## Stage 1 verdict

Prioritize **R1 (fonts) → R2 (copy) → R3 (visual effects)** as the audit-critical path. R4 is a constraint on R1/R2 execution, not independent work. R5/R6 are bycatch.

## Subagent inventory (complete)

### Test-assertion constraints (R4)
- `src/components/brand/__tests__/typography-showcase.test.tsx:7,14` — FONTS_DATA pins `EB Garamond`
- `src/components/home/__tests__/hero-section.test.tsx:14` — asserts `/industrial-luxury/`
- `src/components/stitch/__tests__/StitchCheckoutNew.test.tsx:25,88` — mocks/asserts `'stitch.tax': 'Luxury Tax (5%)'`

### Luxury copy surfaces (R2)
Components with luxury/premium refs (all user-facing): HeroSection, hero-section, five-zone-showcase-data ("Industrial Luxury đẳng cấp"), StitchContainerNew1/2, StitchLandingNew-hero/gallery, StitchMenuNew-footer ("Industrial Luxury Dining"), StitchStoryNew-hero/story, StitchCheckoutNew-order-summary (fallback `'Luxury Tax (5%)'`), StitchMobileOrderNew, loyalty-tier-card, StitchSubscriptionsNew.
Locale keys: `landing.pageAriaLabel` "sang trọng", `containerNew2.heroTag` "Cà Phê Đặc Biệt Cao Cấp", `feature1Desc` "xa xỉ hiện đại", `premiumRewardPoints`, `fieldPlanNamePlaceholder` "Container Cao Cấp", `checkout.luxuryTax` "Phí xa xỉ".

### Visual effects hotspots (R3)
- Blur > 8px: skeleton components (StitchReferralNew2-skeleton 19 hex, StitchAccountNew-skeleton 17), loyalty/rewards cluster, referral/account/checkin pages, 404 overlays (100px in StitchAccountNew/StitchStoryNew-footer/checkin-new; 80px referral-rewards-1)
- Marketing copy surfaces: "nocturnal luxury", "chrome", "moody"
- stitch-exports/ has 27 screen dirs; only color doc is BRAND_v6_MINERAL_PLAN.md (pearl/cream/blue-grey — conflicts with both noir tokens and rustic goal); no wood/kraft/terracotta texture assets exist
