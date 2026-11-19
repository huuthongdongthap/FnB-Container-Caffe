# Deploy Execution Log — Lượt 9 (`v2.3.0` Store Operations & Multi-Tenant Hardening)

- **Date:** 2026-11-18T09:56:21Z
- **Account:** `b69fee03bdd94234eea8e4114cfc36ab`
- **Deployed Commit Marker:** `8bbc93c8` (`8bbc93c8417b1572b2a471eb0fd12488a6ff7d2c`)
- **Status:** `DEPLOYED_AND_VERIFIED`

## 1. Remote D1 Backup & Forward Migrations (`fnb-caffe-db` / `97ae7a5f-fc4d-460d-b019-8535332bd81f`)
1. **Pre-Migration Export:**
   - `wrangler d1 export fnb-caffe-db --remote --output=/tmp/fnb-caffe-db-pre-luot9-20261118T095443Z.sql` → `834 KB` SQL snapshot saved.
2. **Forward Migrations Executed:**
   - `20261030_02_replica_schema_parity_and_waste_log_cutover.sql` (remaining additive columns & `kds_stations` seed) → `SUCCESS`
   - `20261115_01_tenant_unique_constraints_and_indexes.sql` (`27` queries, `32` rows written, `size_after: 2,871,296`) → `SUCCESS`
   - `20261118_01_orders_loyalty_points_redeemed.sql` (`1` query, `ALTER TABLE orders ADD COLUMN loyalty_points_redeemed INTEGER DEFAULT 0`) → `SUCCESS`
   - Recorded all 3 versions in remote `schema_migrations` ledger.

## 2. Cloudflare Pages Deployment (`fnb-caffe-container`)
- **Build:** `npx --no-install vite build --mode production` (`dist/version.json` stamped `8bbc93c8 @ 2026-11-18T09:56:21Z`)
- **Preview URL:** `https://5cfde7a7.fnb-caffe-container.pages.dev`
- **Custom Domain:** `https://auraspace.cafe`

## 3. Cloudflare Worker Deployment (`aura-space-worker`)
- **Worker URL:** `https://aura-space-worker.sadec-marketing-hub.workers.dev`
- **Deployed Version ID:** `c53c7d97-69c6-48c4-8924-1cd30705e417`
- **Upload / Trigger Time:** `11.93s` upload (`2056.23 KiB` / `327.09 KiB` gzip), `3.74s` triggers (`0 */6 * * *`, `0 1 * * *`)

## Unresolved Questions
- None.
