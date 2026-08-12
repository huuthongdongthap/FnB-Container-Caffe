# Phase 3: MVP Workflow Selection (First SaaS-ifiable Feature)

## Overview
**Priority:** P1 - Gates all implementation work
**Status:** completed

Select the single first feature to SaaS-ify, define user journeys, and document exactly what "done" looks like. This phase produces the MVP specification that Phase 4 implements.

## Key Insights
- Existing `subscription_plans` table (worker/schema.sql:420) is the backbone for SaaS billing
- Pricing page is lowest-risk, highest-demo-value first feature
- Must interact with tenant context from Phase 5 - but implement pricing page independently first
- Pricing page can exist in "cafe ops" + "SaaS landing" dual mode

## Requirements
1. Define MVP feature: Pricing page (static + dynamic data from D1)
2. Define 3 pricing tiers: LAUNCH (free trial), GROW (subscription), SCALE (enterprise)
3. Define user journey: Anonymous → View Pricing → Sign Up → Tier Activation
4. Define success metrics: "Done" = pricing page loads, displays 3 tiers, CTAs work, i18n bilingual

## Architecture

### MVP Data Flow
Anonymous browser
  -> fetch /api/saas/pricing (public route)
  -> returns tier config from D1 saas_pricing table
  -> renders PricingPage component
  -> "GET STARTED" click -> /register (existing auth flow)

### New D1 Tables (Phase 5 IO)
saas_pricing (id, slug, name_vi, name_en, price_vnd, features, sort_order)
saas_tenants (id, tier, status, created_at)

## Related Code Files
- worker/schema.sql - append saas_pricing and saas_tenants tables
- worker/src/routes/saas-pricing.ts - new route (EXTENSION ZONE)
- src/pages/[locale]/pricing.tsx - new page (EXTENSION ZONE)
- src/components/saas/PricingCard.tsx - new component (EXTENSION ZONE)
- src/components/saas/PricingTier.tsx - new component (EXTENSION ZONE)

## Implementation Steps
1. Define MVP scope document (this file IS the spec)
2. Define pricing tier structure (3 tiers: LAUNCH/GROW/SCALE)
3. Define D1 schema additions (saas_pricing table)
4. Define API contract (GET /api/saas/pricing: public)
5. Define UI spec (3-column card layout, bilingual, responsive)

## Todo List
- [ ] Define MVP feature scope (pricing page)
- [ ] Define 3-tier structure (LAUNCH/GROW/SCALE)
- [ ] Define user journey end-to-end
- [ ] Define D1 schema additions
- [ ] Define API contract for /api/saas/pricing
- [ ] Define UI wireframe (3-column card, CTA buttons)

## Success Criteria
- MVP spec approved (no open questions)
- Pricing tier structure finalized (names, prices in VND, features list)
- User journey documented step-by-step
- D1 schema additions reviewed

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Pricing copy not bilingual | Medium | Medium | Reuse i18n setup from cafe pages |
| Tier structure changes later | Low | Medium | Use slug (not position) as identifier |
| Pricing page breaks cafe ops | Low | High | New route /api/saas/pricing is isolated |

## Security Considerations
- /api/saas/pricing is public (no auth required)
- No sensitive data exposed
- CORS already configured in index.ts

## Next Steps
- Feeds Phase 4 (Pricing Page MVP Implementation)
- Tier structure feeds Phase 6 (Auth Tier Gating)
