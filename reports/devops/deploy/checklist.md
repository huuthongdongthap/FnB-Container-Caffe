# Pre-Flight Checklist — Lượt 9 (`v2.3.0` Store Operations & Multi-Tenant Hardening)

- [x] `npm run lint` — 0 warnings / 0 errors
- [x] `npm run lint:migrations` — 60 forward / 18 down in `worker/db/migrations` (87 forward total)
- [x] `npm run check:contrast` — 11/11 MD3 token pairs pass WCAG AA
- [x] `npm run typecheck:all` — 0 TypeScript errors across frontend, worker, and aura-deploy
- [x] `npx vitest run` — 577 test files / 5,763 tests passing
- [x] `node scripts/local-payment-flow/run.mjs --api-only` — 58/58 live loopback assertions passing
- [x] `npm run build` — production SPA bundle built in `dist/`
- [ ] **Outward Action Gate (Pending User Confirmation):**
  1. Commit & push Lượt 2–9 converged branch to `origin/main` (or open PR).
  2. Run `deploy.yml` → `apply-d1-migration` for `20261115_01_tenant_unique_constraints_and_indexes.sql` and `20261118_01_orders_loyalty_points_redeemed.sql` (exports pre-migration D1 backup first).
  3. Run `deploy.yml` → `worker-canary-10` (10% canary split against baseline `33d9e23b-711c-4278-82d1-b8013fedc41a`).
  4. Run `deploy.yml` → `deploy-pages` and `worker-promote-100` after smoke verification.
