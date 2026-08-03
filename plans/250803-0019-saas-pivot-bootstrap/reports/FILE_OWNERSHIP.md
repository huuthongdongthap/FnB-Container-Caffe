# FILE_OWNERSHIP — Phase-to-File Mapping

Rule: No two phases modify the same file.

| Phase | Files Created | Files Modified | Owner |
|-------|--------------|----------------|-------|
| 1. Codebase Lock | reports/CODEBASE_LOCK.md, reports/FILE_OWNERSHIP.md | none | docs |
| 2. Asset Inventory | reports/ASSET_INVENTORY.md | none | docs |
| 3. MVP Workflow | reports/MVP_SPEC.md | none | docs |
| 4. Pricing Page MVP | worker/src/routes/saas-pricing.ts, src/pages/[locale]/pricing.tsx, src/components/saas/PricingCard.tsx, src/components/saas/PricingTiers.tsx, src/locales/vi/translation.json, src/locales/en/translation.json | worker/src/index.ts (append only), src/App.tsx (append only) | fullstack-developer |
| 5. Tenant Isolation | worker/src/routes/saas-tenants.ts, worker/src/middleware/tenant.ts, worker/migrations/011_saas_tenants.sql | none (new tables) | fullstack-developer |
| 6. Auth Tier Gating | worker/src/middleware/tier-gate.ts, src/lib/tier-config.ts | worker/src/routes/auth.ts (extend) | fullstack-developer |
| 7. Test & Verification | none | none (testing only) | tester |

## Conflict Rules

- `worker/src/index.ts` — Phase 4 appends route import; Phase 6 extends auth import. Sequential: 4 before 6.
- `src/App.tsx` — Phase 4 appends pricing route. No other phase touches this.
- `src/locales/*/translation.json` — Phase 4 adds keys. No other phase touches locale files directly.
- `worker/schema.sql` — Phases 4, 5 each add tables via migration files. No direct edits to schema.sql.
