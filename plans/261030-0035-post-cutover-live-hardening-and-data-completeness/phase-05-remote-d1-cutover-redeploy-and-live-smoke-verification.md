# Phase 05: Remote D1 Cutover, Redeploy & Live Smoke Verification

## Context Links
- Plan Overview: `plans/261030-0035-post-cutover-live-hardening-and-data-completeness/plan.md`
- Migration Linter: `scripts/lint-d1-migrations.mjs`

## Overview
- **Priority**: P0 (Production Verification & Release Closeout)
- **Current Status**: Pending
- **Description**: Validate all changes locally (migration linter, full replica test, frontend build), apply `20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql` to remote D1 `fnb-caffe-db`, redeploy Cloudflare Pages (`fnb-caffe-container` / `auraspace.cafe`), verify live endpoints, and commit/push to `origin/main`.

## Key Insights
- Remote D1 `fnb-caffe-db` (`97ae7a5f-fc4d-460d-b019-8535332bd81f`) is at `126` tables. Applying `20261030_01` is a pure data backfill (`UPDATE products`, `UPDATE menu_items`, `INSERT OR IGNORE INTO recipe_ingredients`, `INSERT OR IGNORE INTO cron_jobs`) with zero destructive DDL.

## Requirements
- **Functional**:
  - Pass `node scripts/lint-d1-migrations.mjs`.
  - Pass replica integration test (`loyalty-referrals-inventory-po-cutover.test.ts`) including `20261030_01` and rollback `.down.sql`.
  - Apply `20261030_01` to remote D1 `fnb-caffe-db` and record row counts in `d1_migrations`.
  - Build (`npm run build`) and deploy Cloudflare Pages (`fnb-caffe-container`) and Worker (`aura-space-worker`).
- **Non-Functional**:
  - Verify live `GET /api/menu` (`withImages: 49/49`), `GET /api/v1/menu` (`withImages: 49/49`), and `https://auraspace.cafe` asset/API responses.

## Architecture
- Local replica test → Remote D1 `wrangler d1 execute fnb-caffe-db --remote` → `wrangler deploy` (`aura-space-worker`) + `wrangler pages deploy dist --project-name=fnb-caffe-container --branch=main` → Live HTTP smoke verification → `git commit && git push origin main`.

## Related Code Files
- Modify: `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts`

## Implementation Steps
1. Extend `worker/src/__tests__/integrations/loyalty-referrals-inventory-po-cutover.test.ts` to apply `20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql` and `.down.sql` on the 126-table production replica, asserting `49` product images, `46` `recipe_ingredients`, and `5` `cron_jobs`.
2. Run `node scripts/lint-d1-migrations.mjs` and `npx vitest run`.
3. Execute `20261030_01_catalog_images_bom_ingredients_and_cron_seed.sql` on remote D1 `fnb-caffe-db` and record it in `d1_migrations`.
4. Run `npm run build --silent`, deploy Worker & Pages, and verify live production endpoints.
5. Commit and push cleanly to `origin/main`.

## Todo List
- [ ] Extend replica cutover test with `20261030_01` up/down verification
- [ ] Apply `20261030_01` to remote D1 `fnb-caffe-db`
- [ ] Redeploy Worker (`aura-space-worker`) & Pages (`fnb-caffe-container`)
- [ ] Verify live `/api/menu` (`withImages: 49/49`), `/api/v1/menu`, and `auraspace.cafe`
- [ ] Commit and push to `origin/main`

## Success Criteria
- Live `GET /api/menu` returns `items: 49, withImages: 49`.
- Live D1 `recipe_ingredients` has `46` rows and `cron_jobs` has `5` rows.
- Live `https://auraspace.cafe` serves updated `/menu` bundle, `_redirects`, and `sw.js`.

## Risk Assessment
- **Risk**: D1 remote execution timeout.
- **Mitigation**: Pure row updates/inserts on `< 100` rows execute in `< 50ms`.

## Security Considerations
- No secrets or credentials in migration SQL or commits.

## Next Steps
- Execute via `/cook` to apply Phases 01–05 to production.
