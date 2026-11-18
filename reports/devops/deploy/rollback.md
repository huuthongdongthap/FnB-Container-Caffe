# Rollback Plan — Lượt 9 Production Deployment

- **Current Active Worker Version ID:** `c53c7d97-69c6-48c4-8924-1cd30705e417` (`shortSha: 8bbc93c8`)
- **Previous Baseline Worker Version ID:** `33d9e23b-711c-4278-82d1-b8013fedc41a`
- **Pre-Migration D1 Backup File:** `/tmp/fnb-caffe-db-pre-luot9-20261118T095443Z.sql` (834 KB)

## 1. Worker Instant Rollback (< 60s)
- **Via Wrangler CLI:**
  ```bash
  cd worker && wrangler rollback 33d9e23b-711c-4278-82d1-b8013fedc41a --message "Rollback Lượt 9" --yes
  ```
- **Via GitHub Actions:**
  - Workflow: `.github/workflows/deploy.yml`
  - `action`: `worker-rollback`
  - `baseline_version_id`: `33d9e23b-711c-4278-82d1-b8013fedc41a`

## 2. D1 Schema Rollback
- Forward migrations `20261115_01_tenant_unique_constraints_and_indexes.sql` and `20261118_01_orders_loyalty_points_redeemed.sql` are strictly additive (`ADD COLUMN`, `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`) and backward-compatible with previous Worker versions.
- If full D1 restoration is required:
  ```bash
  wrangler d1 execute fnb-caffe-db --remote --file=/tmp/fnb-caffe-db-pre-luot9-20261118T095443Z.sql --config worker/wrangler.toml
  ```

## Unresolved Questions
- None.
