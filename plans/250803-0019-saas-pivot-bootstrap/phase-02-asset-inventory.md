# Phase 2: Asset Inventory (Catalog Reusable Features/Components)

## Overview
**Priority:** P1 — Required before MVP workflow selection
**Status:** completed

Systematically catalog every existing feature and component that can be repurposed for the SaaS MVP. Output is an ASSET_INVENTORY.md with tiers: "reuse as-is", "adaptable", and "ignore".

## Key Insights
- `worker/schema.sql:420-485` has subscription_plans/subscriptions tables — reusable SaaS billing foundation
- `worker/src/routes/subscriptions.ts` already implements container lease billing — adaptable to SaaS plans
- `src/components/ui/card.tsx`, `button.tsx`, `modal.tsx`, `input.tsx`, `badge.tsx` — generic UI primitives, reuse directly
- `src/lib/cn.ts`, `src/lib/format.ts`, `src/lib/logger.ts` — utility functions, reuse directly
- `worker/src/auth.ts` has register/login/logout — need tier-aware extension
- `worker/src/routes/analytics-hono.ts` provides analytics endpoints — repurpose as SaaS usage metrics
- `worker/src/routes/customers.ts` — adaptable for tenant customer management

## Requirements
1. Catalog all reusable React components in `src/components/`
2. Catalog all backend route capabilities in `worker/src/routes/`
3. Catalog all database tables by reuse value
4. Triage each asset: REUSE / ADAPT / IGNORE
5. Estimate adaptation effort

## Architecture

### Triage Matrix Structure
Reuse (0-1hr): Generic UI primitives, utility functions, logger, currency formatter
Adapt (2-4hr): Auth with tier checks, subscriptions renamed to plans, analytics role-scoped
Ignore: Cafe-specific features (KDS, TV menu, signage, loyalty cashback for dine-in)

## Related Code Files
- `worker/schema.sql:420` — subscription_plans table (REUSE)
- `worker/schema.sql:437` — subscriptions table (REUSE with schema changes)
- `worker/src/routes/subscriptions.ts` — subscription endpoints (ADAPT)
- `worker/src/routes/auth.ts` — auth endpoints (ADAPT for tier gating)
- `worker/src/routes/analytics-hono.ts` — analytics endpoints (ADAPT)
- `worker/src/routes/customers.ts` — customer endpoints (ADAPT)
- `src/components/ui/card.tsx` — card component (REUSE)
- `src/components/ui/button.tsx` — button component (REUSE)
- `src/components/ui/modal.tsx` — modal component (REUSE)
- `src/components/ui/input.tsx` — input component (REUSE)
- `src/components/ui/badge.tsx` — badge component (REUSE)
- `src/components/ui/navbar.tsx` — navbar (ADAPT for SaaS layout)
- `src/components/ui/footer.tsx` — footer (ADAPT for SaaS layout)
- `src/components/shared/SEOHead.tsx` — SEO wrapper (ADAPT)
- `src/lib/cn.ts` — classnames utility (REUSE)
- `src/lib/format.ts` — currency/date format (REUSE)
- `src/lib/logger.ts` — logger (REUSE)
- `src/lib/validators.ts` — Zod schemas (REUSE + extend)

## Implementation Steps
1. Scan `src/components/` subdirs for all .tsx files
2. Scan `worker/src/routes/` for all route endpoints
3. Scan `worker/schema.sql` for all tables
4. Triage each item: REUSE / ADAPT / IGNORE
5. Write ASSET_INVENTORY.md with effort estimates

## Todo List
- [ ] Scan and catalog React components
- [ ] Scan and catalog backend routes
- [ ] Scan and catalog D1 tables
- [ ] Triage: REUSE / ADAPT / IGNORE
- [ ] Write ASSET_INVENTORY.md with effort estimates

## Success Criteria
- ASSET_INVENTORY.md lists every reusable asset with triage tag
- Each asset has adaptation effort estimate
- No "unknown" entries — every file inventoried

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Overestimate reusability | Medium | Medium | Prototype 2-3 ADAPT items before committing |
| Miss hidden dependencies | Low | High | Trace imports of each reused component |
| Subscription schema too cafe-specific | Medium | Medium | Create new saas_plans table if needed |

## Security Considerations
- No credentials in inventory
- Auth route review prevents accidental secret exposure
- Subscription data structures may contain price data — treat as non-sensitive

## Next Steps
- ASSET_INVENTORY.md feeds Phase 3 (MVP Workflow Selection)
- ADAPT items require deeper analysis before implementation
