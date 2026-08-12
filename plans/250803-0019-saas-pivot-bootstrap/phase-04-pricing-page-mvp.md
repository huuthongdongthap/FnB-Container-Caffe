# Phase 4: Pricing Page MVP Implementation

## Overview
**Priority:** P2 - First visible SaaS feature
**Status:** completed

Implement the pricing page as the first public-facing SaaS component. This page displays 3 SaaS tiers, handles bilingual i18n, and converts visitors to signups via CTAs.

## Key Insights
- Frontend uses Vite + React 19 + react-router-dom v7 (package.json:69)
- i18n already configured via react-i18next (package.json:68) with [locale] routing
- Tailwind CSS v4 is the styling framework (package.json:52)
- Badge component exists at src/components/ui/badge.tsx (REUSE from Phase 2)
- Format utility at src/lib/format.ts handles VND currency formatting (REUSE)
- New route /api/saas/pricing is EXTENSION ZONE - never touches cafe routes
- Pricing data stored in D1 saas_pricing table, seeded via migration

## Requirements
1. Render 3 pricing tiers (LAUNCH/GROW/SCALE) in responsive card layout
2. Bilingual VN+EN via react-i18next (existing setup)
3. "GET STARTED" buttons link to /[locale]/register (existing auth flow)
4. Highlight recommended tier with visual badge
5. Mobile-responsive (1-col on mobile, 3-col on desktop)
6. Load pricing data from Hono API endpoint

## Architecture

### API Contract
GET /api/saas/pricing
- Response: 200 + JSON array of pricing tiers
- No auth required (public route)
- Cached at edge via Cloudflare KV (1hr TTL)

### Component Tree
PricingPage (src/pages/[locale]/pricing.tsx)
  -> PricingCard (src/components/saas/PricingCard.tsx) x 3
    -> Badge (src/components/ui/badge.tsx) - for "recommended"
    -> Button (src/components/ui/button.tsx) - for CTA

### Data Flow
Browser -> fetch(/api/saas/pricing) -> Hono route -> D1 saas_pricing table
  -> JSON response -> React renders 3x PricingCard
  -> User clicks CTA -> router.navigate(/LOCALE/register)

## Related Code Files
- src/pages/[locale]/pricing.tsx — NEW (EXTENSION ZONE)
- src/components/saas/PricingCard.tsx — NEW (EXTENSION ZONE)
- src/components/saas/PricingTiers.tsx — NEW (EXTENSION ZONE)
- worker/src/routes/saas-pricing.ts — NEW (EXTENSION ZONE)
- worker/migrations/010_saas_pricing.sql — NEW (schema addition)
- src/components/ui/badge.tsx:1 — REUSE (Phase 2)
- src/components/ui/button.tsx:1 — REUSE (Phase 2)
- src/lib/format.ts:1 — REUSE (Phase 2)
- src/lib/cn.ts:1 — REUSE (Phase 2)

## Implementation Steps
1. Create D1 migration: 010_saas_pricing.sql (saas_pricing table)
2. Apply migration via scripts/apply-migrations.sh
3. Create Hono route: worker/src/routes/saas-pricing.ts
4. Mount route in worker/src/index.ts (append, do not modify existing lines)
5. Create React components: PricingCard, PricingTiers
6. Create page: src/pages/[locale]/pricing.tsx
7. Add i18n keys: src/locales/vi/translation.json and src/locales/en/translation.json
8. Wire route in src/App.tsx (add to existing route config)

## Todo List
- [ ] Create D1 migration 010_saas_pricing.sql
- [ ] Apply migration and verify table exists
- [ ] Create Hono route GET /api/saas/pricing
- [ ] Mount route in worker/src/index.ts
- [ ] Create PricingCard component
- [ ] Create PricingTiers container component
- [ ] Create pricing page with i18n support
- [ ] Add i18n translation keys (vi + en)
- [ ] Wire route in src/App.tsx
- [ ] Vite build passes with 0 errors

## Success Criteria
- Pricing page renders at /vi/pricing and /en/pricing
- 3 tiers displayed with correct names/prices in VND
- "GET STARTED" button navigates to register
- Recommended tier has visual highlight (badge)
- Mobile layout: 1-column, desktop: 3-column
- npm run build passes (0 TypeScript errors)
- VND currency formatted via src/lib/format.ts

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| i18n keys missing | Medium | Low | Use existing i18n pattern from cafe pages |
| Route collision | Low | High | Route is /api/saas/* - no collision with /api/* cafe routes |
| VND formatting incorrect | Low | Low | Reuse existing format.ts utility |
| Pricing not bilingual | Medium | Medium | Follow existing src/locales pattern |

## Security Considerations
- GET /api/saas/pricing is public - no auth
- No sensitive data exposed
- CORS already configured in worker/src/index.ts

## Next Steps
- Feeds Phase 5 (Tenant Isolation - pricing data is already tenant-ready)
- Tier structure feeds Phase 6 (Auth Tier Gating)
