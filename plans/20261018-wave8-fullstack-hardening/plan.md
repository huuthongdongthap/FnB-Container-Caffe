# Wave 8: Fullstack Hardening (Frontend, Worker, Domain, Analytics & Tests)

**Status**: Complete
**Audit Reference**: [reports/brainstorm-20261018-wave8-deep-audit.md](reports/brainstorm-20261018-wave8-deep-audit.md)
**Total Target Defects**: 56 verified fullstack defects across 5 independent phases

---

## Phases Overview

| Phase | Title | Scope | Status |
|---|---|---|---|
| [Phase 01](phase-01-frontend-ui-components-pages.md) | Frontend UI Components & Pages | `src/components/{home,events,admin,stitch}/**`, `src/pages/**` | Complete |
| [Phase 02](phase-02-frontend-stores-hooks.md) | Frontend Stores & Hooks State Machines | `src/hooks/**`, `src/hooks/stores/**` | Complete |
| [Phase 03](phase-03-worker-openapi-cron-device-resilience.md) | Worker OpenAPI, Cron & Device Resilience | `worker/src/routes/{openapi-*,dindin,reminders,mixpost}/**` | Complete |
| [Phase 04](phase-04-domain-catalog-crm-inventory-order-kitchen.md) | Domain Packages & Analytics Hardening | `packages/domain/**`, `worker/src/tree/{analytics,referrals}/**` | Complete |
| [Phase 05](phase-05-worker-auth-webhooks-tracking-tests.md) | Worker Auth Revocation, Webhooks & Test Hardening | `worker/src/routes/{orders-unified,webhooks,erpnext}/**`, `worker/src/__tests__/**` | Complete |

---

## File Ownership Boundaries (Strict)

- **Phase 01**: `src/components/{home,events,admin,stitch}/**`, `src/pages/{checkout.tsx,TrackOrder.tsx,loyalty.tsx,admin/{POS.tsx,SubscriptionsManager.tsx}}`
- **Phase 02**: `src/hooks/{split-bill-helpers.ts,use-split-bill.ts,use-checkin.ts,stores/admin/**,stores/use-checkin-store.ts}`
- **Phase 03**: `worker/src/routes/openapi-{cron,auth,promotions,payments,loyalty}-handlers/**`, `worker/src/routes/{dindin-handlers/**,reminders/**,mixpost-handlers/**}`
- **Phase 04**: `packages/domain/{catalog,crm,inventory,order,customer,kitchen}/**`, `worker/src/tree/{analytics,referrals}/**`
- **Phase 05**: `worker/src/routes/{orders-unified.ts,webhooks-handlers/**,erpnext.ts,cal-booking-webhook-handlers/**}`, `worker/src/tree/subscriptions/**`, `worker/src/__tests__/**`

---

## Key Dependencies & Execution Strategy
- Phases 01 through 05 have completely disjoint file ownership sets and run concurrently via parallel subagents.
- Quality gates: 100% Vitest pass across all unit and integration suites, zero TypeScript errors (`tsc --noEmit`), zero ESLint errors, and successful production build (`npm run build`).
