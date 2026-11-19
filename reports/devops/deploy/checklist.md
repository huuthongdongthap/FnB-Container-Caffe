# Pre-Flight Checklist — Lượt 9 (`v2.3.0` Store Operations & Multi-Tenant Hardening)

- [x] `npm run lint` — 0 warnings / 0 errors
- [x] `npm run lint:migrations` — 60 forward / 18 down in `worker/db/migrations` (87 forward total)
- [x] `npm run check:contrast` — 11/11 MD3 token pairs pass WCAG AA
- [x] `npm run typecheck:all` — 0 TypeScript errors across frontend, worker, and aura-deploy
- [x] `npx vitest run` — 577 test files / 5,763 tests passing
- [x] `node scripts/local-payment-flow/run.mjs --api-only` — 58/58 live loopback assertions passing
- [x] `npm run build` — production SPA bundle built in `dist/`
- [x] **Pre-Migration Remote D1 Backup:** Exported `fnb-caffe-db` (`97ae7a5f-fc4d-460d-b019-8535332bd81f`, 834 KB) to `/tmp/fnb-caffe-db-pre-luot9-20261118T095443Z.sql`
- [x] **Remote D1 Migrations Applied:** `20261030_02` delta + `20261115_01_tenant_unique_constraints_and_indexes.sql` + `20261118_01_orders_loyalty_points_redeemed.sql` (recorded in `schema_migrations`)
- [x] **Cloudflare Pages Deployed:** `https://5cfde7a7.fnb-caffe-container.pages.dev` → `https://auraspace.cafe` (`shortSha: 8bbc93c8`)
- [x] **Cloudflare Worker Deployed:** `aura-space-worker` Version ID `c53c7d97-69c6-48c4-8924-1cd30705e417` (`shortSha: 8bbc93c8`)
